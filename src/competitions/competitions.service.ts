import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, EntityManager } from 'typeorm';
import { createHash } from 'crypto';
import { Competition } from '../entities/competition.entity';
import { Question } from '../entities/question.entity';
import { Submission } from '../entities/submission.entity';
import { CompetitionStatus } from '../entities/competition-status.enum';
import { CompetitionType } from '../entities/competition-type.enum';
import { RedisService } from '../redis/redis.service';
import { CreateCompetitionDto, CreateQuestionDto } from './dto/create-competition.dto';
import { UpdateCompetitionDto, UpdateCompetitionStatusDto } from './dto/update-competition.dto';
import { SubmitAnswersDto } from './dto/submit-answers.dto';
import {
  ListCompetitionsDto,
  Paginated,
  PaginationMeta,
} from './dto/list-competitions.dto';

// ── Public response shapes ────────────────────────────────────────────────────

export interface CompetitionListItem {
  id: string;
  title: string;
  slug: string;
  type: CompetitionType;
  description: string | null;
  bannerUrl: string | null;
  sponsorName: string | null;
  sponsorLogo: string | null;
  rewardConfig: string | null;
  startAt: string | null;
  endAt: string | null;
  status: CompetitionStatus;
  participantCount: number;
}

export interface CompetitionDetail extends CompetitionListItem {
  questions: PublicQuestion[];
}

export interface PublicQuestion {
  id: string;
  question: string;
  options: string[];
}

export interface SubmitResult {
  score: number;
  total: number;
  passed: boolean;
  results: Array<{
    questionId: string;
    correct: boolean;
    correctAnswer: string;
    yourAnswer: string;
  }>;
}

export interface CompetitionResults {
  competition: {
    id: string;
    title: string;
    slug: string;
    type: CompetitionType;
    status: CompetitionStatus;
    endAt: string | null;
  };
  stats: {
    totalSubmissions: number;
    totalQuestions: number;
    averageScore: number;
    passRate: number;
    scoreDistribution: Array<{
      score: number;
      count: number;
      percentage: number;
    }>;
  };
}

// ── Admin response shapes ─────────────────────────────────────────────────────

export interface AdminCompetitionDetail extends CompetitionListItem {
  questions: AdminQuestion[];
  submissionCount: number;
}

export interface AdminQuestion extends PublicQuestion {
  correctAnswer: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Converts a free-form title into a URL-safe slug.
 * e.g. "Weekly Villa Quiz! #3" → "weekly-villa-quiz-3"
 */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Derives a stable UUID v4-formatted string from a session identifier.
 * The same sessionId always yields the same userId, enabling duplicate detection.
 * Replace with JWT subject extraction when an auth system is introduced.
 */
function deriveUserId(sessionId: string): string {
  const hash = createHash('sha256').update(sessionId).digest('hex');
  return [
    hash.slice(0, 8),
    hash.slice(8, 12),
    '4' + hash.slice(13, 16),
    ((parseInt(hash[16], 16) & 0x3) | 0x8).toString(16) + hash.slice(17, 20),
    hash.slice(20, 32),
  ].join('-');
}

/**
 * Redis TTL used to cache submission status per user per competition.
 * 90 days is generous — competitions are typically shorter-lived.
 */
const SUBMISSION_FLAG_TTL_SECONDS = 90 * 24 * 3600;

/** Redis key space for per-user submission tracking. */
const submissionKey = (userId: string, competitionId: string): string =>
  `competition:submitted:${userId}:${competitionId}`;

// ── Service ───────────────────────────────────────────────────────────────────

@Injectable()
export class CompetitionsService {
  private readonly logger = new Logger(CompetitionsService.name);

  constructor(
    @InjectRepository(Competition)
    private readonly competitionRepo: Repository<Competition>,
    @InjectRepository(Question)
    private readonly questionRepo: Repository<Question>,
    @InjectRepository(Submission)
    private readonly submissionRepo: Repository<Submission>,
    private readonly dataSource: DataSource,
    private readonly redis: RedisService,
  ) {}

  // ── Public — List ─────────────────────────────────────────────────────────

  /**
   * Paginated list of competitions.
   *
   * By default returns all non-draft competitions ordered by startAt DESC.
   * Supports optional filtering by status, type, and a full-text search on
   * title + description.
   */
  async findAll(
    query: ListCompetitionsDto,
  ): Promise<Paginated<CompetitionListItem>> {
    const { page, limit, status, type, search } = query;
    const skip = (page - 1) * limit;

    const qb = this.competitionRepo
      .createQueryBuilder('c')
      .loadRelationCountAndMap('c.participantCount', 'c.submissions');

    // ── Filters ──────────────────────────────────────────────────────────────
    if (status) {
      qb.where('c.status = :status', { status });
    } else {
      qb.where('c.status != :draft', { draft: CompetitionStatus.DRAFT });
    }

    if (type) {
      qb.andWhere('c.type = :type', { type });
    }

    if (search?.trim()) {
      qb.andWhere(
        '(LOWER(c.title) LIKE LOWER(:search) OR LOWER(c.description) LIKE LOWER(:search))',
        { search: `%${search.trim()}%` },
      );
    }

    const [rows, total] = await qb
      .orderBy('c.startAt', 'DESC', 'NULLS LAST')
      .addOrderBy('c.id', 'DESC')
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    const totalPages = Math.ceil(total / limit);
    const meta: PaginationMeta = {
      total,
      page,
      limit,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    };

    return { data: rows.map((c) => this.toListItem(c)), meta };
  }

  // ── Public — Detail ───────────────────────────────────────────────────────

