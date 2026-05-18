import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Application } from '../entities/application.entity';
import { ApplicationMedia, ApplicationMediaType } from '../entities/application-media.entity';
import { ApplicationStatus } from '../entities/application-status.enum';
import { Islander } from '../entities/islander.entity';
import { IslanderMedia, IslanderMediaType } from '../entities/islander-media.entity';
import { IslanderStatus } from '../entities/islander-status.enum';
import { CreateApplicationDto } from './dto/create-application.dto';
import { ListApplicationsQueryDto } from './dto/list-applications-query.dto';
import { EmailService } from '../common/services/email.service';
import { generateSlug, generateUniqueSlug } from '../common/utils/slug.util';
import type { UploadedFilesMap } from './types/multer-file.interface';
import { AnalyticsEventEmitter } from '../analytics/analytics.events';
import { CloudinaryService } from '../common/cloudinary/cloudinary.service';

@Injectable()
export class ApplicationsService {
  constructor(
    @InjectRepository(Application)
    private readonly applicationRepository: Repository<Application>,
    @InjectRepository(ApplicationMedia)
    private readonly mediaRepository: Repository<ApplicationMedia>,
    @InjectRepository(Islander)
    private readonly islanderRepository: Repository<Islander>,
    @InjectRepository(IslanderMedia)
    private readonly islanderMediaRepository: Repository<IslanderMedia>,
    private readonly emailService: EmailService,
    private readonly analyticsEvents: AnalyticsEventEmitter,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  async create(dto: CreateApplicationDto): Promise<Application> {
    const application = this.applicationRepository.create({
      firstName: dto.firstName,
      lastName: dto.lastName,
      email: dto.email,
      phone: dto.phone,
      age: dto.age,
      gender: dto.gender,
      city: dto.city,
      occupation: dto.occupation,
      bio: dto.bio,
      tagline: dto.tagline ?? null,
      lookingFor: dto.lookingFor ?? null,
      profileStatusLabel: dto.profileStatusLabel ?? null,
      funFacts: dto.funFacts ?? null,
      socialLinks: dto.socialLinks ?? null,
      status: ApplicationStatus.SUBMITTED,
    });
    return this.applicationRepository.save(application);
  }

  async createWithMedia(
    dto: CreateApplicationDto,
    files: UploadedFilesMap,
  ): Promise<Application> {
    const application = await this.create(dto);
    const appId = application.id;

    const images = files.images ?? [];
    const primaryIndex = Math.min(
      dto.primaryImageIndex ?? 0,
      Math.max(0, images.length - 1),
    );
    // Order so primary image gets sortOrder 0: [primary, ...rest]
    const order: number[] = [];
    order.push(primaryIndex);
    for (let i = 0; i < images.length; i++) {
      if (i !== primaryIndex) order.push(i);
    }

    for (let sortOrder = 0; sortOrder < order.length; sortOrder++) {
      const i = order[sortOrder];
      const file = images[i];
      const { publicId } = await this.cloudinaryService.uploadBuffer(
        file.buffer,
        `applications/${appId}/images`,
        'image',
      );

      await this.mediaRepository.save(
        this.mediaRepository.create({
          applicationId: appId,
          type: ApplicationMediaType.IMAGE,
          sortOrder,
          storageKey: publicId,
        }),
      );
    }

    const videoList = files.video ?? [];
    if (videoList.length > 0) {
      const file = videoList[0];
      const { publicId } = await this.cloudinaryService.uploadBuffer(
        file.buffer,
        `applications/${appId}/video`,
        'video',
      );

      await this.mediaRepository.save(
        this.mediaRepository.create({
          applicationId: appId,
          type: ApplicationMediaType.VIDEO,
          sortOrder: 0,
          storageKey: publicId,
        }),
      );
    }

    // Notify admin(s) of new application
    try {
      await this.emailService.sendNewApplicationNotificationToAdmin(
        appId,
        application.firstName,
        application.lastName,
      );
    } catch (error) {
      console.error('Failed to send new application notification to admin:', error);
      // Don't fail the submission
    }

    this.analyticsEvents.emitApplicationSubmitted({
      applicationId: appId,
      firstName: application.firstName,
      lastName: application.lastName,
      email: application.email,
      createdAt: application.createdAt,
    });

    return this.findOne(appId);
  }

  async findAll(
    query: ListApplicationsQueryDto,
  ): Promise<{ data: Application[]; total: number; page: number; limit: number }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const qb = this.applicationRepository
      .createQueryBuilder('application')
      .leftJoinAndSelect('application.media', 'media')
      .orderBy('application.createdAt', 'DESC')
      .addOrderBy('media.sortOrder', 'ASC')
      .skip(skip)
      .take(limit);

    if (query.status) {
      qb.andWhere('application.status = :status', { status: query.status });
    }

    const [data, total] = await qb.getManyAndCount();

    return { data, total, page, limit };
  }

