import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository } from 'typeorm';
import { Video } from '../entities/video.entity';
import { CreateVideoDto } from './dto/create-video.dto';
import { UpdateVideoDto } from './dto/update-video.dto';

@Injectable()
export class VideosService {
  constructor(
    @InjectRepository(Video)
    private readonly repo: Repository<Video>,
  ) {}

  // ── Public ────────────────────────────────────────────────────────────────

  async findAllPublished(): Promise<Video[]> {
    return this.repo.find({
      where: { isPublished: true },
      order: { displayOrder: 'ASC', createdAt: 'DESC' },
    });
  }

  async findPublishedBySlug(slug: string): Promise<Video> {
    const video = await this.repo.findOne({ where: { slug, isPublished: true } });
    if (!video) throw new NotFoundException(`Video "${slug}" not found.`);
    return video;
  }

  // ── Admin ─────────────────────────────────────────────────────────────────

  async findAll(): Promise<Video[]> {
    return this.repo.find({ order: { displayOrder: 'ASC', createdAt: 'DESC' } });
  }

  async create(dto: CreateVideoDto): Promise<Video> {
    const slug = await this.resolveSlug(dto.slug, dto.title);

    const video = this.repo.create({
      slug,
      title: dto.title,
      description: dto.description ?? null,
      embedUrl: dto.embedUrl,
      thumbnail: dto.thumbnail ?? null,
      duration: dto.duration ?? null,
      tag: dto.tag ?? null,
      isPublished: dto.isPublished ?? false,
      displayOrder: dto.displayOrder ?? 0,
    });

    try {
      return await this.repo.save(video);
    } catch (err) {
      this.rethrowDbError(err);
    }
  }

  async update(id: string, _dto: UpdateVideoDto): Promise<Video> {
    const dto = _dto as Partial<CreateVideoDto>;
    const video = await this.findOneOrFail(id);

    if (dto.slug !== undefined || (dto.title !== undefined && dto.title !== video.title)) {
      video.slug = await this.resolveSlug(dto.slug, dto.title ?? video.title, id);
    }

    if (dto.title !== undefined) video.title = dto.title;
    if (dto.description !== undefined) video.description = dto.description ?? null;
    if (dto.embedUrl !== undefined) video.embedUrl = dto.embedUrl;
    if (dto.thumbnail !== undefined) video.thumbnail = dto.thumbnail ?? null;
    if (dto.duration !== undefined) video.duration = dto.duration ?? null;
    if (dto.tag !== undefined) video.tag = dto.tag ?? null;
    if (dto.isPublished !== undefined) video.isPublished = dto.isPublished;
    if (dto.displayOrder !== undefined) video.displayOrder = dto.displayOrder;

    try {
      return await this.repo.save(video);
    } catch (err) {
      this.rethrowDbError(err);
    }
  }

  async remove(id: string): Promise<{ deleted: true; id: string }> {
    const video = await this.findOneOrFail(id);
    await this.repo.remove(video);
    return { deleted: true, id };
  }

  async togglePublished(id: string): Promise<Video> {
    const video = await this.findOneOrFail(id);
    video.isPublished = !video.isPublished;
    return this.repo.save(video);
  }

  private async findOneOrFail(id: string): Promise<Video> {
    const video = await this.repo.findOne({ where: { id } });
    if (!video) throw new NotFoundException(`Video with id "${id}" not found.`);
    return video;
  }

  private async resolveSlug(explicit: string | undefined, title: string, excludeId?: string): Promise<string> {
    if (explicit !== undefined) {
      const s = sanitiseSlug(explicit);
      if (!s) throw new BadRequestException('slug produced an empty string.');
      if (await this.slugExists(s, excludeId)) throw new ConflictException(`Slug "${s}" is already in use.`);
      return s;
    }
    const base = slugify(title);
    let candidate = base;
    let n = 1;
    while (await this.slugExists(candidate, excludeId)) candidate = `${base}-${n++}`;
    return candidate;
  }

  private async slugExists(slug: string, excludeId?: string): Promise<boolean> {
    const where = excludeId ? { slug, id: Not(excludeId) } : { slug };
    return (await this.repo.count({ where })) > 0;
  }

  private rethrowDbError(err: unknown): never {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('UQ_videos_slug') || msg.includes('unique constraint')) {
      throw new ConflictException('A video with that slug already exists.');
    }
    throw err;
  }
}

function slugify(text: string): string {
  return text.toLowerCase().trim()
    .replace(/[^\w\s-]/g, '').replace(/\s+/g, '-')
    .replace(/-+/g, '-').replace(/^-+|-+$/g, '') || 'video';
}

function sanitiseSlug(raw: string): string {
  return raw.toLowerCase().trim()
    .replace(/\s+/g, '-').replace(/[^\w-]/g, '')
    .replace(/-+/g, '-').replace(/^-+|-+$/g, '');
}
