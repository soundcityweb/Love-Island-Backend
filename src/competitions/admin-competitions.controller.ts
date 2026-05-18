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
import { CompetitionsService } from './competitions.service';
import { WinnerSelectionService } from './winner-selection.service';
import { CreateCompetitionDto } from './dto/create-competition.dto';
import { UpdateCompetitionDto, UpdateCompetitionStatusDto } from './dto/update-competition.dto';
import { ListSubmissionsDto, UpdateSubmissionStatusDto } from './dto/admin-submissions.dto';

/**
 * Admin Competitions API — guarded by AdminSectionApiKeyMiddleware.
 *
 * ALL admin/competitions routes live here so that NestJS registers
 * literal paths (e.g. /submissions, /upload-submissions) before the
 * parameterised /:id catch-all.  Splitting them across modules would
 * cause the literal routes to be shadowed by /:id + ParseUUIDPipe
 * because CompetitionsModule always initialises before any module that
 * imports it.
 *
 * Submission & winner business logic lives in SubmissionsService
 * (SubmissionsModule).  The service methods called here are on
 * CompetitionsService and WinnerSelectionService to keep the dependency
 * graph acyclic — those services already own the full implementation.
 */
@Controller('admin/competitions')
export class AdminCompetitionsController {
  constructor(
    private readonly competitions: CompetitionsService,
    private readonly winnerSelection: WinnerSelectionService,
  ) {}

  // ══════════════════════════════════════════════════════════════════════════
  // Competition list
  // ══════════════════════════════════════════════════════════════════════════

  /** All competitions including drafts, newest first. */
  @Get()
  findAll() {
    return this.competitions.adminFindAll();
  }

  // ══════════════════════════════════════════════════════════════════════════
  // Literal collection routes
  // MUST be declared before any /:id route so they are matched first.
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Global paginated submission list.
   * Filters: competitionId, type, status, search, dateFrom, dateTo, page, limit.
   */
  @Get('submissions')
  listSubmissions(@Query() dto: ListSubmissionsDto) {
    return this.competitions.adminFindSubmissions(dto);
  }

