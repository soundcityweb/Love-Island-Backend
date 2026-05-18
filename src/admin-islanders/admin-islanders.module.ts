import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Islander } from '../entities/islander.entity';
import { IslanderMedia } from '../entities/islander-media.entity';
import { AdminIslandersController } from './admin-islanders.controller';
import { AdminIslandersService } from './admin-islanders.service';

@Module({
  imports: [TypeOrmModule.forFeature([Islander, IslanderMedia])],
  controllers: [AdminIslandersController],
  providers: [AdminIslandersService],
})
export class AdminIslandersModule {}
