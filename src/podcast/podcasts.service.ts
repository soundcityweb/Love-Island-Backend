import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository } from 'typeorm';
import { PodcastCrossLink, PodcastEpisode } from '../entities/podcast-episode.entity';
import { CreatePodcastEpisodeDto } from './dto/create-podcast-episode.dto';
import { UpdatePodcastEpisodeDto } from './dto/update-podcast-episode.dto';
import { AUDIO_OR_VIDEO_URL_MESSAGE } from './validators/audio-or-video-url.constraint';

@Injectable()
export class PodcastsService {
  constructor(
    @InjectRepository(PodcastEpisode)
    private readonly repo: Repository<PodcastEpisode>,
  ) {}

  async findAllPublished(): Promise<PodcastEpisode[]> {
    return this.repo.find({
      where: { status: 'published' },
      order: { createdAt: 'DESC' },
    });
  }

  /** All episodes (any status), newest first — admin only. */
  async findAllAdmin(): Promise<PodcastEpisode[]> {
    return this.repo.find({ order: { createdAt: 'DESC' } });
  }

  async findById(id: string): Promise<PodcastEpisode> {
    return this.findOneOrFail(id);
  }

  async findPublishedBySlug(slug: string): Promise<PodcastEpisode> {
    const episode = await this.repo.findOne({ where: { slug, status: 'published' } });
    if (!episode) throw new NotFoundException(`Podcast episode "${slug}" not found.`);
    return episode;
  }

  async create(dto: CreatePodcastEpisodeDto): Promise<PodcastEpisode> {
    const slug = await this.resolveSlug(dto.slug, dto.title);
    const status = dto.status ?? 'draft';
    let publishedAt: Date | null = dto.publishedAt ? new Date(dto.publishedAt) : null;
    if (status === 'published' && !publishedAt) {
      publishedAt = new Date();
    }

    const audioUrl = normaliseMediaColumn(dto.audioUrl);
    const videoUrl = normaliseMediaColumn(dto.videoUrl);
    assertAtLeastOneMediaUrl(audioUrl, videoUrl);

    const episode = this.repo.create({
      title: dto.title,
      slug,
      audioUrl,
      videoUrl,
      notes: dto.notes ?? null,
      thumbnailUrl: dto.thumbnailUrl ?? null,
      crossLinks: normaliseCrossLinks(dto.crossLinks),
      status,
      publishedAt,
    });

    try {
      return await this.repo.save(episode);
    } catch (err) {
      this.rethrowDbError(err);
    }
  }

  async update(id: string, dto: UpdatePodcastEpisodeDto): Promise<PodcastEpisode> {
    const episode = await this.findOneOrFail(id);

    if (dto.slug !== undefined || (dto.title !== undefined && dto.title !== episode.title)) {
      episode.slug = await this.resolveSlug(
        dto.slug,
        dto.title ?? episode.title,
        id,
      );
    }
    if (dto.title !== undefined) episode.title = dto.title;
    if (dto.audioUrl !== undefined) {
      episode.audioUrl = normaliseMediaColumn(dto.audioUrl);
    }
    if (dto.videoUrl !== undefined) {
      episode.videoUrl = normaliseMediaColumn(dto.videoUrl);
    }
    if (dto.notes !== undefined) {
      episode.notes = dto.notes?.trim() ? dto.notes.trim() : null;
    }
    if (dto.thumbnailUrl !== undefined) {
      episode.thumbnailUrl = dto.thumbnailUrl?.trim() ? dto.thumbnailUrl.trim() : null;
    }
    if (dto.crossLinks !== undefined) episode.crossLinks = normaliseCrossLinks(dto.crossLinks);
    if (dto.status !== undefined) episode.status = dto.status;
    if (dto.publishedAt !== undefined) {
      episode.publishedAt = dto.publishedAt ? new Date(dto.publishedAt) : null;
    }
    if (episode.status === 'published' && !episode.publishedAt) {
      episode.publishedAt = new Date();
    }

    assertAtLeastOneMediaUrl(episode.audioUrl, episode.videoUrl);

    try {
      return await this.repo.save(episode);
    } catch (err) {
      this.rethrowDbError(err);
    }
  }

  async remove(id: string): Promise<{ deleted: true; id: string }> {
    const episode = await this.findOneOrFail(id);
    await this.repo.remove(episode);
    return { deleted: true, id };
  }

  private async findOneOrFail(id: string): Promise<PodcastEpisode> {
    const episode = await this.repo.findOne({ where: { id } });
    if (!episode) throw new NotFoundException(`Podcast episode with id "${id}" not found.`);
    return episode;
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
    if (msg.includes('UQ_podcast_episodes_slug') || msg.includes('unique constraint')) {
      throw new ConflictException('A podcast episode with that slug already exists.');
    }
    throw err;
  }
}

function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '') || 'episode'
  );
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

function normaliseCrossLinks(
  links: CreatePodcastEpisodeDto['crossLinks'] | undefined,
): PodcastCrossLink[] | null {
  if (links === undefined) return null;
  if (!links.length) return null;
  return links.map((l) => ({ label: l.label.trim(), url: l.url.trim() }));
}

function normaliseMediaColumn(value: string | undefined): string | null {
  if (value === undefined) return null;
  const t = value.trim();
  return t.length > 0 ? t : null;
}

function assertAtLeastOneMediaUrl(audio: string | null, video: string | null): void {
  const a = audio?.trim() ?? '';
  const v = video?.trim() ?? '';
  if (!a && !v) {
    throw new BadRequestException(AUDIO_OR_VIDEO_URL_MESSAGE);
  }
}
