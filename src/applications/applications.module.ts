import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Application } from '../entities/application.entity';
import { ApplicationMedia } from '../entities/application-media.entity';
import { Islander } from '../entities/islander.entity';
import { IslanderMedia } from '../entities/islander-media.entity';
import { ApplicationsController } from './applications.controller';
import { ApplicationsService } from './applications.service';
import { IslandersModule } from '../islanders/islanders.module';
import { AnalyticsModule } from '../analytics/analytics.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Application, ApplicationMedia, Islander, IslanderMedia]),
    IslandersModule,
    AnalyticsModule,
  ],
  controllers: [ApplicationsController],
  providers: [ApplicationsService],
  exports: [ApplicationsService],
})
export class ApplicationsModule {}
