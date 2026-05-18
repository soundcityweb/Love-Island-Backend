import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  Req,
  Param,
  ParseUUIDPipe,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import type { Request } from 'express';
import { VotingGuard } from '../common/guards/voting.guard';
import { VotingService } from './voting.service';
import { CastVoteDto } from './dto/cast-vote.dto';

/**
 * POST /api/vote — cast a vote in the active voting event.
 * VotingGuard runs first: validates session_id, hashes IP, enforces rate limit per IP. 1 vote per session per event in service.
 */
@Controller('vote')
export class VoteController {
  constructor(private readonly votingService: VotingService) {}

  @Post()
  @UseGuards(VotingGuard)
  async vote(@Body() dto: CastVoteDto, @Req() req: Request) {
    const sessionId = req.votingSessionId!;
    return this.votingService.castVote(dto, sessionId);
  }
}

@Controller('votes')
export class VotingController {
  constructor(private readonly votingService: VotingService) {}

  /**
   * Cast a vote (alias for POST /vote). Requires VotingGuard: X-Session-Id header.
   */
  @Post()
  @UseGuards(VotingGuard)
  async castVote(@Body() dto: CastVoteDto, @Req() req: Request) {
    return this.votingService.castVote(dto, req.votingSessionId!);
  }

  /**
   * Get the current active voting period plus server time (for client countdown sync).
   */
  @Get('periods/current')
  async getCurrentPeriod() {
    const period = await this.votingService.getCurrentPeriod();
    return {
      period,
      serverNow: new Date().toISOString(),
    };
  }

  /**
   * List all voting periods.
   */
  @Get('periods')
  async listPeriods() {
    return this.votingService.listPeriods();
  }

  /**
   * Get vote results (count per islander) for a period.
   */
  @Get('results')
  async getResults(@Query('periodId', ParseUUIDPipe) periodId: string) {
    return this.votingService.getResults(periodId);
  }
}

/**
 * GET /api/voting-events/:id/results — public vote aggregation (count per islander).
 * 403 if event status !== CLOSED or results not public. Read-only; does not modify votes.
 */
@Controller('voting-events')
export class VotingEventsController {
  constructor(private readonly votingService: VotingService) {}

  /**
   * Draft event snapshot for public preview. Requires signed token from admin.
   */
  @Get(':id/preview')
  async getPreview(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('token') token: string,
  ) {
    if (!token?.trim()) {
      throw new BadRequestException('Preview token is required.');
    }
    return this.votingService.getDraftPreview(id, token.trim());
  }

  @Get(':id/contestants')
  async getContestants(@Param('id', ParseUUIDPipe) id: string) {
    return this.votingService.getContestantsForEvent(id);
  }

  @Get(':id/results')
  async getResults(@Param('id', ParseUUIDPipe) id: string) {
    return this.votingService.getPublicResults(id);
  }
}
