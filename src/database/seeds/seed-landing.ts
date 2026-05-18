/**
 * Seed script: Landing Page Content
 *
 * Populates the `landing_sections` table with the canonical default content
 * for all four landing page sections: hero, countdown, videos, sponsors.
 *
 * Existing rows are fully replaced (not merged) so re-running is idempotent.
 *
 * Run:
 *   npm run seed:landing
 */

import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { dataSourceOptions } from '../data-source'; // also calls config() internally

// ── Section content ─────────────────────────────────────────────────────────
// Shapes match LandingContentDto exactly — keep in sync with the DTO.

const HERO = {
  season: 'Season 1',
  title: 'Find Your',
  titleHighlight: 'Connection',
  description:
    'The hottest reality show is coming to Nigeria. Are you ready to couple up and find love under the sun?',
  ctaPrimary: {
    label: 'Apply to Be an Islander',
    href: '/apply',
  },
  ctaSecondary: {
    label: 'Watch Trailer',
    href: '#videos',
  },
  stats: {
    applicants: '10K+',
    days: '30',
    winningCouple: '1',
  },
  backgroundImage: '/images/hero-bg.jpg',
};

const COUNTDOWN = {
  label: 'Premiere Date',
  title: 'The Countdown Is On',
  /**
   * `targetDate` is an ISO-8601 string.
   * The frontend should count down to this date dynamically.
   * Hardcoded display values below serve as a static fallback only.
   */
  targetDate: '2026-06-01T20:00:00+01:00',
  timeUnits: [
    { label: 'Days', value: '84' },
    { label: 'Hours', value: '00' },
    { label: 'Minutes', value: '00' },
    { label: 'Seconds', value: '00' },
  ],
  footerText: 'Premiering on Soundcity, Spice TV, ONTV and streaming platforms',
};

const VIDEOS = {
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
};

const SPONSORS = {
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
};

// ── Seeder ───────────────────────────────────────────────────────────────────

const SECTIONS: Array<{ key: string; content: Record<string, unknown> }> = [
  { key: 'hero', content: HERO },
  { key: 'countdown', content: COUNTDOWN },
  { key: 'videos', content: VIDEOS },
  { key: 'sponsors', content: SPONSORS },
];

async function seed(): Promise<void> {
  const ds = new DataSource(dataSourceOptions);
  await ds.initialize();
  console.log('✔  Database connected');

  for (const { key, content } of SECTIONS) {
    await ds.query(
      `
      INSERT INTO "landing_sections" ("section_key", "content", "updated_at")
      VALUES ($1, $2::jsonb, now())
      ON CONFLICT ("section_key")
        DO UPDATE SET "content" = $2::jsonb, "updated_at" = now()
      `,
      [key, JSON.stringify(content)],
    );
    console.log(`  ↳ seeded section: ${key}`);
  }

  await ds.destroy();
  console.log('\n✔  Landing content seeded successfully.');
}

seed().catch((err) => {
  console.error('Seeder failed:', err);
  process.exit(1);
});
