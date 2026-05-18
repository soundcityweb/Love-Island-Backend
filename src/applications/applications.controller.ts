import {
  BadRequestException,
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  UseGuards,
  UseInterceptors,
  UploadedFiles,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express/multer';
import { AdminGuard } from '../common/guards/admin.guard';
import { ApplicationsService } from './applications.service';
import { CreateApplicationDto } from './dto/create-application.dto';
import { ListApplicationsQueryDto } from './dto/list-applications-query.dto';
import { UpdateApplicationStatusDto } from './dto/update-application-status.dto';
import type { UploadedFile, UploadedFilesMap } from './types/multer-file.interface';

const ALLOWED_IMAGE_MIMES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

@Controller('applications')
export class ApplicationsController {
  constructor(private readonly applicationsService: ApplicationsService) {}

  /**
   * POST /api/applications — public endpoint for show applicants.
   * Images: max 5 × 10 MB each. Video: max 1 × 100 MB.
   */
  @Post()
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'images', maxCount: 5 },
        { name: 'video', maxCount: 1 },
      ],
      {
        limits: {
          fileSize: 100 * 1024 * 1024, // per-file ceiling; per-type enforcement below
        },
        fileFilter(
          _req: unknown,
          file: UploadedFile,
          cb: (err: Error | null, accept: boolean) => void,
        ) {
          if (file.fieldname === 'images') {
            if (!ALLOWED_IMAGE_MIMES.has(file.mimetype)) {
              return cb(
                new BadRequestException(
                  `"${file.originalname}" is not an accepted image type. ` +
                    'Allowed: JPEG, PNG, WebP, GIF.',
                ),
                false,
              );
            }
            if (file.size > 10 * 1024 * 1024) {
              return cb(
                new BadRequestException(
                  `"${file.originalname}" exceeds the 10 MB per-image limit.`,
                ),
                false,
              );
            }
          } else if (file.fieldname === 'video') {
            if (!file.mimetype.startsWith('video/')) {
              return cb(
                new BadRequestException(
                  `"${file.originalname}" is not an accepted video type.`,
                ),
                false,
              );
            }
            if (file.size > 100 * 1024 * 1024) {
              return cb(
                new BadRequestException(
                  `"${file.originalname}" exceeds the 100 MB video limit.`,
                ),
                false,
              );
            }
          }
          cb(null, true);
        },
      },
    ),
  )
  create(
    @Body() dto: CreateApplicationDto,
    @UploadedFiles() files: UploadedFilesMap,
  ) {
    return this.applicationsService.createWithMedia(dto, files);
  }

  /** GET /api/applications — admin-only: list all applicants. */
  @Get()
  @UseGuards(AdminGuard)
  list(@Query() query: ListApplicationsQueryDto) {
    return this.applicationsService.findAll(query);
  }

  /** GET /api/applications/:id — admin-only: fetch a single application. */
  @Get(':id')
  @UseGuards(AdminGuard)
  getById(@Param('id', ParseUUIDPipe) id: string) {
    return this.applicationsService.findOne(id);
  }

  /** PATCH /api/applications/:id/status — admin-only: approve or reject. */
  @Patch(':id/status')
  @UseGuards(AdminGuard)
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateApplicationStatusDto,
  ) {
    return this.applicationsService.updateStatus(id, dto.status);
  }
}
