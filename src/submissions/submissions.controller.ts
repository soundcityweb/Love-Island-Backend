import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { SubmissionsService } from './submissions.service';
import { ListSubmissionsDto } from './dto/list-submissions.dto';
import { UpdateStatusDto } from './dto/update-status.dto';
import { SelectWinnersDto } from './dto/select-winners.dto';

// ─────────────────────────────────────────────────────────────────────────────
// Controller 1 — /admin/submissions
// Direct submission operations (not scoped by competition in the URL)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Submission-centric admin API.
 *
 * GET  /admin/submissions               — paginated list with full filters
 * GET  /admin/submissions/:id           — single submission + user info
 * PATCH /admin/submissions/:id/status   — approve / reject / disqualify / winner
 */
@Controller('admin/submissions')
export class AdminSubmissionsController {
  constructor(private readonly service: SubmissionsService) {}

  /**
   * Paginated, filtered list of all submissions across every competition.
   *
   * Query params:
   *   competitionId, type, status, search, dateFrom, dateTo,
   *   sortBy (createdAt|score|status), sortDir (ASC|DESC), page, limit
   *
   * Response includes aggregate stats (totalSubmissions, uniqueParticipants,
   * avgScore, statusCounts) covering the full unfiltered-by-pagination set.
   */
  @Get()
  findAll(@Query() dto: ListSubmissionsDto) {
    return this.service.findAll(dto);
  }

