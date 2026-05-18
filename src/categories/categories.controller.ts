import { Controller, Get } from '@nestjs/common';
import { CategoriesService } from './categories.service';

@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  /** List all active categories (public). */
  @Get()
  findAll() {
    return this.categoriesService.findAllActive();
  }
}