  /**
   * Returns a single non-draft competition by slug.
   * Does NOT include questions — fetch them via findQuestions().
   */
  async findBySlug(slug: string): Promise<CompetitionDetail> {
    const c = await this.competitionRepo
      .createQueryBuilder('c')
      .where('c.slug = :slug', { slug })
      .andWhere('c.status != :draft', { draft: CompetitionStatus.DRAFT })
      .loadRelationCountAndMap('c.participantCount', 'c.submissions')
      .getOne();

    if (!c) throw new NotFoundException(`Competition "${slug}" not found.`);
    return { ...this.toListItem(c), questions: [] };
  }

  // ── Public — Questions ────────────────────────────────────────────────────

  /**
   * Returns ordered questions (no correctAnswer) for an active competition.
   * Intentionally restricted to active competitions — questions for upcoming
   * competitions must not be served early.
   */
  async findQuestions(slug: string): Promise<PublicQuestion[]> {
    const competition = await this.competitionRepo.findOne({
      where: { slug, status: CompetitionStatus.ACTIVE },
    });

    if (!competition) {
      throw new NotFoundException(
        `No active competition found for slug "${slug}".`,
      );
    }

    const questions = await this.questionRepo.find({
      where: { competitionId: competition.id },
      order: { id: 'ASC' },
    });

    return questions.map((q) => ({
      id: q.id,
      question: q.question,
      options: q.options,
    }));
  }

  // ── Public — Submit ───────────────────────────────────────────────────────

  /**
   * Submit answers for an active competition.
   *
   * Rate-limiting strategy (two layers):
   *  1. Redis fast-path: if a submission flag exists for this userId+competition,
   *     reject immediately without hitting the DB.
   *  2. DB unique constraint (userId, competitionId) — enforces correctness
   *     even when Redis is unavailable.
   *
   * After a successful submission the flag is written to Redis so future
   * attempts are short-circuited at the cache layer.
   */
  async submitAnswers(
    slug: string,
    sessionId: string,
    dto: SubmitAnswersDto,
  ): Promise<SubmitResult> {
    // ── 1. Load the competition ───────────────────────────────────────────
    const competition = await this.competitionRepo.findOne({
      where: { slug, status: CompetitionStatus.ACTIVE },
    });
    if (!competition) {
      throw new NotFoundException(
        `No active competition found for slug "${slug}".`,
      );
    }

    const userId = deriveUserId(sessionId);

    // ── 2. Redis fast-path duplicate check ────────────────────────────────
    const redisKey = submissionKey(userId, competition.id);
    const alreadyFlagged = await this.redis.get(redisKey);
    if (alreadyFlagged === '1') {
      throw new ConflictException(
        'You have already submitted answers for this competition.',
      );
    }

    // ── 3. DB duplicate check (Redis fallback / race condition guard) ─────
    const existing = await this.submissionRepo.findOne({
      where: { userId, competitionId: competition.id },
    });
    if (existing) {
      // Backfill Redis so subsequent calls hit the fast-path
      void this.redis.set(redisKey, '1', SUBMISSION_FLAG_TTL_SECONDS);
      throw new ConflictException(
        'You have already submitted answers for this competition.',
      );
    }

    // ── 4. Upload competitions — no questions; just record the entry ──────
    if (competition.type === CompetitionType.UPLOAD) {
      await this.dataSource.transaction(async (manager) => {
        await manager.save(Submission, {
          userId,
          competitionId: competition.id,
          answers: dto.answers,  // contains { entry_url: "https://..." }
          score: 0,
        });
      });
      void this.redis.set(redisKey, '1', SUBMISSION_FLAG_TTL_SECONDS);
      this.logger.log(
        `Upload entry: competition=${competition.id} user=${userId}`,
      );
      return { score: 0, total: 0, passed: true, results: [] };
    }

    // ── 5. Load questions (correct answers included — server-side only) ───
    const questions = await this.questionRepo.find({
      where: { competitionId: competition.id },
      order: { id: 'ASC' },
    });

    if (questions.length === 0) {
      throw new BadRequestException(
        'This competition has no questions configured.',
      );
    }

    // ── 6. Validate answer keys reference real question IDs ───────────────
    const questionIds = new Set(questions.map((q) => q.id));
    for (const answeredId of Object.keys(dto.answers)) {
      if (!questionIds.has(answeredId)) {
        throw new BadRequestException(
          `Unknown question ID in answers: "${answeredId}".`,
        );
      }
    }

    // ── 7. Compute score ──────────────────────────────────────────────────
    let score = 0;
    const results = questions.map((q) => {
      const yourAnswer = (dto.answers[q.id] ?? '').trim();
      const correct = yourAnswer !== '' && yourAnswer === q.correctAnswer;
      if (correct) score++;
      return { questionId: q.id, correct, correctAnswer: q.correctAnswer, yourAnswer };
    });

    // ── 8. Persist in a transaction ───────────────────────────────────────
    await this.dataSource.transaction(async (manager) => {
      await manager.save(Submission, {
        userId,
        competitionId: competition.id,
        answers: dto.answers,
        score,
      });
    });

    // ── 9. Set Redis flag (fire-and-forget; failure is non-fatal) ─────────
    void this.redis.set(redisKey, '1', SUBMISSION_FLAG_TTL_SECONDS);

    this.logger.log(
      `Submission: competition=${competition.id} user=${userId} score=${score}/${questions.length}`,
    );

    return { score, total: questions.length, passed: score > questions.length / 2, results };
  }

  // ── Public — Results ──────────────────────────────────────────────────────

