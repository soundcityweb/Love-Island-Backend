import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Vote } from '../entities/vote.entity';
import { VotingPeriod } from '../entities/voting-period.entity';
import { VotingEventContestant } from '../entities/voting-event-contestant.entity';
import { VotingEventResult } from '../entities/voting-event-result.entity';
import { VotingPeriodStatus } from '../entities/voting-period-status.enum';
import { RedisService } from '../redis/redis.service';
import { CastVoteDto } from './dto/cast-vote.dto';
import { VotingEventEmitter } from './voting-events';
import { AnalyticsEventEmitter } from '../analytics/analytics.events';
import { VotingPreviewTokenService } from './voting-preview-token.service';

/** Session vote flag TTL cap (seconds); actual TTL is until event ends, capped by this */
const SESSION_VOTE_TTL_MAX_SECONDS = 86400 * 30;
/** Generic response when vote cannot be accepted (do not expose fraud reason) */
const UNABLE_TO_PROCESS_MESSAGE = 'Unable to process request.';

@Injectable()
export class VotingService {
  private readonly logger = new Logger(VotingService.name);

  constructor(
    @InjectRepository(Vote)
    private readonly voteRepository: Repository<Vote>,
    @InjectRepository(VotingPeriod)
    private readonly periodRepository: Repository<VotingPeriod>,
    @InjectRepository(VotingEventContestant)
    private readonly contestantRepository: Repository<VotingEventContestant>,
    @InjectRepository(VotingEventResult)
    private readonly resultRepository: Repository<VotingEventResult>,
    private readonly dataSource: DataSource,
    private readonly votingEvents: VotingEventEmitter,
    private readonly redis: RedisService,
    private readonly analyticsEvents: AnalyticsEventEmitter,
    private readonly votingPreviewToken: VotingPreviewTokenService,
  ) {}

  /**
   * Get the current active voting period (single active period assumed).
   * Only periods with status OPEN and within date range are considered active.
   */
  async getCurrentPeriod(): Promise<VotingPeriod | null> {
    const now = new Date();
    const period = await this.periodRepository
      .createQueryBuilder('p')
      .where('p.status = :status', { status: VotingPeriodStatus.OPEN })
      .andWhere('p.starts_at <= :now', { now })
      .andWhere('p.ends_at >= :now', { now })
      .orderBy('p.ends_at', 'ASC')
      .getOne();
    return period ?? null;
  }

