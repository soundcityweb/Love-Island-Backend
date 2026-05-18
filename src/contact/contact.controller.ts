import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { ContactService } from './contact.service';
import { CreateContactDto } from './dto/create-contact.dto';

@Controller('contact')
export class ContactController {
  constructor(private readonly contactService: ContactService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @UseInterceptors(
    FileInterceptor('attachment', {
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  async submit(
    @Body() dto: CreateContactDto,
    @UploadedFile() file: { buffer: Buffer; mimetype: string; size: number } | undefined,
    @Req() req: Request,
  ) {
    return this.contactService.submit(dto, file, req);
  }
}