  /**
   * Returns aggregated results for a completed or active competition.
   * Available for any non-draft competition.
   *
   * Includes:
   *  - Total submission count
   *  - Average score and pass rate
   *  - Score distribution histogram
   */
  async getResults(slug: string): Promise<CompetitionResults> {
    const competition = await this.competitionRepo.findOne({ where: { slug } });
    if (!competition || competition.status === CompetitionStatus.DRAFT) {
      throw new NotFoundException(`Competition "${slug}" not found.`);
    }

    const totalQuestions = await this.questionRepo.count({
      where: { competitionId: competition.id },
    });

    // Fetch scores only — avoid loading full answer JSON payloads
    const scoreRows = await this.submissionRepo
      .createQueryBuilder('s')
      .select('s.score', 'score')
      .where('s.competition_id = :id', { id: competition.id })
      .getRawMany<{ score: number }>();

    const totalSubmissions = scoreRows.length;

    if (totalSubmissions === 0) {
      return {
        competition: this.toCompetitionRef(competition),
        stats: {
          totalSubmissions: 0,
          totalQuestions,
          averageScore: 0,
          passRate: 0,
          scoreDistribution: [],
        },
      };
    }

    const scores = scoreRows.map((r) => Number(r.score));
    const sum = scores.reduce((a, b) => a + b, 0);
    const averageScore = parseFloat((sum / totalSubmissions).toFixed(2));

    const passThreshold = totalQuestions / 2;
    const passCount = scores.filter((s) => s > passThreshold).length;
    const passRate = Math.round((passCount / totalSubmissions) * 100);

    // Build histogram: score → count
    const histogram = new Map<number, number>();
    for (const s of scores) {
      histogram.set(s, (histogram.get(s) ?? 0) + 1);
    }
    const scoreDistribution = Array.from(histogram.entries())
      .sort(([a], [b]) => b - a) // highest score first
      .map(([score, count]) => ({
        score,
        count,
        percentage: Math.round((count / totalSubmissions) * 100),
      }));

    return {
      competition: this.toCompetitionRef(competition),
      stats: {
        totalSubmissions,
        totalQuestions,
        averageScore,
        passRate,
        scoreDistribution,
      },
    };
  }

  // ── Admin ─────────────────────────────────────────────────────────────────

  async adminFindAll(): Promise<AdminCompetitionDetail[]> {
    const rows = await this.competitionRepo
      .createQueryBuilder('c')
      .leftJoinAndSelect('c.questions', 'q')
      .loadRelationCountAndMap('c.participantCount', 'c.submissions')
      .orderBy('c.id', 'DESC')
      .getMany();
    return rows.map((c) => this.toAdminDetail(c));
  }

  async adminFindById(id: string): Promise<AdminCompetitionDetail> {
    const c = await this.competitionRepo
      .createQueryBuilder('c')
      .leftJoinAndSelect('c.questions', 'q')
      .loadRelationCountAndMap('c.participantCount', 'c.submissions')
      .where('c.id = :id', { id })
      .getOne();
    if (!c) throw new NotFoundException(`Competition ${id} not found.`);
    return this.toAdminDetail(c);
  }

  async adminCreate(dto: CreateCompetitionDto): Promise<AdminCompetitionDetail> {
    const slug = dto.slug ? dto.slug : slugify(dto.title);

    const existing = await this.competitionRepo.findOne({ where: { slug } });
    if (existing) {
      throw new ConflictException(`A competition with slug "${slug}" already exists.`);
    }

    const competition = await this.dataSource.transaction(async (manager) => {
      const comp = manager.create(Competition, {
        title:        dto.title,
        slug,
        type:         dto.type,
        description:  dto.description ?? null,
        bannerUrl:    dto.bannerUrl ?? null,
        sponsorName:  dto.sponsorName ?? null,
        sponsorLogo:  dto.sponsorLogo ?? null,
        rewardConfig: dto.rewardConfig ?? null,
        startAt:      dto.startAt ? new Date(dto.startAt) : null,
        endAt:        dto.endAt ? new Date(dto.endAt) : null,
        status:       dto.status ?? CompetitionStatus.DRAFT,
      });
      const saved = await manager.save(Competition, comp);
      if (dto.questions?.length) {
        await this.saveQuestions(manager, saved.id, dto.questions);
      }
      return saved;
    });

    return this.adminFindById(competition.id);
  }

  async adminUpdate(id: string, dto: UpdateCompetitionDto): Promise<AdminCompetitionDetail> {
    const competition = await this.competitionRepo.findOne({ where: { id } });
    if (!competition) throw new NotFoundException(`Competition ${id} not found.`);

    if (dto.slug && dto.slug !== competition.slug) {
      const conflict = await this.competitionRepo.findOne({ where: { slug: dto.slug } });
      if (conflict) {
        throw new ConflictException(`A competition with slug "${dto.slug}" already exists.`);
      }
    }

    await this.dataSource.transaction(async (manager) => {
      const updates: Partial<Competition> = {};
      if (dto.title        !== undefined) updates.title        = dto.title;
      if (dto.slug         !== undefined) updates.slug         = dto.slug;
      if (dto.type         !== undefined) updates.type         = dto.type;
      if (dto.description  !== undefined) updates.description  = dto.description ?? null;
      if (dto.bannerUrl    !== undefined) updates.bannerUrl    = dto.bannerUrl ?? null;
      if (dto.sponsorName  !== undefined) updates.sponsorName  = dto.sponsorName ?? null;
      if (dto.sponsorLogo  !== undefined) updates.sponsorLogo  = dto.sponsorLogo ?? null;
      if (dto.rewardConfig !== undefined) updates.rewardConfig = dto.rewardConfig ?? null;
      if (dto.startAt      !== undefined) updates.startAt      = dto.startAt ? new Date(dto.startAt) : null;
      if (dto.endAt        !== undefined) updates.endAt        = dto.endAt ? new Date(dto.endAt) : null;
      if (dto.status       !== undefined) updates.status       = dto.status;

      await manager.update(Competition, id, updates);

      if (dto.questions !== undefined) {
        await manager.delete(Question, { competitionId: id });
        if (dto.questions.length > 0) {
          await this.saveQuestions(manager, id, dto.questions);
        }
      }
    });

    return this.adminFindById(id);
  }

