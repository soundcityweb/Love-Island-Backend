import { Module } from '@nestjs/common';
import { AdminSchedulesController } from './admin-schedules.controller';
import { ScheduleController } from './schedule.controller';
import { ScheduleService } from './schedule.service';

@Module({
  imports: [],
  controllers: [ScheduleController, AdminSchedulesController],
  providers: [ScheduleService],
  exports: [ScheduleService],
})
export class ScheduleModule {}