  /**
   * Single submission detail with full user info (userId + userHandle).
   */
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOne(id);
  }

  /**
   * Update the moderation status of a single submission.
   *
   * Body: { status: "active" | "approved" | "rejected" | "disqualified" | "winner" }
   *
   * Returns the updated submission DTO.
   */
  @Patch(':id/status')
  @HttpCode(HttpStatus.OK)
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateStatusDto,
  ) {
    return this.service.updateStatus(id, dto.status);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Controller 2 — /admin/competitions  (submission + winner sub-routes only)
// These routes are scoped by competition UUID or are submission collection routes.
// Competition CRUD lives in AdminCompetitionsController (competitions module).
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Competition-scoped submission and winner admin API.
 *
 * GET  /admin/competitions/submissions                        — global list
 * GET  /admin/competitions/quiz-submissions                   — quiz-enriched
 * GET  /admin/competitions/prediction-submissions             — prediction-enriched
 * GET  /admin/competitions/poll-results                       — poll aggregates
 * GET  /admin/competitions/upload-submissions                 — upload gallery
 * PATCH /admin/competitions/submissions/:id/status            — status update (alt path)
 * POST  /admin/competitions/winners/process                   — trigger cron sweep
 *
 * GET  /admin/competitions/:id/submissions                    — scoped list
 * GET  /admin/competitions/:id/results                        — aggregated results
 * GET  /admin/competitions/:id/winners                        — winner list
 * POST /admin/competitions/:id/winners                        — unified select
 * POST /admin/competitions/:id/winners/select                 — auto-select
 * POST /admin/competitions/:id/winners/manual                 — manual select
 * DELETE /admin/competitions/:id/winners                      — clear winners
 */
@Controller('admin/competitions')
export class CompetitionSubmissionsController {
  constructor(private readonly service: SubmissionsService) {}

  // ── Collection-level submission routes ────────────────────────────────────

  /**
   * Global paginated list. Accepts same filters as /admin/submissions.
   * Provided so the existing frontend URL (/admin/competitions/submissions) keeps working.
   */
  @Get('submissions')
  listAll(@Query() dto: ListSubmissionsDto) {
    return this.service.findAll(dto);
  }

  /** Quiz-enriched view: per-question correctness, scores, leaderboard. */
  @Get('quiz-submissions')
  listQuiz(
    @Query('competitionId') competitionId?: string,
    @Query('search')        search?: string,
    @Query('page')          page?: string,
    @Query('limit')         limit?: string,
  ) {
    return this.service.findQuizSubmissions({
      competitionId,
      search,
      page:  page  ? parseInt(page,  10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  /** Prediction view: option distribution, correctness after result declared. */
  @Get('prediction-submissions')
  listPredictions(
    @Query('competitionId') competitionId?: string,
    @Query('search')        search?: string,
    @Query('page')          page?: string,
    @Query('limit')         limit?: string,
  ) {
    return this.service.findPredictionSubmissions({
      competitionId,
      search,
      page:  page  ? parseInt(page,  10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  /** Poll aggregates: vote counts, percentages, winner per question. */
  @Get('poll-results')
  listPolls(@Query('competitionId') competitionId?: string) {
    return this.service.findPollResults(competitionId);
  }

  /** Upload gallery: entry URLs, media type, caption, per-status counts. */
  @Get('upload-submissions')
  listUploads(
    @Query('competitionId') competitionId?: string,
    @Query('status')        status?: string,
    @Query('search')        search?: string,
    @Query('page')          page?: string,
    @Query('limit')         limit?: string,
  ) {
    return this.service.findUploadSubmissions({
      competitionId,
      status,
      search,
      page:  page  ? parseInt(page,  10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  /**
   * Alternate status-update path kept for backward compat with any
   * existing frontend code that uses /admin/competitions/submissions/:id/status.
   */
  @Patch('submissions/:id/status')
  @HttpCode(HttpStatus.OK)
  updateStatusAlt(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateStatusDto,
  ) {
    return this.service.updateStatus(id, dto.status);
  }

  /**
   * Manually trigger the expired-competition cron sweep.
   * Returns { processed, skipped, competitions[] }.
   */
  @Post('winners/process')
  @HttpCode(HttpStatus.OK)
  processExpired() {
    return this.service.processExpiredCompetitions();
  }

  // ── Competition-scoped routes — must be declared BEFORE :id catch-all ────

  /**
   * Aggregated results for a single competition.
   *
   * Poll       → per-option vote counts + % per question
   * Prediction → same as poll + correctAnswer highlight
   * Quiz       → score distribution + per-question stats
   * Upload     → submission counts grouped by status
   */
  @Get(':id/results')
  getResults(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.getResults(id);
  }

  /**
   * All submissions for one competition, paginated and filterable.
   * Same response shape as the global list but scoped to `:id`.
   */
  @Get(':id/submissions')
  listByCompetition(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() dto: ListSubmissionsDto,
  ) {
    return this.service.findAll({ ...dto, competitionId: id });
  }

  /** Get current winners (admin view — includes raw userId). */
  @Get(':id/winners')
  getWinners(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.getWinners(id);
  }

  /**
   * Unified winner selection.
   *
   * Body (auto):   { mode: "auto",   count?: number }
   * Body (manual): { mode: "manual", userIds: string[] }
   *
   * Marks the competition as completed and persists ranked winners.
   * Always overwrites any existing winners — call DELETE first to inspect.
   */
  @Post(':id/winners')
  @HttpCode(HttpStatus.OK)
  selectWinners(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SelectWinnersDto,
  ) {
    return this.service.selectWinners(id, dto);
  }

  /** Force-run auto-selection (no body required). */
  @Post(':id/winners/select')
  @HttpCode(HttpStatus.OK)
  autoSelect(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('count') count?: number,
  ) {
    return this.service.forceAutoSelect(id, count);
  }

  /** Manual winner assignment from an ordered userId array. */
  @Post(':id/winners/manual')
  @HttpCode(HttpStatus.OK)
  manualSelect(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('userIds') userIds: string[],
  ) {
    return this.service.manualSelect(id, userIds);
  }

  /**
   * Clear all winners for a competition without changing its status.
   * Allows re-running winner selection after a competition is completed.
   */
  @Delete(':id/winners')
  @HttpCode(HttpStatus.OK)
  clearWinners(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.clearWinners(id);
  }
}
