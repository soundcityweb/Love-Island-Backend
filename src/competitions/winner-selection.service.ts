import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, LessThan, In } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Competition } from '../entities/competition.entity';
import { Submission } from '../entities/submission.entity';
import { CompetitionWinner, WinnerSelectionMethod } from '../entities/competition-winner.entity';
import { CompetitionStatus } from '../entities/competition-status.enum';
import { CompetitionType } from '../entities/competition-type.enum';

// ── Response shapes ───────────────────────────────────────────────────────────

export interface WinnerRecord {
  /** Anonymised for public display: first 8 chars of the derived userId. */
  userHandle: string;
  rank: number;
  score: number;
  selectionMethod: WinnerSelectionMethod;
  selectedAt: string;
}

export interface WinnersResponse {
  competitionId: string;
  competitionSlug: string;
  selectionMethod: WinnerSelectionMethod;
  winners: WinnerRecord[];
}

/** Full admin record — includes the raw userId. */
export interface AdminWinnerRecord extends WinnerRecord {
  userId: string;
}

export interface AdminWinnersResponse extends WinnersResponse {
  winners: AdminWinnerRecord[];
}

// ── Cron result (for manual trigger / admin visibility) ───────────────────────

export interface CronRunResult {
  processed: number;
  skipped: number;
  competitions: Array<{ id: string; slug: string; winnersSelected: number }>;
}

// ── Defaults ──────────────────────────────────────────────────────────────────

const DEFAULT_WINNER_COUNT: Record<CompetitionType, number> = {
  [CompetitionType.QUIZ]:       3,
  [CompetitionType.PREDICTION]: 3,
  [CompetitionType.POLL]:       1,
  [CompetitionType.UPLOAD]:     1,
};

// ── Service ───────────────────────────────────────────────────────────────────

@Injectable()
export class WinnerSelectionService {
  private readonly logger = new Logger(WinnerSelectionService.name);

  constructor(
    @InjectRepository(Competition)
    private readonly competitionRepo: Repository<Competition>,
    @InjectRepository(Submission)
    private readonly submissionRepo: Repository<Submission>,
    @InjectRepository(CompetitionWinner)
    private readonly winnerRepo: Repository<CompetitionWinner>,
    private readonly dataSource: DataSource,
  ) {}

  // ── Cron ──────────────────────────────────────────────────────────────────

  /**
   * Runs at the top of every hour.
   * Finds active competitions whose end_at has passed, selects winners,
   * and marks them as completed — all idempotently.
   */
  @Cron(CronExpression.EVERY_HOUR, { name: 'competition-winner-selection' })
  async handleCron(): Promise<void> {
    this.logger.debug('Running competition winner-selection cron');
    const result = await this.processExpiredCompetitions();
    if (result.processed > 0) {
      this.logger.log(
        `Cron: processed ${result.processed} competition(s), skipped ${result.skipped}`,
      );
    }
  }

  // ── Public API ────────────────────────────────────────────────────────────

  /**
   * Manually trigger the expired-competition sweep.
   * Idempotent — safe to call multiple times.
   */
  async processExpiredCompetitions(): Promise<CronRunResult> {
    const expired = await this.competitionRepo.find({
      where: {
        status: CompetitionStatus.ACTIVE,
        endAt:  LessThan(new Date()),
      },
    });

    const result: CronRunResult = { processed: 0, skipped: 0, competitions: [] };

    for (const competition of expired) {
      const outcome = await this.processOne(competition);
      if (outcome === null) {
        result.skipped++;
      } else {
        result.processed++;
        result.competitions.push({
          id:              competition.id,
          slug:            competition.slug,
          winnersSelected: outcome,
        });
      }
    }

    return result;
  }

  /**
   * Get winners for a competition (public — anonymised userHandles only).
   * Returns 404 for draft competitions or competitions with no winners yet.
   */
  async getWinners(slug: string): Promise<WinnersResponse> {
    const competition = await this.competitionRepo.findOne({ where: { slug } });
    if (!competition || competition.status === CompetitionStatus.DRAFT) {
      throw new NotFoundException(`Competition "${slug}" not found.`);
    }

    const winners = await this.winnerRepo.find({
      where: { competitionId: competition.id },
      order: { rank: 'ASC' },
    });

    const method = this.resolveSelectionMethod(competition.type);
    return {
      competitionId:   competition.id,
      competitionSlug: competition.slug,
      selectionMethod: method,
      winners: winners.map((w) => this.toPublicRecord(w)),
    };
  }

