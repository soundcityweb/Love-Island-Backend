import { Controller, Get, Param } from '@nestjs/common';
import { IslandersService } from './islanders.service';
import { IslanderListItemDto, IslanderDetailDto } from './dto/islander-response.dto';

@Controller('islanders')
export class IslandersController {
  constructor(private readonly islandersService: IslandersService) {}

  @Get()
  findAll(): Promise<IslanderListItemDto[]> {
    return this.islandersService.findAllPublic();
  }

  @Get(':slug')
  findOne(@Param('slug') slug: string): Promise<IslanderDetailDto> {
    return this.islandersService.findOneBySlug(slug);
  }
}