  async adminUpdateStatus(
    id: string,
    dto: UpdateCompetitionStatusDto,
  ): Promise<{ id: string; status: CompetitionStatus }> {
    const competition = await this.competitionRepo.findOne({ where: { id } });
    if (!competition) throw new NotFoundException(`Competition ${id} not found.`);
    await this.competitionRepo.update(id, { status: dto.status });
    return { id, status: dto.status };
  }

  async adminDelete(id: string): Promise<{ deleted: true }> {
    const competition = await this.competitionRepo.findOne({ where: { id } });
    if (!competition) throw new NotFoundException(`Competition ${id} not found.`);
    await this.competitionRepo.remove(competition);
    return { deleted: true };
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private async saveQuestions(
    manager: EntityManager,
    competitionId: string,
    questionDtos: CreateQuestionDto[],
  ): Promise<void> {
    const questions = questionDtos.map((dto) =>
      manager.create(Question, {
        competitionId,
        question:      dto.question,
        options:       dto.options,
        correctAnswer: dto.correctAnswer,
      }),
    );
    await manager.save(Question, questions);
  }

  private toListItem(c: Competition & { participantCount?: number }): CompetitionListItem {
    return {
      id:               c.id,
      title:            c.title,
      slug:             c.slug,
      type:             c.type,
      description:      c.description,
      bannerUrl:        c.bannerUrl,
      sponsorName:      c.sponsorName,
      sponsorLogo:      c.sponsorLogo,
      rewardConfig:     c.rewardConfig ?? null,
      startAt:          c.startAt?.toISOString() ?? null,
      endAt:            c.endAt?.toISOString() ?? null,
      status:           c.status,
      participantCount: (c as any).participantCount ?? 0,
    };
  }

  private toAdminDetail(c: Competition & { participantCount?: number }): AdminCompetitionDetail {
    return {
      ...this.toListItem(c),
      questions: (c.questions ?? []).map((q) => ({
        id:            q.id,
        question:      q.question,
        options:       q.options,
        correctAnswer: q.correctAnswer,
      })),
      submissionCount: (c as any).participantCount ?? 0,
    };
  }

  private toCompetitionRef(c: Competition) {
    return {
      id:     c.id,
      title:  c.title,
      slug:   c.slug,
      type:   c.type,
      status: c.status,
      endAt:  c.endAt?.toISOString() ?? null,
    };
  }

  // ── Admin — Submissions ───────────────────────────────────────────────────

  /**
   * Paginated list of all submissions with optional filters.
   * Supports filtering by competitionId, type, status, userId prefix, and
   * date range.
   */
  async adminFindSubmissions(opts: {
    competitionId?: string;
    type?: CompetitionType;
    status?: string;
    search?: string;
    dateFrom?: string;
    dateTo?: string;
    page?: number;
    limit?: number;
  }) {
    const page  = Math.max(1, opts.page  ?? 1);
    const limit = Math.min(100, Math.max(1, opts.limit ?? 50));
    const skip  = (page - 1) * limit;

    const qb = this.submissionRepo
      .createQueryBuilder('s')
      .leftJoinAndSelect('s.competition', 'c')
      .orderBy('s.createdAt', 'DESC')
      .skip(skip)
      .take(limit);

    if (opts.competitionId) {
      qb.andWhere('s.competitionId = :cid', { cid: opts.competitionId });
    }
    if (opts.type) {
      qb.andWhere('c.type = :type', { type: opts.type });
    }
    if (opts.status) {
      qb.andWhere('s.status = :status', { status: opts.status });
    }
    if (opts.search) {
      qb.andWhere('CAST(s.userId AS text) ILIKE :search', {
        search: `%${opts.search}%`,
      });
    }
    if (opts.dateFrom) {
      qb.andWhere('s.createdAt >= :from', { from: new Date(opts.dateFrom) });
    }
    if (opts.dateTo) {
      qb.andWhere('s.createdAt <= :to', { to: new Date(opts.dateTo) });
    }

    const [rows, total] = await qb.getManyAndCount();

    // Aggregate stats for visible rows (efficient enough for admin use)
    const statsQb = this.submissionRepo
      .createQueryBuilder('s')
      .leftJoin('s.competition', 'c');

    if (opts.competitionId) statsQb.andWhere('s.competitionId = :cid', { cid: opts.competitionId });
    if (opts.type)          statsQb.andWhere('c.type = :type', { type: opts.type });
    if (opts.dateFrom)      statsQb.andWhere('s.createdAt >= :from', { from: new Date(opts.dateFrom) });
    if (opts.dateTo)        statsQb.andWhere('s.createdAt <= :to', { to: new Date(opts.dateTo) });

    const [totalAll, uniqueCount, avgScoreRow] = await Promise.all([
      statsQb.clone().getCount(),
      statsQb.clone().select('COUNT(DISTINCT s.userId)', 'cnt').getRawOne() as Promise<{ cnt: string }>,
      statsQb.clone()
        .select('AVG(CASE WHEN s.score > 0 THEN CAST(s.score AS float) END)', 'avg')
        .getRawOne() as Promise<{ avg: string | null }>,
    ]);

    const data = rows.map((s) => ({
      id:            s.id,
      userId:        s.userId,
      competitionId: s.competitionId,
      competition: s.competition ? {
        id:    s.competition.id,
        title: s.competition.title,
        slug:  s.competition.slug,
        type:  s.competition.type,
      } : null,
      answers:   s.answers,
      score:     s.score,
      status:    s.status,
      createdAt: s.createdAt.toISOString(),
    }));

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
      stats: {
        totalSubmissions: totalAll,
        uniqueParticipants: parseInt(uniqueCount?.cnt ?? '0', 10),
        avgScore: avgScoreRow?.avg ? parseFloat(parseFloat(avgScoreRow.avg).toFixed(1)) : null,
      },
    };
  }

