import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Submission } from '../entities/submission.entity';
import { Competition } from '../entities/competition.entity';
import { CompetitionsModule } from '../competitions/competitions.module';
import { SubmissionsService } from './submissions.service';
import { AdminSubmissionsController } from './submissions.controller';

/**
 * SubmissionsModule
 *
 * Owns the /admin/submissions routes (direct submission lookup + status update).
 * All /admin/competitions/* routes — including submission list, winner selection,
 * and results — live in AdminCompetitionsController (CompetitionsModule) so that
 * NestJS registers literal paths before the /:id catch-all in one controller.
 *
 * Imports CompetitionsModule to reuse CompetitionsService and WinnerSelectionService.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Submission, Competition]),
    CompetitionsModule,
  ],
  controllers: [AdminSubmissionsController],
  providers:   [SubmissionsService],
  exports:     [SubmissionsService],
})
export class SubmissionsModule {}
