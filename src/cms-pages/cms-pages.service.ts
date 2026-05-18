import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CmsPage, CmsPageStatus } from '../entities/cms-page.entity';
import { UpdateCmsPageDto } from './dto/update-cms-page.dto';
import { RedisService } from '../redis/redis.service';

const CACHE_PREFIX = 'cms:page:';
const CACHE_TTL_SECONDS = 300;

/** System pages: title is fixed (matches admin UI). */
const TITLE_LOCKED_SLUGS = new Set(['privacy-policy', 'terms-conditions']);

@Injectable()
export class CmsPagesService {
  constructor(
    @InjectRepository(CmsPage)
    private readonly repo: Repository<CmsPage>,
    private readonly redis: RedisService,
  ) {}

  private cacheKey(slug: string): string {
    return `${CACHE_PREFIX}${slug}`;
  }

  async findAllForAdmin(): Promise<CmsPage[]> {
    return this.repo.find({ order: { title: 'ASC' } });
  }

  async findBySlugPublished(slug: string): Promise<CmsPage> {
    const cached = this.redis.isAvailable()
      ? await this.redis.get(this.cacheKey(slug))
      : null;
    if (cached) {
      try {
        const parsed = JSON.parse(cached) as CmsPage;
        if (parsed?.status === CmsPageStatus.PUBLISHED) {
          return parsed;
        }
      } catch {
        /* ignore bad cache */
      }
    }

    const page = await this.repo.findOne({ where: { slug } });
    if (!page || page.status !== CmsPageStatus.PUBLISHED) {
      throw new NotFoundException('Page not found.');
    }

    if (this.redis.isAvailable()) {
      await this.redis.set(
        this.cacheKey(slug),
        JSON.stringify(page),
        CACHE_TTL_SECONDS,
      );
    }

    return page;
  }

  async update(id: string, dto: UpdateCmsPageDto): Promise<CmsPage> {
    const trimmed = dto.content?.trim() ?? '';
    if (!trimmed || trimmed.replace(/<[^>]*>/g, '').trim().length === 0) {
      throw new BadRequestException('Content cannot be empty.');
    }

    const page = await this.repo.findOne({ where: { id } });
    if (!page) {
      throw new NotFoundException('Page not found.');
    }

    const prevSlug = page.slug;

    if (dto.title !== undefined && dto.title !== page.title) {
      if (TITLE_LOCKED_SLUGS.has(page.slug)) {
        throw new BadRequestException('Title cannot be changed for this system page.');
      }
      page.title = dto.title;
    }
    page.content = dto.content;
    page.metaTitle = dto.metaTitle ?? null;
    page.metaDescription = dto.metaDescription ?? null;
    page.status = dto.status;

    const saved = await this.repo.save(page);

    if (this.redis.isAvailable()) {
      await this.redis.del(this.cacheKey(prevSlug));
      if (prevSlug !== saved.slug) {
        await this.redis.del(this.cacheKey(saved.slug));
      }
    }

    return saved;
  }
}
