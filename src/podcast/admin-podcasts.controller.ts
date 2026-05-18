import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { PodcastsService } from './podcasts.service';

@Controller('admin/podcasts')
export class AdminPodcastsController {
  constructor(private readonly podcastsService: PodcastsService) {}

  @Get()
  findAll() {
    return this.podcastsService.findAllAdmin();
  }

  @Get(':id')
  findOne(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.podcastsService.findById(id);
  }
}
