import {
  BadRequestException,
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
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ArticlesService } from './articles.service';
import { CreateArticleDto } from './dto/create-article.dto';
import { UpdateArticleDto } from './dto/update-article.dto';
import { ListArticlesQueryDto } from './dto/list-articles-query.dto';

@Controller('admin/articles')
export class AdminArticlesController {
  constructor(private readonly articlesService: ArticlesService) {}

  /** GET /api/admin/articles — all articles (including unpublished) */
  @Get()
  findAll(@Query() query: ListArticlesQueryDto) {
    return this.articlesService.findAll(query);
  }

  /** POST /api/admin/articles/cover — upload cover image to Cloudinary */
  @Post('cover')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  uploadCover(
    @UploadedFile() file: { buffer: Buffer; mimetype: string } | undefined,
  ) {
    if (!file) {
      throw new BadRequestException('No image file provided.');
    }
    return this.articlesService.uploadCover(file);
  }

  /** POST /api/admin/articles */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateArticleDto) {
    return this.articlesService.create(dto);
  }

  /** PATCH /api/admin/articles/:id */
  @Patch(':id')
  update(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateArticleDto,
  ) {
    return this.articlesService.update(id, dto);
  }

  /** PATCH /api/admin/articles/:id/toggle-published */
  @Patch(':id/toggle-published')
  togglePublished(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.articlesService.togglePublished(id);
  }

  /** DELETE /api/admin/articles/:id */
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  remove(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.articlesService.remove(id);
  }
}
