import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository } from 'typeorm';
import { Islander } from '../entities/islander.entity';
import { IslanderMedia, IslanderMediaType } from '../entities/islander-media.entity';
import { IslanderStatus } from '../entities/islander-status.enum';
import { CreateIslanderDto } from './dto/create-islander.dto';
import { UpdateIslanderDto } from './dto/update-islander.dto';
import { CloudinaryService } from '../common/cloudinary/cloudinary.service';

interface UploadedFile {
  originalname: string;
  buffer: Buffer;
  mimetype: string;
  size: number;
}

@Injectable()
export class AdminIslandersService {
  constructor(
    @InjectRepository(Islander)
    private readonly islanderRepo: Repository<Islander>,
    @InjectRepository(IslanderMedia)
    private readonly mediaRepo: Repository<IslanderMedia>,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  // ── LIST ──────────────────────────────────────────────────────────────────

  async findAll(): Promise<Islander[]> {
    return this.islanderRepo.find({
      relations: { media: true },
      order: { displayOrder: 'ASC', createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<Islander> {
    return this.findOneOrFail(id);
  }

  // ── CREATE ────────────────────────────────────────────────────────────────

  async create(dto: CreateIslanderDto): Promise<Islander> {
    const slug = await this.resolveSlug(dto.slug, dto.firstName, dto.lastName ?? '');

    const islander = this.islanderRepo.create({
      slug,
      firstName: dto.firstName,
      lastName: dto.lastName ?? null,
      age: dto.age,
      location: dto.location,
      occupation: dto.occupation ?? null,
      tagline: dto.tagline ?? null,
      bio: dto.bio ?? null,
      lookingFor: dto.lookingFor ?? null,
      status: dto.status ?? IslanderStatus.ACTIVE,
      isPublic: dto.isPublic ?? false,
      displayOrder: dto.displayOrder ?? 0,
      profileStatusLabel: dto.profileStatusLabel ?? null,
      profileImage: dto.profileImage ?? null,
      coverImage: dto.coverImage ?? null,
      funFacts: dto.funFacts ?? null,
      socialLinks: dto.socialLinks ?? null,
      metaTitle: dto.metaTitle ?? null,
      metaDescription: dto.metaDescription ?? null,
      ogImage: dto.ogImage ?? null,
      twitterImage: dto.twitterImage ?? null,
      keywords: dto.keywords ?? null,
    });

    try {
      const saved = await this.islanderRepo.save(islander);
      return this.findOneOrFail(saved.id);
    } catch (err) {
      this.rethrowDbError(err);
    }
  }

  // ── UPDATE ────────────────────────────────────────────────────────────────

  async update(id: string, dto: UpdateIslanderDto): Promise<Islander> {
    const islander = await this.findOneOrFail(id);

    if (
      dto.slug !== undefined ||
      (dto.firstName !== undefined && dto.firstName !== islander.firstName) ||
      (dto.lastName !== undefined && dto.lastName !== islander.lastName)
    ) {
      islander.slug = await this.resolveSlug(
        dto.slug,
        dto.firstName ?? islander.firstName,
        dto.lastName ?? islander.lastName ?? '',
        id,
      );
    }

    if (dto.firstName !== undefined) islander.firstName = dto.firstName;
    if (dto.lastName !== undefined) islander.lastName = dto.lastName ?? null;
    if (dto.age !== undefined) islander.age = dto.age;
    if (dto.location !== undefined) islander.location = dto.location;
    if (dto.occupation !== undefined) islander.occupation = dto.occupation ?? null;
    if (dto.tagline !== undefined) islander.tagline = dto.tagline ?? null;
    if (dto.bio !== undefined) islander.bio = dto.bio ?? null;
    if (dto.lookingFor !== undefined) islander.lookingFor = dto.lookingFor ?? null;
    if (dto.status !== undefined) islander.status = dto.status;
    if (dto.isPublic !== undefined) islander.isPublic = dto.isPublic;
    if (dto.displayOrder !== undefined) islander.displayOrder = dto.displayOrder;
    if (dto.profileStatusLabel !== undefined) islander.profileStatusLabel = dto.profileStatusLabel ?? null;
    if (dto.profileImage !== undefined) islander.profileImage = dto.profileImage ?? null;
    if (dto.coverImage !== undefined) islander.coverImage = dto.coverImage ?? null;
    if (dto.funFacts !== undefined) islander.funFacts = dto.funFacts ?? null;
    if (dto.socialLinks !== undefined) islander.socialLinks = dto.socialLinks ?? null;
    if (dto.metaTitle !== undefined) islander.metaTitle = dto.metaTitle ?? null;
    if (dto.metaDescription !== undefined) islander.metaDescription = dto.metaDescription ?? null;
    if (dto.ogImage !== undefined) islander.ogImage = dto.ogImage ?? null;
    if (dto.twitterImage !== undefined) islander.twitterImage = dto.twitterImage ?? null;
    if (dto.keywords !== undefined) islander.keywords = dto.keywords ?? null;

    try {
      const saved = await this.islanderRepo.save(islander);
      return this.findOneOrFail(saved.id);
    } catch (err) {
      this.rethrowDbError(err);
    }
  }

  // ── DELETE ────────────────────────────────────────────────────────────────

  async remove(id: string): Promise<{ deleted: true; id: string }> {
    const islander = await this.findOneOrFail(id);
    await this.islanderRepo.remove(islander);
    return { deleted: true, id };
  }

  // ── TOGGLE PUBLIC ─────────────────────────────────────────────────────────

  async togglePublic(id: string): Promise<Islander> {
    const islander = await this.findOneOrFail(id);
    islander.isPublic = !islander.isPublic;
    return this.islanderRepo.save(islander);
  }

  // ── MEDIA UPLOAD ──────────────────────────────────────────────────────────

  async uploadMedia(
    id: string,
    files: UploadedFile[],
    type: IslanderMediaType = IslanderMediaType.GALLERY,
  ): Promise<{ urls: string[] }> {
    await this.findOneOrFail(id);

    const mediaEntities: Partial<IslanderMedia>[] = [];
    const urls: string[] = [];

    for (const file of files) {
      const resourceType = file.mimetype.startsWith('video/') ? 'video' : 'image';
      const { publicId } = await this.cloudinaryService.uploadBuffer(
        file.buffer,
        `islanders/${id}`,
        resourceType,
      );
      urls.push(publicId);
      mediaEntities.push({
        islanderId: id,
        type,
        storageKey: publicId,
        displayOrder: 0,
        altText: null,
      });
    }

    await this.mediaRepo.save(mediaEntities);
    return { urls };
  }

  // ── MEDIA DELETE ──────────────────────────────────────────────────────────

  async removeMedia(mediaId: string): Promise<{ deleted: true; id: string }> {
    const media = await this.mediaRepo.findOne({ where: { id: mediaId } });
    if (!media) throw new NotFoundException('Media item not found.');
    await this.mediaRepo.remove(media);

    // Best-effort delete from Cloudinary — storageKey holds the public_id directly
    const resourceType = media.type === IslanderMediaType.VIDEO ? 'video' : 'image';
    await this.cloudinaryService.destroy(media.storageKey, resourceType);

    return { deleted: true, id: mediaId };
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private async findOneOrFail(id: string): Promise<Islander> {
    const islander = await this.islanderRepo.findOne({
      where: { id },
      relations: { media: true },
    });
    if (!islander) throw new NotFoundException(`Islander with id "${id}" not found.`);
    return islander;
  }

  private async resolveSlug(
    explicit: string | undefined,
    firstName: string,
    lastName: string,
    excludeId?: string,
  ): Promise<string> {
    if (explicit !== undefined) {
      const s = sanitiseSlug(explicit);
      if (!s) throw new BadRequestException('slug produced an empty string.');
      if (await this.slugExists(s, excludeId)) throw new ConflictException(`Slug "${s}" is already in use.`);
      return s;
    }
    const base = slugify(`${firstName} ${lastName}`.trim());
    let candidate = base;
    let n = 1;
    while (await this.slugExists(candidate, excludeId)) candidate = `${base}-${n++}`;
    return candidate;
  }

  private async slugExists(slug: string, excludeId?: string): Promise<boolean> {
    const where = excludeId ? { slug, id: Not(excludeId) } : { slug };
    return (await this.islanderRepo.count({ where })) > 0;
  }

  private rethrowDbError(err: unknown): never {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('unique') || msg.includes('duplicate')) {
      throw new ConflictException('An islander with that slug already exists.');
    }
    throw err;
  }
}

function slugify(text: string): string {
  return text.toLowerCase().trim()
    .replace(/[^\w\s-]/g, '').replace(/\s+/g, '-')
    .replace(/-+/g, '-').replace(/^-+|-+$/g, '') || 'islander';
}

function sanitiseSlug(raw: string): string {
  return raw.toLowerCase().trim()
    .replace(/\s+/g, '-').replace(/[^\w-]/g, '')
    .replace(/-+/g, '-').replace(/^-+|-+$/g, '');
}