  async findOne(id: string): Promise<Application> {
    const application = await this.applicationRepository.findOne({
      where: { id },
      relations: { media: true },
    });
    if (!application) {
      throw new NotFoundException(`Application with id ${id} not found`);
    }
    return application;
  }

  async updateStatus(id: string, status: ApplicationStatus): Promise<Application> {
    const application = await this.applicationRepository.findOne({
      where: { id },
      relations: { media: true },
    });
    if (!application) {
      throw new NotFoundException(`Application with id ${id} not found`);
    }

    const previousStatus = application.status;
    application.status = status;
    const savedApplication = await this.applicationRepository.save(application);

    // Handle status-specific actions
    if (status === ApplicationStatus.REJECTED && previousStatus !== ApplicationStatus.REJECTED) {
      // Send rejection email
      try {
        await this.emailService.sendRejectionEmail(
          application.email,
          application.firstName,
          application.lastName,
        );
      } catch (error) {
        // Log error but don't fail the status update
        console.error('Failed to send rejection email:', error);
      }
    } else if (status === ApplicationStatus.ACCEPTED && previousStatus !== ApplicationStatus.ACCEPTED) {
      // Create islander from application and notify applicant
      try {
        const islander = await this.createIslanderFromApplication(application);
        try {
          await this.emailService.sendApprovalEmail(
            application.email,
            application.firstName,
            application.lastName,
            islander.slug,
          );
        } catch (emailError) {
          console.error('Failed to send approval email:', emailError);
          // Don't fail the flow; islander was created successfully
        }
      } catch (error) {
        // Log error but don't fail the status update
        console.error('Failed to create islander from application:', error);
        throw error; // Re-throw to prevent status update if islander creation fails
      }
    }

    return savedApplication;
  }

  /**
   * Create an Islander entity from an accepted Application
   */
  private async createIslanderFromApplication(application: Application): Promise<Islander> {
    // Generate unique slug
    const baseSlug = generateSlug(application.firstName, application.lastName);
    const slug = await generateUniqueSlug(baseSlug, async (s) => {
      const exists = await this.islanderRepository.findOne({ where: { slug: s } });
      return !!exists;
    });

    // Create islander entity (profile image will be set after media migration)
    const islander = this.islanderRepository.create({
      slug,
      firstName: application.firstName,
      lastName: application.lastName,
      age: application.age,
      location: application.city,
      occupation: application.occupation,
      tagline: application.tagline ?? null,
      bio: application.bio,
      lookingFor: application.lookingFor ?? null,
      profileStatusLabel: application.profileStatusLabel ?? null,
      profileImage: null, // Will be set after media migration
      coverImage: null,
      status: IslanderStatus.ACTIVE,
      isPublic: true,
      displayOrder: 0, // Can be updated later
      funFacts: application.funFacts ?? null,
      socialLinks: application.socialLinks ?? null,
      metaTitle: null,
      metaDescription: null,
      ogImage: null,
      twitterImage: null,
      keywords: null,
    });

    const savedIslander = await this.islanderRepository.save(islander);

    // Migrate media to islander and set profile image
    const mediaPaths = await this.migrateApplicationMediaToIslander(application, savedIslander);
    if (mediaPaths.profileImage) {
      savedIslander.profileImage = mediaPaths.profileImage;
    }
    await this.islanderRepository.save(savedIslander);

    return savedIslander;
  }

  /**
   * Re-use application Cloudinary assets for the new islander.
   * Because the files are already on Cloudinary, we simply create new
   * islander_media rows pointing to the same secure_url — no re-upload needed.
   * Returns the profile image URL.
   */
  private async migrateApplicationMediaToIslander(
    application: Application,
    islander: Islander,
  ): Promise<{ profileImage: string | null }> {
    const result = { profileImage: null as string | null };

    if (!application.media || application.media.length === 0) {
      return result;
    }

    const images = application.media.filter((m) => m.type === ApplicationMediaType.IMAGE);
    const videos = application.media.filter((m) => m.type === ApplicationMediaType.VIDEO);

    // First image becomes profile, the rest become gallery
    for (let i = 0; i < images.length; i++) {
      const appMedia = images[i];
      const mediaType = i === 0 ? IslanderMediaType.PROFILE : IslanderMediaType.GALLERY;

      if (i === 0) {
        result.profileImage = appMedia.storageKey;
      }

      await this.islanderMediaRepository.save(
        this.islanderMediaRepository.create({
          islanderId: islander.id,
          type: mediaType,
          storageKey: appMedia.storageKey,
          displayOrder: i === 0 ? 0 : i - 1,
          altText: null,
        }),
      );
    }

    for (let i = 0; i < videos.length; i++) {
      const appMedia = videos[i];
      await this.islanderMediaRepository.save(
        this.islanderMediaRepository.create({
          islanderId: islander.id,
          type: IslanderMediaType.VIDEO,
          storageKey: appMedia.storageKey,
          displayOrder: i,
          altText: null,
        }),
      );
    }

    return result;
  }
}
