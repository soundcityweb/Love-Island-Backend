import {
  Controller,
  Get,
  Put,
  Body,
  Param,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { CmsPagesService } from './cms-pages.service';
import { AdminGuard } from '../common/guards/admin.guard';
import { UpdateCmsPageDto } from './dto/update-cms-page.dto';

/**
 * Public: GET :slug (published only, cached).
 * Admin (X-Admin-Key): GET / (all pages), PUT /:id.
 */
@Controller('cms/pages')
export class CmsPagesController {
  constructor(private readonly cmsPagesService: CmsPagesService) {}

  @Get()
  @UseGuards(AdminGuard)
  findAllAdmin() {
    return this.cmsPagesService.findAllForAdmin();
  }

  @Get(':slug')
  findBySlug(@Param('slug') slug: string) {
    return this.cmsPagesService.findBySlugPublished(slug);
  }

  @Put(':id')
  @UseGuards(AdminGuard)
  update(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateCmsPageDto,
  ) {
    return this.cmsPagesService.update(id, dto);
  }
}
