import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Islander } from '../entities/islander.entity';
import { IslanderListItemDto, IslanderDetailDto } from './dto/islander-response.dto';

@Injectable()
export class IslandersService {
  constructor(
    @InjectRepository(Islander)
    private readonly islanderRepository: Repository<Islander>,
  ) {}

  async findAllPublic(): Promise<IslanderListItemDto[]> {
    const islanders = await this.islanderRepository.find({
      where: { isPublic: true },
      order: { displayOrder: 'ASC' },
      select: [
        'id',
        'slug',
        'firstName',
        'lastName',
        'age',
        'location',
        'tagline',
        'profileImage',
        'profileStatusLabel',
        'status',
      ],
    });

    return islanders.map((islander) => ({
      id: islander.id,
      slug: islander.slug,
      firstName: islander.firstName,
      lastName: islander.lastName,
      age: islander.age,
      location: islander.location,
      tagline: islander.tagline,
      profileImage: islander.profileImage,
      profileStatusLabel: islander.profileStatusLabel,
      status: islander.status,
    }));
  }

  async findOneBySlug(slug: string): Promise<IslanderDetailDto> {
    const islander = await this.islanderRepository.findOne({
      where: { slug, isPublic: true },
      relations: { media: true },
    });

    if (!islander) {
      throw new NotFoundException(`Islander with slug "${slug}" not found or not public`);
    }

    const media = (islander.media ?? []).map((m) => ({
      type: m.type,
      storageKey: m.storageKey,
      displayOrder: m.displayOrder,
      altText: m.altText,
    }));

    return {
      id: islander.id,
      slug: islander.slug,
      firstName: islander.firstName,
      lastName: islander.lastName,
      age: islander.age,
      location: islander.location,
      tagline: islander.tagline,
      profileImage: islander.profileImage,
      profileStatusLabel: islander.profileStatusLabel,
      status: islander.status,
      occupation: islander.occupation,
      bio: islander.bio,
      lookingFor: islander.lookingFor,
      coverImage: islander.coverImage,
      funFacts: islander.funFacts,
      socialLinks: islander.socialLinks,
      metaTitle: islander.metaTitle,
      metaDescription: islander.metaDescription,
      ogImage: islander.ogImage,
      twitterImage: islander.twitterImage,
      keywords: islander.keywords,
      media,
      createdAt: islander.createdAt,
      updatedAt: islander.updatedAt,
    };
  }
}