  /**
   * Quiz-specific admin view: paginated submissions for quiz competitions,
   * enriched with all competition questions (including correctAnswer) and a
   * pre-built top-10 leaderboard.
   *
   * The `answers` map uses questionId as the key and the chosen option text as
   * the value, so correctness is evaluated purely via string comparison.
   */
  async adminFindQuizSubmissions(opts: {
    competitionId?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const page  = Math.max(1, opts.page  ?? 1);
    const limit = Math.min(200, Math.max(1, opts.limit ?? 50));
    const skip  = (page - 1) * limit;

    // ── 1. Submissions ────────────────────────────────────────────────────
    const qb = this.submissionRepo
      .createQueryBuilder('s')
      .leftJoinAndSelect('s.competition', 'c')
      .where('c.type = :type', { type: CompetitionType.QUIZ })
      .orderBy('s.score', 'DESC')
      .addOrderBy('s.createdAt', 'ASC') // earlier submission wins tie
      .skip(skip)
      .take(limit);

    if (opts.competitionId) {
      qb.andWhere('s.competitionId = :cid', { cid: opts.competitionId });
    }
    if (opts.search) {
      qb.andWhere('CAST(s.userId AS text) ILIKE :search', {
        search: `%${opts.search}%`,
      });
    }

    const [rows, total] = await qb.getManyAndCount();

    // ── 2. Questions for each competition present in results ───────────────
    const compIds = [...new Set(rows.map((r) => r.competitionId))];
    const questions = compIds.length
      ? await this.questionRepo
          .createQueryBuilder('q')
          .where('q.competitionId IN (:...ids)', { ids: compIds })
          .getMany()
      : [];

    // Map competitionId → questions
    const questionsByComp = new Map<string, typeof questions>();
    for (const q of questions) {
      if (!questionsByComp.has(q.competitionId)) questionsByComp.set(q.competitionId, []);
      questionsByComp.get(q.competitionId)!.push(q);
    }

    // ── 3. Assign rank within this result set ─────────────────────────────
    // rows are already sorted by score DESC, createdAt ASC
    let rank = 1;
    const data = rows.map((s, i) => {
      if (i > 0 && rows[i - 1].score > s.score) rank = i + 1;
      const qs = questionsByComp.get(s.competitionId) ?? [];
      const total_q = qs.length;
      return {
        id:            s.id,
        userId:        s.userId,
        competitionId: s.competitionId,
        competition: s.competition ? {
          id:    s.competition.id,
          title: s.competition.title,
          slug:  s.competition.slug,
        } : null,
        score:      s.score,
        total:      total_q,
        answers:    s.answers,
        status:     s.status,
        createdAt:  s.createdAt.toISOString(),
        rank,
        questions: qs.map((q) => ({
          id:            q.id,
          question:      q.question,
          options:       q.options,
          correctAnswer: q.correctAnswer,
          userAnswer:    s.answers?.[q.id] ?? null,
          correct:       s.answers?.[q.id] === q.correctAnswer,
        })),
      };
    });

    // ── 4. Leaderboard: top 10 across whole filtered set ──────────────────
    const leaderQb = this.submissionRepo
      .createQueryBuilder('s')
      .leftJoin('s.competition', 'c')
      .where('c.type = :type', { type: CompetitionType.QUIZ })
      .select(['s.userId', 's.score', 's.competitionId', 's.createdAt'])
      .orderBy('s.score', 'DESC')
      .addOrderBy('s.createdAt', 'ASC')
      .limit(10);

    if (opts.competitionId) {
      leaderQb.andWhere('s.competitionId = :cid', { cid: opts.competitionId });
    }

    const topRows = await leaderQb.getMany();
    const leaderboard = topRows.map((r, i) => ({
      rank:      i + 1,
      userId:    r.userId,
      score:     r.score,
      submittedAt: r.createdAt.toISOString(),
    }));

    // ── 5. Aggregate stats ────────────────────────────────────────────────
    const statsQb = this.submissionRepo
      .createQueryBuilder('s')
      .leftJoin('s.competition', 'c')
      .where('c.type = :type', { type: CompetitionType.QUIZ });

    if (opts.competitionId) {
      statsQb.andWhere('s.competitionId = :cid', { cid: opts.competitionId });
    }

    const [totalAll, avgRow, topScoreRow] = await Promise.all([
      statsQb.clone().getCount(),
      statsQb.clone()
        .select('AVG(CAST(s.score AS float))', 'avg')
        .getRawOne() as Promise<{ avg: string | null }>,
      statsQb.clone()
        .select('MAX(s.score)', 'max')
        .getRawOne() as Promise<{ max: string | null }>,
    ]);

    const avgScore   = avgRow?.avg   ? parseFloat(parseFloat(avgRow.avg).toFixed(1))  : 0;
    const topScore   = topScoreRow?.max ? parseInt(topScoreRow.max, 10)               : 0;

    // Load questions for single-competition pass-rate calculation
    let totalQuestions = 0;
    if (opts.competitionId && compIds.length) {
      totalQuestions = (questionsByComp.get(opts.competitionId) ?? []).length;
    }
    const passThreshold = totalQuestions ? Math.ceil(totalQuestions / 2) : 1;

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
      stats: {
        totalSubmissions: totalAll,
        avgScore,
        topScore,
        totalQuestions,
        passThreshold,
      },
      leaderboard,
    };
  }

  // ── Admin — Upload gallery ────────────────────────────────────────────────

