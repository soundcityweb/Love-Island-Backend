import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository } from 'typeorm';
import { CloudinaryService } from '../common/cloudinary/cloudinary.service';
import { NewsletterService } from '../newsletter/newsletter.service';
import { Article, ArticleCategory } from '../entities/article.entity';
import { CreateArticleDto } from './dto/create-article.dto';
import { UpdateArticleDto } from './dto/update-article.dto';
import { ListArticlesQueryDto } from './dto/list-articles-query.dto';

export interface PaginatedArticles {
  data: Article[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

@Injectable()
export class ArticlesService {
  private readonly logger = new Logger(ArticlesService.name);

  constructor(
    @InjectRepository(Article)
    private readonly repo: Repository<Article>,
    private readonly cloudinary: CloudinaryService,
    private readonly newsletterService: NewsletterService,
  ) {}

  // ── Public ────────────────────────────────────────────────────────────────

  async findAllPublished(query: ListArticlesQueryDto): Promise<PaginatedArticles> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;

    const qb = this.repo
      .createQueryBuilder('a')
      .where('a.isPublished = true')
      .orderBy('a.publishedAt', 'DESC')
      .addOrderBy('a.createdAt', 'DESC')
      .skip(skip)
      .take(limit);

    if (query.category) {
      qb.andWhere('a.category = :category', { category: query.category });
    }

    const [data, total] = await qb.getManyAndCount();

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findPublishedBySlug(slug: string): Promise<Article> {
    const article = await this.repo.findOne({ where: { slug, isPublished: true } });
    if (!article) throw new NotFoundException(`Article "${slug}" not found.`);
    return article;
  }

  // ── Admin ─────────────────────────────────────────────────────────────────

  async findAll(query: ListArticlesQueryDto): Promise<PaginatedArticles> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;

    const qb = this.repo
      .createQueryBuilder('a')
      .orderBy('a.createdAt', 'DESC')
      .skip(skip)
      .take(limit);

    if (query.category) {
      qb.andWhere('a.category = :category', { category: query.category });
    }

    const [data, total] = await qb.getManyAndCount();

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async create(dto: CreateArticleDto): Promise<Article> {
    const slug = await this.resolveSlug(dto.slug, dto.title);

    const isPublished = dto.isPublished ?? false;
    let publishedAt = dto.publishedAt ? new Date(dto.publishedAt) : null;
    if (isPublished && !publishedAt) {
      publishedAt = new Date();
    }

    const article = this.repo.create({
      slug,
      title: dto.title,
      excerpt: dto.excerpt ?? null,
      content: dto.content ?? null,
      category: dto.category ?? ArticleCategory.NEWS,
      author: dto.author ?? null,
      coverImage: dto.coverImage ?? null,
      isPublished,
      publishedAt,
      readTimeMinutes: dto.readTimeMinutes ?? null,
      metaTitle: dto.metaTitle ?? null,
      metaDescription: dto.metaDescription ?? null,
      keywords: dto.keywords ?? null,
    });

    try {
      const saved = await this.repo.save(article);
      if (saved.isPublished) {
        void this.newsletterService.notifyNewArticlePublished(saved).catch((e) => {
          this.logger.error(`Newsletter notify failed after article create (${saved.slug})`, e);
        });
      }
      return saved;
    } catch (err) {
      this.rethrowDbError(err);
    }
  }

  async uploadCover(
    file: { buffer: Buffer; mimetype: string } | undefined,
  ): Promise<{ url: string }> {
    if (!file?.buffer?.length) {
      throw new BadRequestException('No image file provided.');
    }
    if (!file.mimetype?.startsWith('image/')) {
      throw new BadRequestException('File must be an image.');
    }
    const { secureUrl } = await this.cloudinary.uploadBuffer(file.buffer, 'articles', 'image');
    return { url: secureUrl };
  }

  async update(id: string, _dto: UpdateArticleDto): Promise<Article> {
    const dto = _dto as Partial<CreateArticleDto>;
    const article = await this.findOneOrFail(id);
    const wasPublished = article.isPublished;

    if (dto.slug !== undefined || (dto.title !== undefined && dto.title !== article.title)) {
      article.slug = await this.resolveSlug(dto.slug, dto.title ?? article.title, id);
    }

    if (dto.title !== undefined) article.title = dto.title;
    if (dto.excerpt !== undefined) article.excerpt = dto.excerpt ?? null;
    if (dto.content !== undefined) article.content = dto.content ?? null;
    if (dto.category !== undefined) article.category = dto.category;
    if (dto.author !== undefined) article.author = dto.author ?? null;
    if (dto.coverImage !== undefined) article.coverImage = dto.coverImage ?? null;
    if (dto.isPublished !== undefined) {
      article.isPublished = dto.isPublished;
      if (dto.isPublished && !article.publishedAt) {
        article.publishedAt = new Date();
      }
    }
    if (dto.publishedAt !== undefined) {
      article.publishedAt = dto.publishedAt ? new Date(dto.publishedAt) : null;
    }
    if (dto.readTimeMinutes !== undefined) article.readTimeMinutes = dto.readTimeMinutes ?? null;
    if (dto.metaTitle !== undefined) article.metaTitle = dto.metaTitle ?? null;
    if (dto.metaDescription !== undefined) article.metaDescription = dto.metaDescription ?? null;
    if (dto.keywords !== undefined) article.keywords = dto.keywords ?? null;

    try {
      const saved = await this.repo.save(article);
      if (saved.isPublished && !wasPublished) {
        void this.newsletterService.notifyNewArticlePublished(saved).catch((e) => {
          this.logger.error(`Newsletter notify failed after article update (${saved.slug})`, e);
        });
      }
      return saved;
    } catch (err) {
      this.rethrowDbError(err);
    }
  }

  async remove(id: string): Promise<{ deleted: true; id: string }> {
    const article = await this.findOneOrFail(id);
    await this.repo.remove(article);
    return { deleted: true, id };
  }

  async togglePublished(id: string): Promise<Article> {
    const article = await this.findOneOrFail(id);
    const wasPublished = article.isPublished;
    article.isPublished = !article.isPublished;
    if (article.isPublished && !article.publishedAt) {
      article.publishedAt = new Date();
    }
    const saved = await this.repo.save(article);
    if (saved.isPublished && !wasPublished) {
      void this.newsletterService.notifyNewArticlePublished(saved).catch((e) => {
        this.logger.error(`Newsletter notify failed after toggle publish (${saved.slug})`, e);
      });
    }
    return saved;
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private async findOneOrFail(id: string): Promise<Article> {
    const article = await this.repo.findOne({ where: { id } });
    if (!article) throw new NotFoundException(`Article with id "${id}" not found.`);
    return article;
  }

  private async resolveSlug(
    explicit: string | undefined,
    title: string,
    excludeId?: string,
  ): Promise<string> {
    if (explicit !== undefined) {
      const s = sanitiseSlug(explicit);
      if (!s) throw new BadRequestException('slug produced an empty string.');
      await this.assertUnique(s, excludeId);
      return s;
    }
    return this.uniqueSlugFromTitle(title, excludeId);
  }

  private async uniqueSlugFromTitle(title: string, excludeId?: string): Promise<string> {
    const base = slugify(title);
    let candidate = base;
    let n = 1;
    while (await this.slugExists(candidate, excludeId)) {
      candidate = `${base}-${n++}`;
    }
    return candidate;
  }

  private async slugExists(slug: string, excludeId?: string): Promise<boolean> {
    const where = excludeId ? { slug, id: Not(excludeId) } : { slug };
    return (await this.repo.count({ where })) > 0;
  }

  private async assertUnique(slug: string, excludeId?: string): Promise<void> {
    if (await this.slugExists(slug, excludeId)) {
      throw new ConflictException(`Slug "${slug}" is already in use.`);
    }
  }

  private rethrowDbError(err: unknown): never {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('UQ_articles_slug') || msg.includes('unique constraint')) {
      throw new ConflictException('An article with that slug already exists.');
    }
    throw err;
  }
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '') || 'article';
}

function sanitiseSlug(raw: string): string {
  return raw
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}
