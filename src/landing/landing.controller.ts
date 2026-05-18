import { Controller, Get } from '@nestjs/common';
import { LandingService } from './landing.service';
import { LandingContentDto } from './dto/landing-content-response.dto';

@Controller('landing')
export class LandingController {
  constructor(private readonly landingService: LandingService) {}

  @Get()
  getContent(): Promise<LandingContentDto> {
    return this.landingService.getLandingContent();
  }
}