  /**
   * Returns all upload-type competition submissions for the gallery view.
   *
   * Each entry exposes:
   *   entryUrl   — extracted from answers.entry_url
   *   caption    — extracted from answers.caption (optional, may be absent)
   *   mediaType  — "image" | "video" | "unknown" inferred from the URL extension
   */
  async adminFindUploadSubmissions(opts: {
    competitionId?: string;
    status?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const page  = Math.max(1, opts.page  ?? 1);
    const limit = Math.min(200, Math.max(1, opts.limit ?? 60));
    const skip  = (page - 1) * limit;

    const qb = this.submissionRepo
      .createQueryBuilder('s')
      .leftJoinAndSelect('s.competition', 'c')
      .where('c.type = :type', { type: CompetitionType.UPLOAD })
      .orderBy('s.createdAt', 'DESC')
      .skip(skip)
      .take(limit);

    if (opts.competitionId) qb.andWhere('s.competitionId = :cid', { cid: opts.competitionId });
    if (opts.status)        qb.andWhere('s.status = :status', { status: opts.status });
    if (opts.search)        qb.andWhere('CAST(s.userId AS text) ILIKE :q', { q: `%${opts.search}%` });

    const [rows, total] = await qb.getManyAndCount();

    const VIDEO_EXTS  = /\.(mp4|webm|mov|avi|mkv)(\?|$)/i;
    const IMAGE_EXTS  = /\.(jpe?g|png|gif|webp|avif|svg)(\?|$)/i;
    const CLOUD_NAME  = process.env.CLOUDINARY_CLOUD_NAME ?? '';

    /** Normalise legacy Cloudinary public-IDs (e.g. "products/abc123") to full URLs. */
    const toFullUrl = (raw: string | null): string | null => {
      if (!raw) return null;
      if (raw.startsWith('http://') || raw.startsWith('https://')) return raw;
      // Bare public-id — reconstruct the secure URL
      return `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/${raw}`;
    };

    const data = rows.map((s) => {
      const raw      = (s.answers as any)?.entry_url ?? null;
      const url      = toFullUrl(raw);
      const caption  = (s.answers as any)?.caption   ?? null;
      const mediaType: 'image' | 'video' | 'unknown' =
        url
          ? VIDEO_EXTS.test(url) || url.includes('/video/upload/')
            ? 'video'
            : IMAGE_EXTS.test(url) || url.includes('/image/upload/')
              ? 'image'
              : 'unknown'
          : 'unknown';

      return {
        id:            s.id,
        userId:        s.userId,
        competitionId: s.competitionId,
        competition:   s.competition ? {
          id:    s.competition.id,
          title: s.competition.title,
          slug:  s.competition.slug,
        } : null,
        entryUrl:   url,
        caption,
        mediaType,
        status:     s.status,
        createdAt:  s.createdAt.toISOString(),
      };
    });

    // Aggregate counts per status
    const countsRaw = await this.submissionRepo
      .createQueryBuilder('s')
      .leftJoin('s.competition', 'c')
      .where('c.type = :type', { type: CompetitionType.UPLOAD })
      .select('s.status', 'status')
      .addSelect('COUNT(*)', 'cnt')
      .groupBy('s.status')
      .getRawMany<{ status: string; cnt: string }>();

    const counts: Record<string, number> = {};
    for (const r of countsRaw) counts[r.status] = parseInt(r.cnt, 10);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
      counts,
    };
  }

  // ── Admin — Results by ID ─────────────────────────────────────────────────

  /**
   * Returns full aggregated results for ANY competition type, looked up by
   * primary-key UUID (unlike the public getResults endpoint which uses slug).
   *
   * • For quiz / prediction: returns score distribution + per-question stats
   * • For poll / upload: returns per-question option vote distribution
   *
   * This is the endpoint backing the PollResultsAdmin widget:
   *   GET /api/admin/competitions/:id/results
   */
  async adminGetResultsById(id: string) {
    const competition = await this.competitionRepo.findOne({ where: { id } });
    if (!competition) throw new NotFoundException(`Competition ${id} not found.`);

    const questions = await this.questionRepo.find({ where: { competitionId: id } });

    const submissions = await this.submissionRepo
      .createQueryBuilder('s')
      .select(['s.answers', 's.score', 's.userId', 's.createdAt'])
      .where('s.competitionId = :id', { id })
      .orderBy('s.createdAt', 'DESC')
      .getMany();

    const totalVotes   = submissions.length;
    const uniqueVoters = new Set(submissions.map((s) => s.userId)).size;

    // Per-question option distribution
    const questionResults = questions.map((q) => {
      const counts: Record<string, number> = {};
      for (const opt of q.options) counts[opt] = 0;

      let qVotes = 0;
      for (const s of submissions) {
        const chosen = s.answers?.[q.id];
        if (chosen) { counts[chosen] = (counts[chosen] ?? 0) + 1; qVotes++; }
      }

      const options = q.options.map((opt) => {
        const count = counts[opt] ?? 0;
        return { option: opt, count, pct: qVotes > 0 ? Math.round((count / qVotes) * 100) : 0 };
      }).sort((a, b) => b.count - a.count);

      const winner = qVotes > 0 ? options[0] : null;

      return {
        id:         q.id,
        question:   q.question,
        options,
        totalVotes: qVotes,
        winner,
      };
    });

    // Score stats (useful for quiz / prediction types as bonus context)
    const scores     = submissions.map((s) => Number(s.score ?? 0));
    const avgScore   = scores.length ? parseFloat((scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1)) : 0;
    const topScore   = scores.length ? Math.max(...scores) : 0;

    return {
      id:          competition.id,
      title:       competition.title,
      slug:        competition.slug,
      type:        competition.type,
      status:      competition.status,
      startAt:     competition.startAt?.toISOString() ?? null,
      endAt:       competition.endAt?.toISOString()   ?? null,
      totalVotes,
      uniqueVoters,
      avgScore,
      topScore,
      questions:   questionResults,
    };
  }

