import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
} from '@nestjs/common';
import { LandingService } from './landing.service';

@Controller('admin/landing')
export class AdminLandingController {
  constructor(private readonly landingService: LandingService) {}

  /** GET /api/admin/landing — all sections with their raw JSON content */
  @Get()
  findAll() {
    return this.landingService.getAllSections();
  }

  /**
   * PATCH /api/admin/landing/:key
   * Merge-patch a single landing section.
   * Body: free-form JSON object matching the section schema.
   */
  @Patch(':key')
  updateSection(
    @Param('key') key: string,
    @Body() content: Record<string, unknown>,
  ) {
    return this.landingService.upsertSection(key, content);
  }
}
