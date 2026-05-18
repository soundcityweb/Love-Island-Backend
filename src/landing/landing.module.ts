import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LandingSection } from '../entities/landing-section.entity';
import { LandingController } from './landing.controller';
import { AdminLandingController } from './admin-landing.controller';
import { LandingService } from './landing.service';

@Module({
  imports: [TypeOrmModule.forFeature([LandingSection])],
  controllers: [LandingController, AdminLandingController],
  providers: [LandingService],
  exports: [LandingService],
})
export class LandingModule {}
