import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CreateScheduleDto } from './dto/create-schedule.dto';
import { QueryScheduleDto } from './dto/query-schedule.dto';
import { UpdateScheduleDto } from './dto/update-schedule.dto';
import { ScheduleService } from './schedule.service';

@Controller('schedule')
export class ScheduleController {
  constructor(private readonly scheduleService: ScheduleService) {}

  /** POST /api/schedule */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateScheduleDto) {
    return this.scheduleService.create(dto);
  }

  /** PATCH /api/schedule/:id */
  @Patch(':id')
  update(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateScheduleDto,
  ) {
    return this.scheduleService.update(id, dto);
  }

  /** DELETE /api/schedule/:id */
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  remove(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.scheduleService.remove(id);
  }

  /** GET /api/schedule/episodes — grouped by episode_number */
  @Get('episodes')
  findByEpisodes(@Query() query: QueryScheduleDto) {
    return this.scheduleService.findEpisodesRoute(query);
  }

  /** GET /api/schedule/weekly — Monday–Sunday buckets */
  @Get('weekly')
  findWeekly(@Query() query: QueryScheduleDto) {
    return this.scheduleService.findWeeklyRoute(query);
  }

  /** GET /api/schedule/today — today’s slots by start_time */
  @Get('today')
  findToday(@Query() query: QueryScheduleDto) {
    return this.scheduleService.findTodayTimeline(query);
  }

  /**
   * GET /api/schedule
   * Query: view=daily|weekly|episode (default daily), optional date, optional platform.
   */
  @Get()
  find(@Query() query: QueryScheduleDto) {
    return this.scheduleService.findWithView(query);
  }
}