  // ── Admin — Poll results ──────────────────────────────────────────────────

  /**
   * Aggregated poll results for one or all poll competitions.
   *
   * Response shape per competition:
   *   - questions[]  — each question with option distribution (count + %)
   *   - winner       — option with the highest vote share
   *   - recentVoters — last 20 user IDs + timestamps (no answers exposed)
   *   - stats        — totalVotes, uniqueVoters, leadingPct
   */
  async adminFindPollResults(competitionId?: string) {
    // ── 1. Get poll competitions ───────────────────────────────────────────
    const compQb = this.competitionRepo
      .createQueryBuilder('c')
      .where('c.type = :type', { type: CompetitionType.POLL })
      .leftJoinAndSelect('c.questions', 'q')
      .orderBy('c.startAt', 'DESC');

    if (competitionId) {
      compQb.andWhere('c.id = :id', { id: competitionId });
    }

    const competitions = await compQb.getMany();
    if (!competitions.length) return { competitions: [] };

    const compIds = competitions.map((c) => c.id);

    // ── 2. All poll submissions (no pagination — we aggregate) ─────────────
    const submissions = await this.submissionRepo
      .createQueryBuilder('s')
      .where('s.competitionId IN (:...ids)', { ids: compIds })
      .orderBy('s.createdAt', 'DESC')
      .getMany();

    // Group submissions by competition
    const subsByComp = new Map<string, typeof submissions>();
    for (const s of submissions) {
      if (!subsByComp.has(s.competitionId)) subsByComp.set(s.competitionId, []);
      subsByComp.get(s.competitionId)!.push(s);
    }

    // ── 3. Build per-competition result DTOs ───────────────────────────────
    const result = competitions.map((comp) => {
      const compSubs     = subsByComp.get(comp.id) ?? [];
      const uniqueVoters = new Set(compSubs.map((s) => s.userId)).size;

      // option distribution per question
      const questions = (comp.questions ?? []).map((q) => {
        // Count votes per option
        const counts: Record<string, number> = {};
        for (const opt of q.options) counts[opt] = 0;

        let totalVotes = 0;
        for (const s of compSubs) {
          const chosen = s.answers?.[q.id];
          if (chosen) {
            counts[chosen] = (counts[chosen] ?? 0) + 1;
            totalVotes++;
          }
        }

        const options = q.options.map((opt) => {
          const count = counts[opt] ?? 0;
          return {
            option: opt,
            count,
            pct: totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0,
          };
        });

        // Leading option
        const winner = options.reduce(
          (max, o) => (o.count > max.count ? o : max),
          options[0] ?? { option: '', count: 0, pct: 0 },
        );

        return {
          id:         q.id,
          question:   q.question,
          options:    options.sort((a, b) => b.count - a.count),
          totalVotes,
          winner:     totalVotes > 0 ? winner : null,
        };
      });

      // Recent voters (last 20, no answers)
      const recentVoters = compSubs.slice(0, 20).map((s) => ({
        userId:    s.userId,
        createdAt: s.createdAt.toISOString(),
        status:    s.status,
      }));

      return {
        id:          comp.id,
        title:       comp.title,
        slug:        comp.slug,
        status:      comp.status,
        startAt:     comp.startAt?.toISOString() ?? null,
        endAt:       comp.endAt?.toISOString()   ?? null,
        questions,
        recentVoters,
        stats: {
          totalVotes:   compSubs.length,
          uniqueVoters,
          leadingPct:
            questions[0]?.winner?.pct ?? null,
          leadingOption:
            questions[0]?.winner?.option ?? null,
        },
      };
    });

    return { competitions: result };
  }

  // ── Admin — Prediction submissions ───────────────────────────────────────

