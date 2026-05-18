import { Controller, Get, Param, Query } from '@nestjs/common';
import { ArticlesService } from './articles.service';
import { ListArticlesQueryDto } from './dto/list-articles-query.dto';

/** Public read-only article API. */
@Controller('articles')
export class ArticlesController {
  constructor(private readonly articlesService: ArticlesService) {}

  /** GET /api/articles?page=1&limit=10&category=News */
  @Get()
  findAll(@Query() query: ListArticlesQueryDto) {
    return this.articlesService.findAllPublished(query);
  }

  /** GET /api/articles/:slug */
  @Get(':slug')
  findOne(@Param('slug') slug: string) {
    return this.articlesService.findPublishedBySlug(slug);
  }
}
