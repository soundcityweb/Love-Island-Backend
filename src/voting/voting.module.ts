import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Vote } from '../entities/vote.entity';
import { VotingPeriod } from '../entities/voting-period.entity';
import { VotingEventContestant } from '../entities/voting-event-contestant.entity';
import { VotingEventResult } from '../entities/voting-event-result.entity';
import { RedisModule } from '../redis/redis.module';
import { VoteController, VotingController, VotingEventsController } from './voting.controller';
import { VotingService } from './voting.service';
import { VotingPreviewTokenService } from './voting-preview-token.service';
import { VotingGuard } from '../common/guards/voting.guard';
import { VotingEventEmitter } from './voting-events';
import { VotingEventsListener } from './voting-events.listener';
import { AnalyticsModule } from '../analytics/analytics.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Vote, VotingPeriod, VotingEventContestant, VotingEventResult]),
    RedisModule,
    AnalyticsModule,
  ],
  controllers: [VoteController, VotingController, VotingEventsController],
  providers: [
    VotingGuard,
    VotingPreviewTokenService,
    VotingService,
    VotingEventsListener,
    {
      provide: VotingEventEmitter,
      useFactory: () => new VotingEventEmitter(),
    },
  ],
  exports: [VotingService, VotingPreviewTokenService],
})
export class VotingModule {}