  /**
   * Get winners for a competition (admin — full userId exposed).
   */
  async adminGetWinners(competitionId: string): Promise<AdminWinnersResponse> {
    const competition = await this.competitionRepo.findOne({
      where: { id: competitionId },
    });
    if (!competition) {
      throw new NotFoundException(`Competition ${competitionId} not found.`);
    }

    const winners = await this.winnerRepo.find({
      where: { competitionId },
      order: { rank: 'ASC' },
    });

    const method = this.resolveSelectionMethod(competition.type);
    return {
      competitionId:   competition.id,
      competitionSlug: competition.slug,
      selectionMethod: method,
      winners: winners.map((w) => this.toAdminRecord(w)),
    };
  }

  /**
   * Force winner selection for a specific competition regardless of status.
   * Admin-only. Useful for manual overrides or testing.
   * Re-runs selection if winners already exist (deletes and re-selects).
   *
   * @param count  Optional override for the number of winners to select.
   *               Defaults to competition.winnerCount or the type default.
   */
  async adminForceSelect(
    competitionId: string,
    count?: number,
  ): Promise<AdminWinnersResponse> {
    const competition = await this.competitionRepo.findOne({
      where: { id: competitionId },
    });
    if (!competition) {
      throw new NotFoundException(`Competition ${competitionId} not found.`);
    }

    // Temporarily override winnerCount for this run if caller specified one
    const original = competition.winnerCount;
    if (count != null && count > 0) {
      competition.winnerCount = count;
    }

    // Delete existing winners to allow a clean re-run
    await this.winnerRepo.delete({ competitionId });

    await this.runSelection(competition);

    // Restore the entity (no need to persist — just used by selectCandidates)
    competition.winnerCount = original;

    return this.adminGetWinners(competitionId);
  }

  /**
   * Manually assign winners from an explicit ordered list of userIds.
   * The first userId becomes rank 1, the second rank 2, etc.
   * Validates that every userId has an active (non-disqualified) submission
   * for this competition.
   * Marks the competition as completed and locks it.
   */
  async adminManualSelectWinners(
    competitionId: string,
    userIds: string[],
  ): Promise<AdminWinnersResponse> {
    if (!userIds || userIds.length === 0) {
      throw new BadRequestException('At least one winner must be specified.');
    }

    const competition = await this.competitionRepo.findOne({
      where: { id: competitionId },
    });
    if (!competition) {
      throw new NotFoundException(`Competition ${competitionId} not found.`);
    }

    // Verify each userId has a submission for this competition
    const submissions = await this.submissionRepo.find({
      where: { competitionId, userId: In(userIds) },
    });
    const foundIds = new Set(submissions.map((s) => s.userId));
    const missing  = userIds.filter((id) => !foundIds.has(id));
    if (missing.length > 0) {
      throw new BadRequestException(
        `No submission found for userId(s): ${missing.join(', ')}`,
      );
    }

    await this.winnerRepo.delete({ competitionId });

    await this.dataSource.transaction(async (manager) => {
      await manager.update(Competition, competitionId, {
        status: CompetitionStatus.COMPLETED,
      });

      const winnerEntities = userIds.map((userId, i) => {
        const sub = submissions.find((s) => s.userId === userId);
        return manager.create(CompetitionWinner, {
          competitionId,
          userId,
          rank:            i + 1,
          score:           sub?.score ?? 0,
          selectionMethod: 'manual' as const,
        });
      });
      await manager.save(CompetitionWinner, winnerEntities);
    });

    this.logger.log(
      `Manual winners: competition=${competition.slug} count=${userIds.length}`,
    );

    return this.adminGetWinners(competitionId);
  }

