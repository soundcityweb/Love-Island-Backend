import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Headers,
  BadRequestException,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CompetitionsService } from './competitions.service';
import { WinnerSelectionService } from './winner-selection.service';
import { SubmitAnswersDto } from './dto/submit-answers.dto';
import { CreateCompetitionDto } from './dto/create-competition.dto';
import { ListCompetitionsDto } from './dto/list-competitions.dto';
import { AdminGuard } from '../common/guards/admin.guard';

/**
 * Public Competitions REST API.
 *
 * GET    /api/competitions              — paginated list with optional filters
 * GET    /api/competitions/:slug        — single competition metadata
 * GET    /api/competitions/:slug/questions  — quiz questions (active only, no answers)
 * GET    /api/competitions/:slug/results    — aggregated result stats
 * POST   /api/competitions              — create competition (admin-key required)
 * POST   /api/competitions/:slug/submit — submit quiz answers (1 per user, rate-limited)
 */
@Controller('competitions')
export class CompetitionsController {
  constructor(
    private readonly competitions: CompetitionsService,
    private readonly winnerSelection: WinnerSelectionService,
  ) {}

  // ── List ──────────────────────────────────────────────────────────────────

  /**
   * Returns a paginated list of non-draft competitions.
   *
   * Query parameters:
   *   page   — page number (default 1)
   *   limit  — items per page (default 20, max 100)
   *   status — filter by competition status (active | upcoming | completed)
   *   type   — filter by type (quiz | poll | prediction | upload)
   *   search — partial, case-insensitive match on title / description
   *
   * Response envelope:
   *   { data: Competition[], meta: { total, page, limit, totalPages, hasNext, hasPrev } }
   */
  @Get()
  findAll(@Query() query: ListCompetitionsDto) {
    return this.competitions.findAll(query);
  }

  // ── Single Competition ────────────────────────────────────────────────────

  /**
   * Returns metadata for a single competition by slug.
   * Questions are NOT embedded here — use GET /:slug/questions.
   * Returns 404 for draft competitions.
   */
  @Get(':slug')
  findOne(@Param('slug') slug: string) {
    return this.competitions.findBySlug(slug);
  }

  // ── Questions ─────────────────────────────────────────────────────────────

  /**
   * Returns ordered quiz questions (no correctAnswer) for an active competition.
   * Restricted to active competitions to prevent pre-loading answers early.
   */
  @Get(':slug/questions')
  getQuestions(@Param('slug') slug: string) {
    return this.competitions.findQuestions(slug);
  }

  // ── Results ───────────────────────────────────────────────────────────────

  /**
   * Returns aggregated result statistics for a non-draft competition.
   *
   * Includes total submissions, average score, pass rate, and a score
   * distribution histogram. Safe for public consumption — no user IDs exposed.
   */
  @Get(':slug/results')
  getResults(@Param('slug') slug: string) {
    return this.competitions.getResults(slug);
  }

  // ── Winners ───────────────────────────────────────────────────────────────

  /**
   * Returns the ranked winners for a completed competition.
   * User identities are anonymised — only a short handle is exposed.
   * Returns 404 if the competition is a draft or has no winners yet.
   */
  @Get(':slug/winners')
  getWinners(@Param('slug') slug: string) {
    return this.winnerSelection.getWinners(slug);
  }

  // ── Create (admin) ────────────────────────────────────────────────────────

  /**
   * Creates a new competition with optional questions.
   * Requires a valid X-Admin-Key header.
   *
   * Returns the full admin competition detail including generated ID and slug.
   * Responds 201 Created.
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(AdminGuard)
  create(@Body() dto: CreateCompetitionDto) {
    return this.competitions.adminCreate(dto);
  }

  // ── Submit ────────────────────────────────────────────────────────────────

  /**
   * Submit quiz answers for an active competition.
   *
   * Rate-limited to 5 attempts per minute per IP (throttler).
   * One submission is allowed per X-Session-Id per competition:
   *   - Redis fast-path check before hitting the DB.
   *   - DB unique constraint as hard enforcement / race condition guard.
   *
   * Returns { score, total, passed, results[] } on success.
   * Returns 409 if already submitted, 429 if throttled or Redis flag set.
   */
  @Post(':slug/submit')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  submit(
    @Param('slug') slug: string,
    @Body() dto: SubmitAnswersDto,
    @Headers('x-session-id') sessionId: string | undefined,
  ) {
    if (!sessionId?.trim()) {
      throw new BadRequestException(
        'X-Session-Id header is required to submit answers.',
      );
    }
    return this.competitions.submitAnswers(slug, sessionId.trim(), dto);
  }
}
