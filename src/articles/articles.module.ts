import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Article } from '../entities/article.entity';
import { ArticlesController } from './articles.controller';
import { AdminArticlesController } from './admin-articles.controller';
import { ArticlesService } from './articles.service';
import { NewsletterModule } from '../newsletter/newsletter.module';

@Module({
  imports: [TypeOrmModule.forFeature([Article]), NewsletterModule],
  controllers: [ArticlesController, AdminArticlesController],
  providers: [ArticlesService],
  exports: [ArticlesService],
})
export class ArticlesModule {}
