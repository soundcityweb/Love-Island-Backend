import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ConfigModule } from './config/config.module';
import { DatabaseModule } from './database/database.module';
import { ApplicationsModule } from './applications/applications.module';
import { IslandersModule } from './islanders/islanders.module';
import { AdminIslandersModule } from './admin-islanders/admin-islanders.module';
import { LandingModule } from './landing/landing.module';
import { RedisModule } from './redis/redis.module';
import { VotingModule } from './voting/voting.module';
import { AdminVotingEventsModule } from './admin-voting-events/admin-voting-events.module';
import { ProductsModule } from './products/products.module';
import { OrdersModule } from './orders/orders.module';
import { PaymentsModule } from './payments/payments.module';
import { AdminProductsModule } from './admin-products/admin-products.module';
import { ArticlesModule } from './articles/articles.module';
import { NewsletterModule } from './newsletter/newsletter.module';
import { VideosModule } from './videos/videos.module';
import { AdminDashboardModule } from './admin-dashboard/admin-dashboard.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { AnalyticsMiddleware } from './analytics/analytics.middleware';
import { CloudinaryModule } from './common/cloudinary/cloudinary.module';
import { CommonModule } from './common/common.module';
import {
  AdminApiKeyMiddleware,
  AdminSectionApiKeyMiddleware,
} from './common/middleware/admin-api-key.middleware';
import { PodcastModule } from './podcast/podcast.module';
import { PrismaModule } from './prisma/prisma.module';
import { ScheduleModule } from './schedule/schedule.module';
import { AdminSchedulesController } from './schedule/admin-schedules.controller';
import { AdminPodcastsController } from './podcast/admin-podcasts.controller';
import { PodcastsController } from './podcast/podcasts.controller';
import { AdminArticlesController } from './articles/admin-articles.controller';
import { AdminVotingEventsController } from './admin-voting-events/admin-voting-events.controller';
import { AdminDashboardController } from './admin-dashboard/admin-dashboard.controller';
import { AdminLandingController } from './landing/admin-landing.controller';
import { AdminIslandersController } from './admin-islanders/admin-islanders.controller';
import { AdminVideosController } from './videos/admin-videos.controller';
import { AdminOrdersController } from './orders/admin-orders.controller';
import { AdminProductsController } from './admin-products/admin-products.controller';
import { CategoriesModule } from './categories/categories.module';
import { AdminCategoriesController } from './categories/admin-categories.controller';
import { CouponsModule } from './coupons/coupons.module';
import { AdminCouponsController } from './coupons/admin-coupons.controller';
import { CompetitionsModule } from './competitions/competitions.module';
import { AdminCompetitionsController } from './competitions/admin-competitions.controller';
import { SubmissionsModule } from './submissions/submissions.module';
import { AdminSubmissionsController } from './submissions/submissions.controller';
import { AuthModule } from './auth/auth.module';
import { CmsPagesModule } from './cms-pages/cms-pages.module';
import { ContactModule } from './contact/contact.module';
import { AdminContactController } from './contact/admin-contact.controller';

@Module({
  imports: [
    // Rate limiting: 60 requests per IP per 60 s globally.
    // Tighter per-route limits can be applied with @Throttle().
    // The Paystack webhook uses @SkipThrottle() since it is server-to-server.
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 60 }]),
    CommonModule,
    ConfigModule,
    DatabaseModule,
    PrismaModule,
    RedisModule,
    // Public content
    ApplicationsModule,
    IslandersModule,
    LandingModule,
    ArticlesModule,
    NewsletterModule,
    VideosModule,
    PodcastModule,
    ScheduleModule,
    CmsPagesModule,
    ContactModule,
    // Voting
    VotingModule,
    AdminVotingEventsModule,
    // Merch & orders
    ProductsModule,
    OrdersModule,
    PaymentsModule,
    AdminProductsModule,
    CategoriesModule,
    CouponsModule,
    // Competitions
    CompetitionsModule,
    SubmissionsModule,
    // CMS admin
    AdminIslandersModule,
    AdminDashboardModule,
    // Analytics
    AnalyticsModule,
    // Cloudinary (global — available to all modules)
    CloudinaryModule,
    // Auth (JWT login for admin panel)
    AuthModule,
  ],
  controllers: [],
  providers: [
    // Applies ThrottlerGuard globally to all routes.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    AdminApiKeyMiddleware,
    AdminSectionApiKeyMiddleware,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(AnalyticsMiddleware).forRoutes('*');
    consumer
      .apply(AdminSectionApiKeyMiddleware)
      .forRoutes(
        AdminArticlesController,
        AdminVotingEventsController,
        AdminDashboardController,
        AdminLandingController,
        AdminIslandersController,
        AdminVideosController,
        AdminOrdersController,
        AdminProductsController,
        AdminCategoriesController,
        AdminCouponsController,
        AdminCompetitionsController,
        AdminSubmissionsController,
        AdminPodcastsController,
        AdminSchedulesController,
        AdminContactController,
      );
    consumer.apply(AdminApiKeyMiddleware).forRoutes(PodcastsController);
  }
}
