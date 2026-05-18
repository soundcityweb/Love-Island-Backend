import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PodcastEpisode } from '../entities/podcast-episode.entity';
import { AdminPodcastsController } from './admin-podcasts.controller';
import { PodcastsController } from './podcasts.controller';
import { PodcastsService } from './podcasts.service';

@Module({
  imports: [TypeOrmModule.forFeature([PodcastEpisode])],
  controllers: [PodcastsController, AdminPodcastsController],
  providers: [PodcastsService],
  exports: [PodcastsService],
})
export class PodcastModule {}
