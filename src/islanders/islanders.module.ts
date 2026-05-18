import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Islander } from '../entities/islander.entity';
import { IslanderMedia } from '../entities/islander-media.entity';
import { IslandersController } from './islanders.controller';
import { IslandersService } from './islanders.service';

@Module({
  imports: [TypeOrmModule.forFeature([Islander, IslanderMedia])],
  controllers: [IslandersController],
  providers: [IslandersService],
  exports: [IslandersService],
})
export class IslandersModule {}
