import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LandingSection } from '../entities/landing-section.entity';
import { LandingContentDto } from './dto/landing-content-response.dto';

@Injectable()
export class LandingService {
  constructor(
    @InjectRepository(LandingSection)
    private readonly sectionRepository: Repository<LandingSection>,
  ) {}

  // ── Admin helpers ─────────────────────────────────────────────────────────

  async getAllSections(): Promise<LandingSection[]> {
    return this.sectionRepository.find({ order: { sectionKey: 'ASC' } });
  }

  async upsertSection(
    key: string,
    content: Record<string, unknown>,
  ): Promise<LandingSection> {
    let section = await this.sectionRepository.findOne({ where: { sectionKey: key } });
    if (!section) {
      section = this.sectionRepository.create({ sectionKey: key, content });
    } else {
      section.content = { ...section.content, ...content };
    }
    return this.sectionRepository.save(section);
  }

  // ── Public ────────────────────────────────────────────────────────────────

  async getLandingContent(): Promise<LandingContentDto> {
    const dbSections = await this.sectionRepository.find();

    // Build a lookup map: sectionKey → content.
    // Skip rows whose content is an empty object (migration stub, not yet seeded).
    const db: Record<string, Record<string, unknown>> = {};
    for (const row of dbSections) {
      if (row.content && Object.keys(row.content).length > 0) {
        db[row.sectionKey] = row.content as Record<string, unknown>;
      }
    }

    const defaults = LandingService.defaultContent();

    // DB content wins; hardcoded default fills any missing top-level keys.
    const hero = { ...defaults.hero, ...(db['hero'] ?? {}) } as LandingContentDto['hero'];
    const countdown = {
      ...defaults.countdown,
      ...(db['countdown'] ?? {}),
    } as LandingContentDto['countdown'];
    const videos = {
      ...defaults.videos,
      ...(db['videos'] ?? {}),
    } as LandingContentDto['videos'];
    const sponsors = {
      ...defaults.sponsors,
      ...(db['sponsors'] ?? {}),
    } as LandingContentDto['sponsors'];

    return { hero, countdown, videos, sponsors };
  }

  // ── Defaults (used when a section has not been seeded yet) ────────────────

  private static defaultContent() {
    return {
      hero: {
        season: 'Season 1',
        title: 'Find Your',
        titleHighlight: 'Connection',
        description:
          'The hottest reality show is coming to Nigeria. Are you ready to couple up and find love under the sun?',
        ctaPrimary: { label: 'Apply to Be an Islander', href: '/apply' },
        ctaSecondary: { label: 'Watch Trailer', href: '#videos' },
        stats: { applicants: '10K+', days: '30', winningCouple: '1' },
        backgroundImage: '/images/hero-bg.jpg',
      },
      countdown: {
        label: 'Premiere Date',
        title: 'The Countdown Is On',
        targetDate: '2026-06-01T20:00:00+01:00',
        timeUnits: [
          { label: 'Days', value: '84' },
          { label: 'Hours', value: '00' },
          { label: 'Minutes', value: '00' },
          { label: 'Seconds', value: '00' },
        ],
        footerText: 'Premiering on Soundcity, Spice TV, ONTV and streaming platforms',
      },
      videos: {
        label: 'Exclusive Clips',
        title: 'Watch the Drama Unfold',
        description:
          'Catch trailers, first-look teasers, and diary room confessionals straight from the villa.',
        featuredVideo: {
          embedUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
          title: 'Love Island Nigeria — Official Season 1 Trailer',
          description:
            'Your first look inside the villa — new islanders, new connections, and drama from night one.',
        },
        clips: [
          {
            title: 'First Look: The Villa Tour',
            description: 'Step inside the most luxurious villa Nigeria has ever seen.',
            duration: '3:42',
            image: '/images/thumb-villa-tour.jpg',
            tag: 'First Look',
          },
          {
            title: 'Diary Room Confessionals',
            description: 'Hear what the islanders really think when the cameras get close.',
            duration: '5:18',
            image: '/images/thumb-diary-room.jpg',
            tag: 'Diary Room',
          },
          {
            title: 'Coupling Up: Episode 1',
            description: 'Who will make the first move? Watch the tension build.',
            duration: '4:05',
            image: '/images/thumb-coupling.jpg',
            tag: 'Preview',
          },
          {
            title: 'Official Season 1 Trailer',
            description: 'Get your first look at the islanders and the stunning villa.',
            duration: '2:30',
            image: '/images/thumb-trailer.jpg',
            tag: 'Trailer',
          },
        ],
        ctaLabel: 'Browse All Clips',
        ctaHref: '/videos',
      },
      sponsors: {
        label: 'Our Partners',
        title: 'Proudly Supported By',
        description:
          'Love Island Nigeria is brought to you in partnership with these amazing brands.',
        titleSponsors: [
          { name: 'Soundcity', tier: 'Title Broadcast Partner' },
          { name: 'Spice TV', tier: 'Title Broadcast Partner' },
        ],
        officialPartners: [
          { name: 'ONTV', tier: 'Broadcast Partner' },
          { name: 'Flutterwave', tier: 'Payments Partner' },
          { name: 'GTBank', tier: 'Gold Sponsor' },
          { name: 'Pepsi', tier: 'Lifestyle Partner' },
          { name: 'Airtel', tier: 'Telecom Partner' },
          { name: 'Indomie', tier: 'Official Partner' },
        ],
        cta: {
          label: 'Become a Sponsor',
          title: "Partner with Nigeria's biggest entertainment brand",
          description:
            "Reach millions of engaged viewers across TV, digital, and social platforms. Let's create something unforgettable together.",
          buttonLabel: 'Get in Touch',
          href: '/contact',
        },
      },
    };
  }
}
