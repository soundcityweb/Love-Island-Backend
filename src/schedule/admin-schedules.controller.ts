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
import { UpdateScheduleDto } from './dto/update-schedule.dto';
import { ScheduleService } from './schedule.service';

@Controller('admin/schedules')
export class AdminSchedulesController {
  constructor(private readonly scheduleService: ScheduleService) {}

  /** GET /api/admin/schedules */
  @Get()
  findAll(@Query('limit') limit?: string) {
    const n = limit ? parseInt(limit, 10) : undefined;
    return this.scheduleService.findAllAdmin(
      Number.isFinite(n) ? n : undefined,
    );
  }

  /** POST /api/admin/schedules */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateScheduleDto) {
    return this.scheduleService.create(dto);
  }

  /** PATCH /api/admin/schedules/:id/toggle-published */
  @Patch(':id/toggle-published')
  togglePublished(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return this.scheduleService.togglePublished(id);
  }

  /** PATCH /api/admin/schedules/:id */
  @Patch(':id')
  update(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateScheduleDto,
  ) {
    return this.scheduleService.update(id, dto);
  }

  /** DELETE /api/admin/schedules/:id */
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  remove(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.scheduleService.remove(id);
  }
}