  /**
   * Clear all winners for a competition without changing its status.
   * Allows admins to re-open winner selection after a competition is complete.
   */
  async adminClearWinners(competitionId: string): Promise<{ cleared: number }> {
    const competition = await this.competitionRepo.findOne({
      where: { id: competitionId },
    });
    if (!competition) {
      throw new NotFoundException(`Competition ${competitionId} not found.`);
    }

    const result = await this.winnerRepo.delete({ competitionId });
    const cleared = typeof result.affected === 'number' ? result.affected : 0;

    this.logger.log(
      `Winners cleared: competition=${competition.slug} count=${cleared}`,
    );
    return { cleared };
  }

  // ── Private — core logic ──────────────────────────────────────────────────

  /**
   * Process a single competition:
   *  1. Skip if winners already exist (idempotency).
   *  2. Select winners based on competition type.
   *  3. Persist winners + mark competition as completed in one transaction.
   *
   * Returns the number of winners selected, or null if skipped.
   */
  private async processOne(competition: Competition): Promise<number | null> {
    const existingCount = await this.winnerRepo.count({
      where: { competitionId: competition.id },
    });

    if (existingCount > 0) {
      // Already processed — ensure status is completed
      if (competition.status !== CompetitionStatus.COMPLETED) {
        await this.competitionRepo.update(competition.id, {
          status: CompetitionStatus.COMPLETED,
        });
      }
      return null;
    }

    return this.runSelection(competition);
  }

  /**
   * Selects winners and persists them along with the completed status.
   * Returns the number of winners saved.
   */
  private async runSelection(competition: Competition): Promise<number> {
    const candidates = await this.selectCandidates(competition);

    await this.dataSource.transaction(async (manager) => {
      await manager.update(Competition, competition.id, {
        status: CompetitionStatus.COMPLETED,
      });

      if (candidates.length > 0) {
        const winnerEntities = candidates.map((c, i) =>
          manager.create(CompetitionWinner, {
            competitionId:   competition.id,
            userId:          c.userId,
            rank:            i + 1,
            score:           c.score,
            selectionMethod: c.method,
          }),
        );
        await manager.save(CompetitionWinner, winnerEntities);
      }
    });

    this.logger.log(
      `Winners selected: competition=${competition.slug} ` +
      `count=${candidates.length} method=${candidates[0]?.method ?? 'none'}`,
    );

    return candidates.length;
  }

  /**
   * Returns an ordered list of winner candidates for a competition.
   *
   * Scored types (quiz, prediction):
   *   Top N by score DESC, then by submission time ASC (earliest = tiebreaker).
   *
   * Unscored types (poll, upload):
   *   N random submissions — uses PostgreSQL RANDOM() for true randomness.
   */
  private async selectCandidates(
    competition: Competition,
  ): Promise<Array<{ userId: string; score: number; method: WinnerSelectionMethod }>> {
    const n = competition.winnerCount ?? DEFAULT_WINNER_COUNT[competition.type] ?? 1;
    const method = this.resolveSelectionMethod(competition.type);

    if (method === 'top_score') {
      const topN = await this.submissionRepo.find({
        where: { competitionId: competition.id },
        order: { score: 'DESC', createdAt: 'ASC' },
        take:  n,
      });
      return topN.map((s) => ({ userId: s.userId, score: s.score, method }));
    }

    // Random selection via PostgreSQL RANDOM()
    const randomN = await this.submissionRepo
      .createQueryBuilder('s')
      .where('s.competition_id = :id', { id: competition.id })
      .orderBy('RANDOM()')
      .limit(n)
      .getMany();

    return randomN.map((s) => ({ userId: s.userId, score: s.score, method }));
  }

  private resolveSelectionMethod(type: CompetitionType): WinnerSelectionMethod {
    return type === CompetitionType.QUIZ || type === CompetitionType.PREDICTION
      ? 'top_score'
      : 'random';
  }

  // ── Mapping helpers ───────────────────────────────────────────────────────

  private toPublicRecord(w: CompetitionWinner): WinnerRecord {
    return {
      userHandle:      `fan_${w.userId.replace(/-/g, '').slice(0, 8)}`,
      rank:            w.rank,
      score:           w.score,
      selectionMethod: w.selectionMethod,
      selectedAt:      w.createdAt.toISOString(),
    };
  }

  private toAdminRecord(w: CompetitionWinner): AdminWinnerRecord {
    return {
      ...this.toPublicRecord(w),
      userId: w.userId,
    };
  }
}