  /**
   * Returns all prediction-type submissions enriched with per-question data.
   *
   * Each question carries:
   *   - `correctAnswer`   — set by admin; empty string = result not yet declared
   *   - `resultDeclared`  — true when correctAnswer is non-empty
   *   - `userAnswer`      — the option text the user selected (may be null)
   *   - `isCorrect`       — null while undeclared; true/false after declaration
   *   - `distribution`    — option → { count, pct } map for the bar chart
   *
   * The top-level `resultDeclared` flag is true when every question in the
   * competition has a non-empty correctAnswer.
   */
  async adminFindPredictionSubmissions(opts: {
    competitionId?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const page  = Math.max(1, opts.page  ?? 1);
    const limit = Math.min(200, Math.max(1, opts.limit ?? 50));
    const skip  = (page - 1) * limit;

    // ── 1. Submissions (prediction type only) ─────────────────────────────
    const qb = this.submissionRepo
      .createQueryBuilder('s')
      .leftJoinAndSelect('s.competition', 'c')
      .where('c.type = :type', { type: CompetitionType.PREDICTION })
      .orderBy('s.createdAt', 'DESC')
      .skip(skip)
      .take(limit);

    if (opts.competitionId) {
      qb.andWhere('s.competitionId = :cid', { cid: opts.competitionId });
    }
    if (opts.search) {
      qb.andWhere('CAST(s.userId AS text) ILIKE :search', {
        search: `%${opts.search}%`,
      });
    }

    const [rows, total] = await qb.getManyAndCount();

    // ── 2. Questions for competitions present in results ───────────────────
    const compIds = [...new Set(rows.map((r) => r.competitionId))];
    const questions = compIds.length
      ? await this.questionRepo
          .createQueryBuilder('q')
          .where('q.competitionId IN (:...ids)', { ids: compIds })
          .getMany()
      : [];

    const questionsByComp = new Map<string, typeof questions>();
    for (const q of questions) {
      if (!questionsByComp.has(q.competitionId)) questionsByComp.set(q.competitionId, []);
      questionsByComp.get(q.competitionId)!.push(q);
    }

    // ── 3. Build option distribution per competition per question ──────────
    // distribution[competitionId][questionId][optionText] = count
    type DistMap = Record<string, Record<string, Record<string, number>>>;
    const dist: DistMap = {};

    for (const s of rows) {
      const cid = s.competitionId;
      if (!dist[cid]) dist[cid] = {};
      for (const [qid, chosen] of Object.entries(s.answers ?? {})) {
        if (!dist[cid][qid]) dist[cid][qid] = {};
        dist[cid][qid][chosen] = (dist[cid][qid][chosen] ?? 0) + 1;
      }
    }

    // ── 4. Stats (total + unique + accuracy) ──────────────────────────────
    const statsQb = this.submissionRepo
      .createQueryBuilder('s')
      .leftJoin('s.competition', 'c')
      .where('c.type = :type', { type: CompetitionType.PREDICTION });

    if (opts.competitionId) {
      statsQb.andWhere('s.competitionId = :cid', { cid: opts.competitionId });
    }

    const [totalAll, uniqueCount] = await Promise.all([
      statsQb.clone().getCount(),
      statsQb.clone()
        .select('COUNT(DISTINCT s.userId)', 'cnt')
        .getRawOne() as Promise<{ cnt: string }>,
    ]);

    // ── 5. Build question distribution DTOs ───────────────────────────────
    // Collect all questions across loaded competitions for the distribution panel
    const questionDtos = questions.map((q) => {
      const totalVotes = Object.values(dist[q.competitionId]?.[q.id] ?? {}).reduce((a, v) => a + v, 0);
      const options = q.options.map((opt) => {
        const count = dist[q.competitionId]?.[q.id]?.[opt] ?? 0;
        return {
          option: opt,
          count,
          pct:    totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0,
          isCorrect: q.correctAnswer ? opt === q.correctAnswer : null,
        };
      });
      return {
        id:              q.id,
        competitionId:   q.competitionId,
        question:        q.question,
        options,
        correctAnswer:   q.correctAnswer || null,
        resultDeclared:  !!q.correctAnswer,
        totalVotes,
      };
    });

    // ── 6. Map submission rows ─────────────────────────────────────────────
    const data = rows.map((s) => {
      const qs       = questionsByComp.get(s.competitionId) ?? [];
      const resultDeclared = qs.length > 0 && qs.every((q) => !!q.correctAnswer);

      const questionResults = qs.map((q) => {
        const userAnswer  = s.answers?.[q.id] ?? null;
        const isCorrect   = q.correctAnswer
          ? userAnswer === q.correctAnswer
          : null; // null = pending
        return {
          questionId:     q.id,
          question:       q.question,
          userAnswer,
          correctAnswer:  q.correctAnswer || null,
          isCorrect,
          resultDeclared: !!q.correctAnswer,
        };
      });

      // Primary prediction result (first question)
      const primary   = questionResults[0] ?? null;
      const allCorrect = resultDeclared && questionResults.every((r) => r.isCorrect === true);
      const anyWrong   = resultDeclared && questionResults.some((r)  => r.isCorrect === false);

      return {
        id:              s.id,
        userId:          s.userId,
        competitionId:   s.competitionId,
        competition: s.competition ? {
          id:    s.competition.id,
          title: s.competition.title,
          slug:  s.competition.slug,
        } : null,
        selectedOption:  primary?.userAnswer  ?? null,
        correctAnswer:   primary?.correctAnswer ?? null,
        isCorrect:       primary?.isCorrect   ?? null,
        resultDeclared:  resultDeclared,
        allCorrect,
        anyWrong,
        questionResults,
        status:          s.status,
        createdAt:       s.createdAt.toISOString(),
      };
    });

    // Accuracy: % of submissions where every answered question was correct
    const declared = data.filter((d) => d.resultDeclared);
    const correct  = declared.filter((d) => d.allCorrect).length;
    const accuracy = declared.length ? Math.round((correct / declared.length) * 100) : null;

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
      stats: {
        totalSubmissions:  totalAll,
        uniqueParticipants: parseInt(uniqueCount?.cnt ?? '0', 10),
        correctPredictions: correct,
        accuracy,
        resultDeclared:     declared.length > 0,
      },
      questions: questionDtos,
    };
  }

  /**
   * Set (or clear) the correct answer for a prediction question.
   *
   * Pass an empty string to "un-declare" the result.
   * The competitionId is validated to prevent cross-competition tampering.
   */
  async adminSetQuestionCorrectAnswer(
    competitionId: string,
    questionId: string,
    correctAnswer: string,
  ) {
    const question = await this.questionRepo.findOne({
      where: { id: questionId, competitionId },
    });
    if (!question) {
      throw new NotFoundException(
        `Question ${questionId} not found in competition ${competitionId}.`,
      );
    }
    if (correctAnswer && !question.options.includes(correctAnswer)) {
      throw new BadRequestException(
        `"${correctAnswer}" is not one of the available options: ${question.options.join(', ')}.`,
      );
    }
    await this.questionRepo.update(questionId, { correctAnswer: correctAnswer ?? '' });
    return { questionId, correctAnswer: correctAnswer || null, resultDeclared: !!correctAnswer };
  }

  /**
   * Update a single submission's moderation status.
   * 'active' | 'disqualified' | 'winner'
   */
  async adminUpdateSubmissionStatus(
    id: string,
    status: 'active' | 'approved' | 'rejected' | 'disqualified' | 'winner',
  ) {
    const sub = await this.submissionRepo.findOne({ where: { id }, relations: ['competition'] });
    if (!sub) throw new NotFoundException(`Submission ${id} not found.`);

    await this.submissionRepo.update(id, { status });
    return { ...sub, status, createdAt: sub.createdAt.toISOString() };
  }
}
