import { Controller, Get, Param } from '@nestjs/common';
import { VideosService } from './videos.service';

@Controller('videos')
export class VideosController {
  constructor(private readonly videosService: VideosService) {}

  /** GET /api/videos */
  @Get()
  findAll() {
    return this.videosService.findAllPublished();
  }

  /** GET /api/videos/:slug */
  @Get(':slug')
  findOne(@Param('slug') slug: string) {
    return this.videosService.findPublishedBySlug(slug);
  }
}
