import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  StreamableFile,
} from '@nestjs/common';
import { AdminVotingEventsService } from './admin-voting-events.service';
import { CreateVotingEventDto } from './dto/create-voting-event.dto';
import { UpdateVotingEventDto } from './dto/update-voting-event.dto';
import { AddContestantsDto } from './dto/add-contestants.dto';

@Controller('admin/voting-events')
export class AdminVotingEventsController {
  constructor(private readonly adminVotingEventsService: AdminVotingEventsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateVotingEventDto) {
    return this.adminVotingEventsService.create(dto);
  }

  /** CSV or Excel export of vote totals per islander (admin). */
  @Get(':id/export')
  async exportVotingResults(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Query('format') formatRaw?: string,
  ): Promise<StreamableFile> {
    const format = formatRaw === 'xlsx' ? 'xlsx' : 'csv';
    const { buffer, filename, mimeType } =
      await this.adminVotingEventsService.buildVotingExport(id, format);
    return new StreamableFile(buffer, {
      type: mimeType,
      disposition: `attachment; filename="${filename}"`,
    });
  }

  @Get(':id/analytics')
  getAnalytics(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return this.adminVotingEventsService.getAnalytics(id);
  }

  @Get(':id')
  findOne(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.adminVotingEventsService.findOne(id);
  }

  @Patch(':id/open')
  open(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.adminVotingEventsService.open(id);
  }

  @Patch(':id/close')
  close(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.adminVotingEventsService.close(id);
  }

  @Patch(':id/publish-results')
  publishResults(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.adminVotingEventsService.publishResults(id);
  }

  @Patch(':id')
  update(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateVotingEventDto,
  ) {
    return this.adminVotingEventsService.update(id, dto);
  }

  @Get(':id/results')
  getResults(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.adminVotingEventsService.getResults(id);
  }

  @Post(':id/contestants')
  @HttpCode(HttpStatus.CREATED)
  addContestants(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: AddContestantsDto,
  ) {
    return this.adminVotingEventsService.addContestants(id, dto);
  }

  /** Mint a short-lived token for the public /vote preview URL (draft events only). */
  @Post(':id/preview-token')
  @HttpCode(HttpStatus.CREATED)
  mintPreviewToken(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return this.adminVotingEventsService.createPreviewToken(id);
  }
}
