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
} from '@nestjs/common';
import { PodcastsService } from './podcasts.service';
import { CreatePodcastEpisodeDto } from './dto/create-podcast-episode.dto';
import { UpdatePodcastEpisodeDto } from './dto/update-podcast-episode.dto';

@Controller('podcasts')
export class PodcastsController {
  constructor(private readonly podcastsService: PodcastsService) {}

  /** GET /api/podcasts — published episodes only */
  @Get()
  findAllPublished() {
    return this.podcastsService.findAllPublished();
  }

  /** GET /api/podcasts/:slug — single published episode */
  @Get(':slug')
  findPublishedBySlug(@Param('slug') slug: string) {
    return this.podcastsService.findPublishedBySlug(slug);
  }

  /** POST /api/podcasts */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreatePodcastEpisodeDto) {
    return this.podcastsService.create(dto);
  }

  /** PATCH /api/podcasts/:id */
  @Patch(':id')
  update(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdatePodcastEpisodeDto,
  ) {
    return this.podcastsService.update(id, dto);
  }

  /** DELETE /api/podcasts/:id */
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  remove(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.podcastsService.remove(id);
  }
}