  /**
   * POST /vote flow (VotingGuard runs before this: session_id validated, IP hashed, rate limit per IP applied).
   * 1. Fetch OPEN voting event in current time window (if any)
   * 2. If no OPEN event but a period exists in window → 403 (before any Redis logic)
   * 3. If no period in window at all → 400
   * 4. Validate: time window, contestant belongs to event
   * 5. Enforce 1 vote per session per event (Redis)
   * 6. Insert vote (transaction)
   * 7. Store vote flag in Redis (TTL until event ends)
   * 8. Return success. Do not expose fraud reason in errors.
   */
  async castVote(dto: CastVoteDto, sessionId: string): Promise<{ success: true; voteId: string }> {
    const now = new Date();
    // First, try to find an OPEN period in the current time window.
    let period = await this.periodRepository
      .createQueryBuilder('p')
      .where('p.status = :status', { status: VotingPeriodStatus.OPEN })
      .andWhere('p.starts_at <= :now', { now })
      .andWhere('p.ends_at >= :now', { now })
      .orderBy('p.ends_at', 'ASC')
      .getOne();

    if (!period) {
      // If there is a period in the window but not OPEN, treat as 403 (voting closed/not open).
      const anyInWindow = await this.periodRepository
        .createQueryBuilder('p')
        .where('p.starts_at <= :now', { now })
        .andWhere('p.ends_at >= :now', { now })
        .orderBy('p.ends_at', 'ASC')
        .getOne();

      if (anyInWindow) {
        throw new ForbiddenException('Voting is not open.');
      }

      throw new BadRequestException('No active voting event.');
    }

    if (now < period.startsAt || now > period.endsAt) {
      throw new ForbiddenException('Voting is not open at this time.');
    }
    const contestant = await this.contestantRepository.findOne({
      where: { votingPeriodId: period.id, islanderId: dto.islanderId },
    });
    if (!contestant) {
      throw new BadRequestException('Contestant does not belong to this voting event.');
    }

    if (this.redis.isAvailable()) {
      const alreadyVoted = await this.redis.hasSessionVoted(period.id, sessionId);
      if (alreadyVoted) {
        throw new ConflictException(UNABLE_TO_PROCESS_MESSAGE);
      }
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Single write: insert vote. Votes are immutable (no update/delete in this module).
      const voteRepo = queryRunner.manager.getRepository(Vote);
      const vote = voteRepo.create({
        votingPeriodId: period.id,
        islanderId: dto.islanderId,
        voterFingerprint: sessionId,
      });
      const saved = await voteRepo.save(vote);
      await queryRunner.commitTransaction();

      if (this.redis.isAvailable()) {
        const ttlSeconds = Math.ceil((period.endsAt.getTime() - Date.now()) / 1000);
        const ttl = Math.min(Math.max(ttlSeconds, 0), SESSION_VOTE_TTL_MAX_SECONDS);
        await this.redis.setSessionVoted(period.id, sessionId, ttl);
      }

      const payload = {
        voteId: saved.id,
        votingPeriodId: saved.votingPeriodId,
        islanderId: saved.islanderId,
        createdAt: saved.createdAt,
      };
      this.votingEvents.emitVoteRecorded(payload);
      this.analyticsEvents.emitVoteCast({
        voteId: saved.id,
        votingPeriodId: saved.votingPeriodId,
        islanderId: saved.islanderId,
        createdAt: saved.createdAt,
      });
      this.logger.log(`Vote recorded: ${saved.id} for islander ${saved.islanderId} in period ${saved.votingPeriodId}`);

      return { success: true, voteId: saved.id };
    } catch (err: unknown) {
      await queryRunner.rollbackTransaction();
      if (err && typeof err === 'object' && 'code' in err && (err as { code: string }).code === '23505') {
        throw new ConflictException(UNABLE_TO_PROCESS_MESSAGE);
      }
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Get results for a period (count per islander). Read-only.
   * If period.finalizedAt is set, reads from voting_event_results snapshot; otherwise aggregates from votes.
   */
  async getResults(periodId: string): Promise<{ islanderId: string; count: number }[]> {
    const period = await this.periodRepository.findOne({
      where: { id: periodId },
      select: { id: true, finalizedAt: true },
    });
    if (!period) {
      throw new NotFoundException(`Voting period "${periodId}" not found.`);
    }

    if (period.finalizedAt != null) {
      const rows = await this.resultRepository.find({
        where: { votingPeriodId: periodId },
        select: { islanderId: true, voteCount: true },
      });
      return rows.map((r) => ({ islanderId: r.islanderId, count: r.voteCount }));
    }

    const rows = await this.voteRepository
      .createQueryBuilder('v')
      .select('v.islander_id', 'islanderId')
      .addSelect('COUNT(*)::int', 'count')
      .where('v.voting_period_id = :periodId', { periodId })
      .groupBy('v.islander_id')
      .getRawMany<{ islanderId: string; count: number }>();

    return rows;
  }

  /**
   * Get results for public endpoint.
   * If resultsPublic is false, returns 403. When true, returns final results (snapshot if finalized).
   * Read-only; does not modify vote records.
   */
  async getPublicResults(eventId: string): Promise<{ islanderId: string; count: number }[]> {
    const period = await this.periodRepository.findOne({
      where: { id: eventId },
      select: { id: true, resultsPublic: true },
    });
    if (!period) {
      throw new NotFoundException(`Voting event "${eventId}" not found.`);
    }
    if (!period.resultsPublic) {
      throw new ForbiddenException('Results are not available.');
    }
    return this.getResults(eventId);
  }

  /**
   * List voting periods (for admin or frontend to show current/upcoming).
   * Includes totalVotes and contestantCount so admin UIs can show live totals without N+1 queries.
   */
  async listPeriods(): Promise<
    Array<{
      id: string;
      code: string;
      name: string;
      description: string | null;
      status: VotingPeriod['status'];
      startsAt: Date;
      endsAt: Date;
      resultsPublic: boolean;
      closedAt: Date | null;
      finalizedAt: Date | null;
      createdAt: Date;
      updatedAt: Date;
      totalVotes: number;
      contestantCount: number;
    }>
  > {
    const periods = await this.periodRepository.find({
      order: { startsAt: 'DESC' },
    });
    if (periods.length === 0) {
      return [];
    }

    const ids = periods.map((p) => p.id);

    const voteRows = await this.voteRepository
      .createQueryBuilder('v')
      .select('v.voting_period_id', 'periodId')
      .addSelect('COUNT(*)', 'cnt')
      .where('v.voting_period_id IN (:...ids)', { ids })
      .groupBy('v.voting_period_id')
      .getRawMany<{ periodId: string; cnt: string }>();

    const contestantRows = await this.contestantRepository
      .createQueryBuilder('c')
      .select('c.voting_period_id', 'periodId')
      .addSelect('COUNT(*)', 'cnt')
      .where('c.voting_period_id IN (:...ids)', { ids })
      .groupBy('c.voting_period_id')
      .getRawMany<{ periodId: string; cnt: string }>();

    const votesByPeriod = new Map<string, number>();
    for (const row of voteRows) {
      votesByPeriod.set(row.periodId, Number(row.cnt));
    }
    const contestantsByPeriod = new Map<string, number>();
    for (const row of contestantRows) {
      contestantsByPeriod.set(row.periodId, Number(row.cnt));
    }

    return periods.map((p) => ({
      id: p.id,
      code: p.code,
      name: p.name,
      description: p.description,
      status: p.status,
      startsAt: p.startsAt,
      endsAt: p.endsAt,
      resultsPublic: p.resultsPublic,
      closedAt: p.closedAt,
      finalizedAt: p.finalizedAt,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
      totalVotes: votesByPeriod.get(p.id) ?? 0,
      contestantCount: contestantsByPeriod.get(p.id) ?? 0,
    }));
  }

  /**
   * Get contestants (islanders) for a voting event. Public read-only; no vote totals.
   * Draft events are not exposed publicly (use preview token flow instead).
   */
  async getContestantsForEvent(periodId: string): Promise<
    { id: string; firstName: string; lastName: string | null; age: number; location: string; profileImage: string | null }[]
  > {
    const period = await this.periodRepository.findOne({
      where: { id: periodId },
      select: { id: true, status: true },
    });
    if (!period) {
      throw new NotFoundException(`Voting event "${periodId}" not found.`);
    }
    if (period.status === VotingPeriodStatus.DRAFT) {
      throw new ForbiddenException('This voting event is not publicly available yet.');
    }
    return this.loadContestantDtosForPeriod(periodId);
  }

  /**
   * Draft event + contestants for a valid preview token only (same contestant shape as public).
   */
  async getDraftPreview(
    eventId: string,
    token: string,
  ): Promise<{
    event: {
      id: string;
      code: string;
      name: string;
      status: VotingPeriod['status'];
      startsAt: Date;
      endsAt: Date;
      resultsPublic: boolean;
      createdAt: Date;
      updatedAt: Date;
    };
    contestants: {
      id: string;
      firstName: string;
      lastName: string | null;
      age: number;
      location: string;
      profileImage: string | null;
    }[];
  }> {
    const verified = this.votingPreviewToken.verify(token);
    if (!verified || verified.eventId !== eventId) {
      throw new UnauthorizedException('Invalid or expired preview link.');
    }

    const period = await this.periodRepository.findOne({
      where: { id: eventId },
      select: {
        id: true,
        code: true,
        name: true,
        status: true,
        startsAt: true,
        endsAt: true,
        resultsPublic: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    if (!period) {
      throw new NotFoundException(`Voting event "${eventId}" not found.`);
    }
    if (period.status !== VotingPeriodStatus.DRAFT) {
      throw new ForbiddenException('Preview is only available for draft events.');
    }

    const contestants = await this.loadContestantDtosForPeriod(eventId);
    return {
      event: {
        id: period.id,
        code: period.code,
        name: period.name,
        status: period.status,
        startsAt: period.startsAt,
        endsAt: period.endsAt,
        resultsPublic: period.resultsPublic,
        createdAt: period.createdAt,
        updatedAt: period.updatedAt,
      },
      contestants,
    };
  }

  /**
   * Vote volume over time for admin analytics. Single aggregated query on `votes`.
   * @param bucket `hour` for events ≤72h span, else prefer `day` for readability.
   */
  async getVotesTimeSeries(
    periodId: string,
    bucket: 'hour' | 'day',
  ): Promise<{ bucketStart: string; count: number }[]> {
    const period = await this.periodRepository.findOne({
      where: { id: periodId },
      select: { id: true },
    });
    if (!period) {
      throw new NotFoundException(`Voting period "${periodId}" not found.`);
    }

    const g = bucket === 'hour' ? 'hour' : 'day';
    const rows = await this.voteRepository
      .createQueryBuilder('v')
      .select(`DATE_TRUNC('${g}', v.created_at)`, 'bucket')
      .addSelect('COUNT(*)::int', 'count')
      .where('v.voting_period_id = :periodId', { periodId })
      .groupBy(`DATE_TRUNC('${g}', v.created_at)`)
      .orderBy('bucket', 'ASC')
      .getRawMany<{ bucket: Date | string; count: string }>();

    return rows.map((r) => {
      const d =
        r.bucket instanceof Date ? r.bucket : new Date(r.bucket as string);
      return {
        bucketStart: d.toISOString(),
        count: Number(r.count),
      };
    });
  }

  private async loadContestantDtosForPeriod(periodId: string): Promise<
    { id: string; firstName: string; lastName: string | null; age: number; location: string; profileImage: string | null }[]
  > {
    const contestants = await this.contestantRepository.find({
      where: { votingPeriodId: periodId },
      relations: ['islander'],
      order: { createdAt: 'ASC' },
    });
    return contestants
      .filter((c) => c.islander != null)
      .map((c) => ({
        id: c.islander!.id,
        firstName: c.islander!.firstName,
        lastName: c.islander!.lastName ?? null,
        age: c.islander!.age,
        location: c.islander!.location,
        profileImage: c.islander!.profileImage ?? null,
      }));
  }
}
