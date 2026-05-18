import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CmsPage } from '../entities/cms-page.entity';
import { CmsPagesController } from './cms-pages.controller';
import { CmsPagesService } from './cms-pages.service';
import { AdminGuard } from '../common/guards/admin.guard';

@Module({
  imports: [TypeOrmModule.forFeature([CmsPage])],
  controllers: [CmsPagesController],
  providers: [CmsPagesService, AdminGuard],
  exports: [CmsPagesService],
})
export class CmsPagesModule {}
