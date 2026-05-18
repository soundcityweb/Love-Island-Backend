import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { Competition } from '../entities/competition.entity';
import { Question } from '../entities/question.entity';
import { Submission } from '../entities/submission.entity';
import { CompetitionWinner } from '../entities/competition-winner.entity';
import { CompetitionsService } from './competitions.service';
import { WinnerSelectionService } from './winner-selection.service';
import { CompetitionsController } from './competitions.controller';
import { AdminCompetitionsController } from './admin-competitions.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Competition, Question, Submission, CompetitionWinner]),
    /**
     * ScheduleModule.forRoot() initialises the NestJS task-scheduler.
     * It must be registered in exactly one module in the application.
     * We register it here rather than AppModule to keep the competitions
     * feature self-contained. If another module also uses @Cron decorators
     * in the future, move forRoot() to AppModule.
     */
    ScheduleModule.forRoot(),
  ],
  controllers: [
    CompetitionsController,
    AdminCompetitionsController,
  ],
  providers: [
    CompetitionsService,
    WinnerSelectionService,
  ],
  exports: [
    CompetitionsService,
    WinnerSelectionService,
  ],
})
export class CompetitionsModule {}
