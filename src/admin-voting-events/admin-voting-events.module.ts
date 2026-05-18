import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Vote } from '../entities/vote.entity';
import { VotingPeriod } from '../entities/voting-period.entity';
import { VotingEventContestant } from '../entities/voting-event-contestant.entity';
import { VotingEventResult } from '../entities/voting-event-result.entity';
import { Islander } from '../entities/islander.entity';
import { VotingModule } from '../voting/voting.module';
import { AdminVotingEventsController } from './admin-voting-events.controller';
import { AdminVotingEventsService } from './admin-voting-events.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Vote, VotingPeriod, VotingEventContestant, VotingEventResult, Islander]),
    VotingModule,
  ],
  controllers: [AdminVotingEventsController],
  providers: [AdminVotingEventsService],
})
export class AdminVotingEventsModule {}
