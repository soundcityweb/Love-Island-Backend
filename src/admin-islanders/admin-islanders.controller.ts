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
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express/multer';
import { AdminIslandersService } from './admin-islanders.service';
import { CreateIslanderDto } from './dto/create-islander.dto';
import { UpdateIslanderDto } from './dto/update-islander.dto';
import { IslanderMediaType } from '../entities/islander-media.entity';

@Controller('admin/islanders')
export class AdminIslandersController {
  constructor(private readonly adminIslandersService: AdminIslandersService) {}

  /** GET /api/admin/islanders — all islanders (public + private) */
  @Get()
  findAll() {
    return this.adminIslandersService.findAll();
  }

  /** GET /api/admin/islanders/:id */
  @Get(':id')
  findOne(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.adminIslandersService.findOne(id);
  }

  /** POST /api/admin/islanders */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateIslanderDto) {
    return this.adminIslandersService.create(dto);
  }

  /** PATCH /api/admin/islanders/:id */
  @Patch(':id')
  update(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateIslanderDto,
  ) {
    return this.adminIslandersService.update(id, dto);
  }

  /** PATCH /api/admin/islanders/:id/toggle-public */
  @Patch(':id/toggle-public')
  togglePublic(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.adminIslandersService.togglePublic(id);
  }

  /** DELETE /api/admin/islanders/:id */
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  remove(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.adminIslandersService.remove(id);
  }

  /**
   * POST /api/admin/islanders/:id/media
   * Upload images for an islander's gallery.
   */
  @Post(':id/media')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(
    FilesInterceptor('files', 10, {
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  uploadMedia(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @UploadedFiles() files: { originalname: string; buffer: Buffer; mimetype: string; size: number }[],
  ) {
    return this.adminIslandersService.uploadMedia(id, files ?? [], IslanderMediaType.GALLERY);
  }

  /** DELETE /api/admin/islanders/media/:mediaId */
  @Delete('media/:mediaId')
  @HttpCode(HttpStatus.OK)
  removeMedia(@Param('mediaId', new ParseUUIDPipe({ version: '4' })) mediaId: string) {
    return this.adminIslandersService.removeMedia(mediaId);
  }
}
