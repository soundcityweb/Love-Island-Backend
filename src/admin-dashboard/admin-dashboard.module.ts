import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Islander } from '../entities/islander.entity';
import { Article } from '../entities/article.entity';
import { Video } from '../entities/video.entity';
import { Product } from '../entities/product.entity';
import { Order } from '../entities/order.entity';
import { Application } from '../entities/application.entity';
import { Vote } from '../entities/vote.entity';
import { VotingPeriod } from '../entities/voting-period.entity';
import { LandingSection } from '../entities/landing-section.entity';

import { AdminDashboardController } from './admin-dashboard.controller';
import { AdminDashboardService } from './admin-dashboard.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Islander,
      Article,
      Video,
      Product,
      Order,
      Application,
      Vote,
      VotingPeriod,
      LandingSection,
    ]),
  ],
  controllers: [AdminDashboardController],
  providers: [AdminDashboardService],
})
export class AdminDashboardModule {}
