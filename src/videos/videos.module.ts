import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Video } from '../entities/video.entity';
import { VideosController } from './videos.controller';
import { AdminVideosController } from './admin-videos.controller';
import { VideosService } from './videos.service';

@Module({
  imports: [TypeOrmModule.forFeature([Video])],
  controllers: [VideosController, AdminVideosController],
  providers: [VideosService],
  exports: [VideosService],
})
export class VideosModule {}