  /** Quiz-enriched view: per-question correctness, scores, leaderboard. */
  @Get('quiz-submissions')
  listQuizSubmissions(
    @Query('competitionId') competitionId?: string,
    @Query('search')        search?: string,
    @Query('page')          page?: string,
    @Query('limit')         limit?: string,
  ) {
    return this.competitions.adminFindQuizSubmissions({
      competitionId,
      search,
      page:  page  ? parseInt(page,  10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  /** Prediction view: option distribution, correctness after result declared. */
  @Get('prediction-submissions')
  listPredictionSubmissions(
    @Query('competitionId') competitionId?: string,
    @Query('search')        search?: string,
    @Query('page')          page?: string,
    @Query('limit')         limit?: string,
  ) {
    return this.competitions.adminFindPredictionSubmissions({
      competitionId,
      search,
      page:  page  ? parseInt(page,  10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  /** Poll aggregates: vote counts + % per option per question. */
  @Get('poll-results')
  getPollResults(@Query('competitionId') competitionId?: string) {
    return this.competitions.adminFindPollResults(competitionId);
  }

  /**
   * Upload-gallery view: entry URL, media type, caption, per-status counts.
   * Filters: competitionId, status, search, page, limit.
   */
  @Get('upload-submissions')
  listUploadSubmissions(
    @Query('competitionId') competitionId?: string,
    @Query('status')        status?: string,
    @Query('search')        search?: string,
    @Query('page')          page?: string,
    @Query('limit')         limit?: string,
  ) {
    return this.competitions.adminFindUploadSubmissions({
      competitionId,
      status,
      search,
      page:  page  ? parseInt(page,  10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  /**
   * Update a submission's moderation status.
   * Body: { status: "active" | "approved" | "rejected" | "disqualified" | "winner" }
   */
  @Patch('submissions/:id/status')
  @HttpCode(HttpStatus.OK)
  updateSubmissionStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSubmissionStatusDto,
  ) {
    return this.competitions.adminUpdateSubmissionStatus(id, dto.status);
  }

  /**
   * Manually trigger the expired-competition cron sweep.
   * Returns { processed, skipped, competitions[] }.
   */
  @Post('winners/process')
  @HttpCode(HttpStatus.OK)
  processExpiredCompetitions() {
    return this.winnerSelection.processExpiredCompetitions();
  }

  // ══════════════════════════════════════════════════════════════════════════
  // Parametric routes — /:id sub-routes before bare /:id
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Full aggregated results for any competition type (poll / prediction /
   * quiz / upload).  Returns per-option vote distributions and stats.
   */
  @Get(':id/results')
  getResultsById(@Param('id', ParseUUIDPipe) id: string) {
    return this.competitions.adminGetResultsById(id);
  }

  /**
   * Set (or clear) the correct answer for a prediction question.
   * Body: { correctAnswer: "option text" | "" }
   */
  @Patch(':id/questions/:questionId')
  @HttpCode(HttpStatus.OK)
  setQuestionCorrectAnswer(
    @Param('id',         ParseUUIDPipe) competitionId: string,
    @Param('questionId', ParseUUIDPipe) questionId:    string,
    @Body('correctAnswer') correctAnswer: string,
  ) {
    return this.competitions.adminSetQuestionCorrectAnswer(
      competitionId,
      questionId,
      correctAnswer ?? '',
    );
  }

  /**
   * All submissions for one competition (generic, paginated).
   * Accepts the same query filters as GET /submissions.
   */
  @Get(':id/submissions')
  listByCompetition(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() dto: ListSubmissionsDto,
  ) {
    return this.competitions.adminFindSubmissions({ ...dto, competitionId: id });
  }

  /** Current winners for a competition (admin view — raw userId exposed). */
  @Get(':id/winners')
  getWinners(@Param('id', ParseUUIDPipe) id: string) {
    return this.winnerSelection.adminGetWinners(id);
  }

  /**
   * Unified winner selection.
   *
   * Body (auto):   { mode: "auto",   count?: number }
   * Body (manual): { mode: "manual", userIds: string[] }
   *
   * Overwrites existing winners and marks the competition completed.
   */
  @Post(':id/winners')
  @HttpCode(HttpStatus.OK)
  selectWinners(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('mode')    mode:    'auto' | 'manual',
    @Body('userIds') userIds: string[] | undefined,
    @Body('count')   count:   number  | undefined,
  ) {
    if (mode === 'manual') {
      return this.winnerSelection.adminManualSelectWinners(id, userIds ?? []);
    }
    return this.winnerSelection.adminForceSelect(id, count);
  }

  /** Force-run auto-selection (no body required). */
  @Post(':id/winners/select')
  @HttpCode(HttpStatus.OK)
  forceSelectWinners(@Param('id', ParseUUIDPipe) id: string) {
    return this.winnerSelection.adminForceSelect(id);
  }

  /** Manual winner assignment from an ordered userId array (index 0 = rank 1). */
  @Post(':id/winners/manual')
  @HttpCode(HttpStatus.OK)
  manualSelectWinners(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('userIds') userIds: string[],
  ) {
    return this.winnerSelection.adminManualSelectWinners(id, userIds);
  }

  /**
   * Clear all winners without changing competition status.
   * Allows re-running selection after a competition is completed.
   */
  @Delete(':id/winners')
  @HttpCode(HttpStatus.OK)
  clearWinners(@Param('id', ParseUUIDPipe) id: string) {
    return this.winnerSelection.adminClearWinners(id);
  }

  /**
   * Change competition status.
   * Body: { status: "draft" | "active" | "upcoming" | "completed" }
   */
  @Patch(':id/status')
  @HttpCode(HttpStatus.OK)
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCompetitionStatusDto,
  ) {
    return this.competitions.adminUpdateStatus(id, dto);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // Bare /:id — must be last so it doesn't shadow any of the above
  // ══════════════════════════════════════════════════════════════════════════

  /** Single competition with all questions and submission count. */
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.competitions.adminFindById(id);
  }

  /**
   * Create a competition.
   * Pass `questions[]` to seed questions at creation time.
   */
  @Post()
  create(@Body() dto: CreateCompetitionDto) {
    return this.competitions.adminCreate(dto);
  }

  /**
   * Update competition metadata.
   * If `questions` is included the entire set is replaced atomically.
   */
  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCompetitionDto,
  ) {
    return this.competitions.adminUpdate(id, dto);
  }

  /** Hard-delete a competition — cascades to questions and submissions. */
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.competitions.adminDelete(id);
  }
}
