import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { ContactService } from './contact.service';
import { ListContactMessagesDto } from './dto/list-contact-messages.dto';
import { ReplyContactDto } from './dto/reply-contact.dto';
import { UpdateContactStatusDto } from './dto/update-contact-status.dto';

@Controller('admin/contact-messages')
export class AdminContactController {
  constructor(private readonly contactService: ContactService) {}

  @Get('stats')
  stats() {
    return this.contactService.statsNewCount();
  }

  @Get('analytics')
  analytics() {
    return this.contactService.analyticsSummary();
  }

  @Get('export/csv')
  async exportCsv(
    @Query() query: ListContactMessagesDto,
    @Res({ passthrough: false }) res: Response,
  ) {
    const csv = await this.contactService.exportCsv(query);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="contact-messages.csv"');
    res.send(`\uFEFF${csv}`);
  }

  @Get()
  list(@Query() query: ListContactMessagesDto) {
    return this.contactService.listAdmin(query);
  }

  @Get(':id')
  one(@Param('id', ParseUUIDPipe) id: string) {
    return this.contactService.findOneAdmin(id);
  }

  @Patch(':id/status')
  patchStatus(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateContactStatusDto) {
    return this.contactService.updateStatus(id, dto);
  }

  @Post(':id/reply')
  reply(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ReplyContactDto) {
    return this.contactService.reply(id, dto);
  }
}
