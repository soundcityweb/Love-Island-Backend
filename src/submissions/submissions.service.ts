import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Submission } from '../entities/submission.entity';
import { Competition } from '../entities/competition.entity';
import { CompetitionsService } from '../competitions/competitions.service';
import { WinnerSelectionService } from '../competitions/winner-selection.service';
import { ListSubmissionsDto, SubmissionStatus } from './dto/list-submissions.dto';
import { SelectWinnersDto } from './dto/select-winners.dto';
import { CompetitionType } from '../entities/competition-type.enum';

// ─── Shared response shapes ───────────────────────────────────────────────────

export interface UserInfo {
  /** Raw derived-session UUID. */
  userId:     string;
  /** Short display handle: fan_<first-8-hex-chars>. */
  userHandle: string;
}

export interface SubmissionDto extends UserInfo {
  id:            string;
  competitionId: string;
  competition: {
    id:    string;
    title: string;
    slug:  string;
    type:  string;
  } | null;
  answers:   Record<string, string>;
  score:     number;
  status:    SubmissionStatus;
  createdAt: string;
}

export interface PaginatedResult<T> {
  data: T[];
  meta: {
    total:      number;
    page:       number;
    limit:      number;
    totalPages: number;
    hasNext:    boolean;
    hasPrev:    boolean;
  };
  stats: {
    totalSubmissions:   number;
    uniqueParticipants: number;
    avgScore:           number | null;
    statusCounts:       Record<string, number>;
  };
}

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class SubmissionsService {
  constructor(
    @InjectRepository(Submission)
    private readonly submissionRepo: Repository<Submission>,

    @InjectRepository(Competition)
    private readonly competitionRepo: Repository<Competition>,

    // Delegates to existing services — no logic duplication
    private readonly competitionsService: CompetitionsService,
    private readonly winnerService: WinnerSelectionService,
  ) {}

  // ── 1. List submissions ──────────────────────────────────────────────────

  /**
   * Returns a paginated, filtered list of submissions.
   * When `competitionId` is provided the query is scoped to that competition.
   *
   * Includes per-row user info (userId + userHandle) and aggregate stats
   * for the full result set (before pagination).
   */
  async findAll(dto: ListSubmissionsDto): Promise<PaginatedResult<SubmissionDto>> {
    const page    = Math.max(1, dto.page  ?? 1);
    const limit   = Math.min(100, Math.max(1, dto.limit ?? 50));
    const skip    = (page - 1) * limit;
    const sortBy  = dto.sortBy  ?? 'createdAt';
    const sortDir = dto.sortDir ?? 'DESC';

    // ── Main query ────────────────────────────────────────────────────────
    const qb = this.submissionRepo
      .createQueryBuilder('s')
      .leftJoinAndSelect('s.competition', 'c')
      .skip(skip)
      .take(limit);

    this.applyFilters(qb, dto);
    this.applySorting(qb, sortBy, sortDir);

    const [rows, total] = await qb.getManyAndCount();

    // ── Aggregate stats (un-paginated) ────────────────────────────────────
    const statsQb = this.submissionRepo
      .createQueryBuilder('s')
      .leftJoin('s.competition', 'c');

    this.applyFilters(statsQb, dto);

    const [totalAll, uniqueRow, avgRow, statusRows] = await Promise.all([
      statsQb.clone().getCount(),

      statsQb.clone()
        .select('COUNT(DISTINCT s.userId)', 'cnt')
        .getRawOne<{ cnt: string }>(),

      statsQb.clone()
        .select('AVG(CASE WHEN s.score > 0 THEN CAST(s.score AS float) END)', 'avg')
        .getRawOne<{ avg: string | null }>(),

      statsQb.clone()
        .select('s.status', 'status')
        .addSelect('COUNT(*)', 'cnt')
        .groupBy('s.status')
        .getRawMany<{ status: string; cnt: string }>(),
    ]);

    const statusCounts: Record<string, number> = {};
    for (const r of statusRows) {
      statusCounts[r.status] = parseInt(r.cnt, 10);
    }

    return {
      data: rows.map((s) => this.toDto(s)),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasNext:    page < Math.ceil(total / limit),
        hasPrev:    page > 1,
      },
      stats: {
        totalSubmissions:   totalAll,
        uniqueParticipants: parseInt(uniqueRow?.cnt ?? '0', 10),
        avgScore:           avgRow?.avg ? parseFloat(parseFloat(avgRow.avg).toFixed(1)) : null,
        statusCounts,
      },
    };
  }

  /**
   * Returns a single submission with full user info.
   * Throws 404 if not found.
   */
  async findOne(id: string): Promise<SubmissionDto> {
    const s = await this.submissionRepo.findOne({
      where: { id },
      relations: ['competition'],
    });
    if (!s) throw new NotFoundException(`Submission ${id} not found.`);
    return this.toDto(s);
  }

  // ── 2. Update status ─────────────────────────────────────────────────────

  /**
   * Approve, reject, disqualify, or mark a submission as winner.
   * Returns the updated submission DTO.
   */
  async updateStatus(id: string, status: SubmissionStatus): Promise<SubmissionDto> {
    const s = await this.submissionRepo.findOne({
      where: { id },
      relations: ['competition'],
    });
    if (!s) throw new NotFoundException(`Submission ${id} not found.`);

    await this.submissionRepo.update(id, { status } as any);
    s.status = status as any;
    return this.toDto(s);
  }

  // ── 3. Select winners ────────────────────────────────────────────────────

  /**
   * Unified winner selection.
   * Delegates to WinnerSelectionService so all logic lives in one place.
   *
   *   mode = "auto"   → top-score (quiz/prediction) or random (poll/upload)
   *   mode = "manual" → explicit ordered userIds list (index 0 = rank 1)
   */
  async selectWinners(competitionId: string, dto: SelectWinnersDto) {
    const competition = await this.competitionRepo.findOne({
      where: { id: competitionId },
    });
    if (!competition) {
      throw new NotFoundException(`Competition ${competitionId} not found.`);
    }

    if (dto.mode === 'manual') {
      return this.winnerService.adminManualSelectWinners(
        competitionId,
        dto.userIds ?? [],
      );
    }

    return this.winnerService.adminForceSelect(competitionId, dto.count);
  }

  // ── 4. Aggregated results ────────────────────────────────────────────────

  /**
   * Returns per-option vote / answer distribution for a competition.
   *
   * Poll       → option counts + percentages per question
   * Prediction → same as poll, plus correctAnswer flag per option
   * Quiz       → score stats + per-question correctness distribution
   * Upload     → submission counts grouped by status
   *
   * Delegates to CompetitionsService.adminGetResultsById to keep the
   * aggregation logic in a single place.
   */
  getResults(competitionId: string) {
    return this.competitionsService.adminGetResultsById(competitionId);
  }

  // ── Winner list ──────────────────────────────────────────────────────────

  getWinners(competitionId: string) {
    return this.winnerService.adminGetWinners(competitionId);
  }

  clearWinners(competitionId: string) {
    return this.winnerService.adminClearWinners(competitionId);
  }

  forceAutoSelect(competitionId: string, count?: number) {
    return this.winnerService.adminForceSelect(competitionId, count);
  }

  manualSelect(competitionId: string, userIds: string[]) {
    return this.winnerService.adminManualSelectWinners(competitionId, userIds);
  }

  processExpiredCompetitions() {
    return this.winnerService.processExpiredCompetitions();
  }

  // ── Type-specific lists (delegate to CompetitionsService) ────────────────

  findQuizSubmissions(opts: Parameters<CompetitionsService['adminFindQuizSubmissions']>[0]) {
    return this.competitionsService.adminFindQuizSubmissions(opts);
  }

  findPredictionSubmissions(opts: Parameters<CompetitionsService['adminFindPredictionSubmissions']>[0]) {
    return this.competitionsService.adminFindPredictionSubmissions(opts);
  }

  findPollResults(competitionId?: string) {
    return this.competitionsService.adminFindPollResults(competitionId);
  }

  findUploadSubmissions(opts: Parameters<CompetitionsService['adminFindUploadSubmissions']>[0]) {
    return this.competitionsService.adminFindUploadSubmissions(opts);
  }

  // ── Private helpers ──────────────────────────────────────────────────────

  private applyFilters(qb: any, dto: ListSubmissionsDto): void {
    if (dto.competitionId) {
      qb.andWhere('s.competitionId = :cid', { cid: dto.competitionId });
    }
    if (dto.type) {
      qb.andWhere('c.type = :type', { type: dto.type });
    }
    if (dto.status) {
      qb.andWhere('s.status = :status', { status: dto.status });
    }
    if (dto.search) {
      qb.andWhere('CAST(s.userId AS text) ILIKE :search', {
        search: `%${dto.search}%`,
      });
    }
    if (dto.dateFrom) {
      qb.andWhere('s.createdAt >= :from', { from: new Date(dto.dateFrom) });
    }
    if (dto.dateTo) {
      qb.andWhere('s.createdAt <= :to', { to: new Date(dto.dateTo) });
    }
  }

  private applySorting(
    qb: any,
    sortBy: 'createdAt' | 'score' | 'status',
    sortDir: 'ASC' | 'DESC',
  ): void {
    const col = {
      createdAt: 's.createdAt',
      score:     's.score',
      status:    's.status',
    }[sortBy];

    qb.orderBy(col, sortDir);

    // Secondary sort for deterministic ordering
    if (sortBy !== 'createdAt') qb.addOrderBy('s.createdAt', 'DESC');
  }

  /** Derive a short public handle from the session-derived UUID. */
  private userHandle(userId: string): string {
    return `fan_${userId.replace(/-/g, '').slice(0, 8)}`;
  }

  private toDto(s: Submission): SubmissionDto {
    return {
      id:            s.id,
      userId:        s.userId,
      userHandle:    this.userHandle(s.userId),
      competitionId: s.competitionId,
      competition:   s.competition
        ? { id: s.competition.id, title: s.competition.title, slug: s.competition.slug, type: s.competition.type }
        : null,
      answers:   s.answers,
      score:     s.score,
      status:    s.status as SubmissionStatus,
      createdAt: s.createdAt.toISOString(),
    };
  }
}
