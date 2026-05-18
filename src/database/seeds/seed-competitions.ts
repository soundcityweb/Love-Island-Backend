/**
 * Seed script: Competitions, Questions & Demo Submissions
 *
 * Inserts 6 competitions with realistic Love Island Nigeria data across all
 * competition types (quiz, poll, prediction, upload). Quiz competitions include
 * 5 questions each. A small batch of demo submissions is added to show
 * participant counts.
 *
 * Idempotent — re-running clears seeded competitions (by slug prefix
 * "seed-") and re-inserts fresh data without touching production rows.
 *
 * Run:
 *   npm run seed:competitions
 */

import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { dataSourceOptions } from '../data-source';

// ── Date helpers ─────────────────────────────────────────────────────────────

/** Return an ISO-8601 string offset from today (UTC midnight) by `days`. */
function relDate(days: number): string {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString();
}

// ── Competition data ─────────────────────────────────────────────────────────

interface CompetitionSeed {
  title: string;
  slug: string;
  type: 'quiz' | 'poll' | 'prediction' | 'upload';
  description: string;
  banner_url: string | null;
  sponsor_name: string | null;
  sponsor_logo: string | null;
  start_at: string;
  end_at: string;
  status: 'active' | 'upcoming' | 'completed' | 'draft';
}

const COMPETITIONS: CompetitionSeed[] = [
  // 1 ─ ACTIVE quiz
  {
    title: 'Week 3 Trivia Challenge',
    slug: 'seed-week-3-trivia',
    type: 'quiz',
    description:
      'Think you know everything that went down in the villa this week? Put your knowledge to the test and prove you are the ultimate Love Island fan!',
    banner_url: null,
    sponsor_name: 'Pepsi Nigeria',
    sponsor_logo: null,
    start_at: relDate(-3),
    end_at: relDate(4),
    status: 'active',
  },

  // 2 ─ UPCOMING prediction
  {
    title: 'Eviction Night Prediction',
    slug: 'seed-eviction-prediction',
    type: 'prediction',
    description:
      'Who do you think will be dumped from the villa on Sunday\'s eviction? Cast your prediction before the public vote closes and see if you called it right.',
    banner_url: null,
    sponsor_name: 'Flutterwave',
    sponsor_logo: null,
    start_at: relDate(2),
    end_at: relDate(5),
    status: 'upcoming',
  },

  // 3 ─ ACTIVE poll
  {
    title: 'Most Compatible Couple — Fan Poll',
    slug: 'seed-fan-poll-compatible-couple',
    type: 'poll',
    description:
      'From the fire pit to the day beds — which couple has the realest connection in the villa right now? You decide. Voting closes Sunday.',
    banner_url: null,
    sponsor_name: 'GTBank',
    sponsor_logo: null,
    start_at: relDate(-1),
    end_at: relDate(6),
    status: 'active',
  },

  // 4 ─ COMPLETED upload challenge
  {
    title: 'Sponsor Merch Photo Challenge',
    slug: 'seed-sponsor-merch-challenge',
    type: 'upload',
    description:
      'Show us your best Love Island Nigeria look! Upload a photo rocking your Airtel x Love Island limited merch for a chance to win exclusive prizes.',
    banner_url: null,
    sponsor_name: 'Airtel Nigeria',
    sponsor_logo: null,
    start_at: relDate(-16),
    end_at: relDate(-7),
    status: 'completed',
  },

  // 5 ─ UPCOMING upload challenge
  {
    title: 'Villa Glow-Up Photo Challenge',
    slug: 'seed-villa-glowup-upload',
    type: 'upload',
    description:
      'Style yourself for the villa! Upload your most Love Island-worthy look and get voted into our official fan gallery. Top entries win a hamper from Indomie Nigeria.',
    banner_url: null,
    sponsor_name: 'Indomie Nigeria',
    sponsor_logo: null,
    start_at: relDate(7),
    end_at: relDate(14),
    status: 'upcoming',
  },

  // 6 ─ COMPLETED quiz
  {
    title: 'Bonus Trivia: Love Island Classics',
    slug: 'seed-bonus-trivia-classics',
    type: 'quiz',
    description:
      'From series 1 catchphrases to villa traditions — how well do you know the Love Island format? Take the bonus round and see how you stack up.',
    banner_url: null,
    sponsor_name: 'Soundcity TV',
    sponsor_logo: null,
    start_at: relDate(-21),
    end_at: relDate(-14),
    status: 'completed',
  },
];

// ── Question data (quiz competitions only) ───────────────────────────────────

interface QuestionSeed {
  competition_slug: string;
  question: string;
  options: string[];
  correct_answer: string;
}

const QUESTIONS: QuestionSeed[] = [
  // ── Most Compatible Couple — Fan Poll ────────────────────────────────────
  // Polls use the same question/options structure; correct_answer is ignored.
  {
    competition_slug: 'seed-fan-poll-compatible-couple',
    question: 'Which couple has the realest connection in the villa right now?',
    options: [
      'Tunde & Bisi',
      'Kofi & Amara',
      'Seun & Ngozi',
      'Dele & Yetunde',
      'Chike & Adaeze',
    ],
    correct_answer: 'Tunde & Bisi', // ignored for polls — any value is valid
  },

  // ── Eviction Night Prediction ────────────────────────────────────────────
  {
    competition_slug: 'seed-eviction-prediction',
    question: "Who do you think will be dumped from the villa on Sunday's eviction?",
    options: [
      'Tunde Adebayo',
      'Bisi Okafor',
      'Kofi Mensah',
      'Amara Nwosu',
      'Seun Adekunle',
    ],
    correct_answer: 'Seun Adekunle', // revealed after the actual eviction
  },

  // ── Week 3 Trivia Challenge ──────────────────────────────────────────────
  {
    competition_slug: 'seed-week-3-trivia',
    question:
      'Which islander received the most "likes" during the Week 2 compatibility challenge?',
    options: ['Chike Okonkwo', 'Adaeze Nwosu', 'Emeka Eze', 'Simi Adeyemi'],
    correct_answer: 'Adaeze Nwosu',
  },
  {
    competition_slug: 'seed-week-3-trivia',
    question: 'What was the name of the Pepsi-sponsored pool party challenge in Week 3?',
    options: [
      'The Fizz Factor',
      'Cola Royale',
      'Pepsi Splash Showdown',
      'Villa Refresh',
    ],
    correct_answer: 'Pepsi Splash Showdown',
  },
  {
    competition_slug: 'seed-week-3-trivia',
    question:
      'In the "Do Bits Society" Beach Hut confession session, how many islanders admitted to a secret kiss?',
    options: ['1', '2', '3', '4'],
    correct_answer: '3',
  },
  {
    competition_slug: 'seed-week-3-trivia',
    question: 'Which couple was voted "Least Likely to Last" by the other islanders in Week 3?',
    options: [
      'Tunde & Bisi',
      'Kofi & Amara',
      'Seun & Ngozi',
      'Dele & Yetunde',
    ],
    correct_answer: 'Seun & Ngozi',
  },
  {
    competition_slug: 'seed-week-3-trivia',
    question:
      'Which Nigerian city did the first surprise Bombshell of the season reveal as her hometown?',
    options: ['Lagos', 'Abuja', 'Port Harcourt', 'Enugu'],
    correct_answer: 'Port Harcourt',
  },

  // ── Bonus Trivia: Love Island Classics ──────────────────────────────────
  {
    competition_slug: 'seed-bonus-trivia-classics',
    question:
      'What phrase do islanders traditionally use when they want to pull someone for a private chat?',
    options: [
      '"Can I borrow you?"',
      '"Let\'s have a word"',
      '"Step aside with me"',
      '"Come to the fire pit"',
    ],
    correct_answer: '"Can I borrow you?"',
  },
  {
    competition_slug: 'seed-bonus-trivia-classics',
    question:
      'In the original UK format, what colour are the famous Love Island water bottles?',
    options: ['Pink', 'Yellow', 'Clear', 'Orange'],
    correct_answer: 'Pink',
  },
  {
    competition_slug: 'seed-bonus-trivia-classics',
    question: 'What is the name of the secluded suite where selected couples are sent overnight?',
    options: ['The Hideaway', 'Casa Amor', 'The Beach Hut', 'The Snug'],
    correct_answer: 'The Hideaway',
  },
  {
    competition_slug: 'seed-bonus-trivia-classics',
    question:
      'During a standard public vote to save, what are the BOTTOM two couples at risk of?',
    options: [
      'Being dumped from the villa',
      'Losing their beds',
      'Being sent to Casa Amor',
      'Forfeiting challenge points',
    ],
    correct_answer: 'Being dumped from the villa',
  },
  {
    competition_slug: 'seed-bonus-trivia-classics',
    question: 'Which Nigerian broadcast partner airs Love Island Nigeria on linear television?',
    options: ['Soundcity TV', 'Africa Magic', 'NTA', 'Channels TV'],
    correct_answer: 'Soundcity TV',
  },
];

// ── Demo submissions ─────────────────────────────────────────────────────────

/** Fake user UUIDs — stand-ins until a real auth system is wired. */
const DEMO_USER_IDS = [
  'aaaaaaaa-0001-4000-8000-000000000001',
  'aaaaaaaa-0001-4000-8000-000000000002',
  'aaaaaaaa-0001-4000-8000-000000000003',
  'aaaaaaaa-0001-4000-8000-000000000004',
  'aaaaaaaa-0001-4000-8000-000000000005',
  'aaaaaaaa-0001-4000-8000-000000000006',
  'aaaaaaaa-0001-4000-8000-000000000007',
  'aaaaaaaa-0001-4000-8000-000000000008',
];

interface SubmissionSeed {
  competition_slug: string;
  user_id: string;
  answers: Record<string, string>;
  score: number;
}

// Demo submissions for the two quiz competitions only.
// answers format: { [question_index: string]: selected_answer }
const DEMO_SUBMISSIONS: SubmissionSeed[] = [
  // Week 3 Trivia — 5 users submitted, mix of scores
  {
    competition_slug: 'seed-week-3-trivia',
    user_id: DEMO_USER_IDS[0],
    answers: {
      '0': 'Adaeze Nwosu',
      '1': 'Pepsi Splash Showdown',
      '2': '3',
      '3': 'Seun & Ngozi',
      '4': 'Port Harcourt',
    },
    score: 5,
  },
  {
    competition_slug: 'seed-week-3-trivia',
    user_id: DEMO_USER_IDS[1],
    answers: {
      '0': 'Chike Okonkwo',
      '1': 'Pepsi Splash Showdown',
      '2': '2',
      '3': 'Seun & Ngozi',
      '4': 'Lagos',
    },
    score: 2,
  },
  {
    competition_slug: 'seed-week-3-trivia',
    user_id: DEMO_USER_IDS[2],
    answers: {
      '0': 'Adaeze Nwosu',
      '1': 'The Fizz Factor',
      '2': '3',
      '3': 'Kofi & Amara',
      '4': 'Port Harcourt',
    },
    score: 3,
  },
  {
    competition_slug: 'seed-week-3-trivia',
    user_id: DEMO_USER_IDS[3],
    answers: {
      '0': 'Adaeze Nwosu',
      '1': 'Pepsi Splash Showdown',
      '2': '3',
      '3': 'Seun & Ngozi',
      '4': 'Abuja',
    },
    score: 4,
  },
  {
    competition_slug: 'seed-week-3-trivia',
    user_id: DEMO_USER_IDS[4],
    answers: {
      '0': 'Emeka Eze',
      '1': 'Cola Royale',
      '2': '1',
      '3': 'Tunde & Bisi',
      '4': 'Enugu',
    },
    score: 0,
  },

  // Bonus Trivia Classics — 8 users (completed competition)
  {
    competition_slug: 'seed-bonus-trivia-classics',
    user_id: DEMO_USER_IDS[0],
    answers: {
      '0': '"Can I borrow you?"',
      '1': 'Pink',
      '2': 'The Hideaway',
      '3': 'Being dumped from the villa',
      '4': 'Soundcity TV',
    },
    score: 5,
  },
  {
    competition_slug: 'seed-bonus-trivia-classics',
    user_id: DEMO_USER_IDS[1],
    answers: {
      '0': '"Can I borrow you?"',
      '1': 'Yellow',
      '2': 'The Hideaway',
      '3': 'Being dumped from the villa',
      '4': 'Africa Magic',
    },
    score: 3,
  },
  {
    competition_slug: 'seed-bonus-trivia-classics',
    user_id: DEMO_USER_IDS[2],
    answers: {
      '0': '"Let\'s have a word"',
      '1': 'Pink',
      '2': 'Casa Amor',
      '3': 'Being sent to Casa Amor',
      '4': 'Soundcity TV',
    },
    score: 2,
  },
  {
    competition_slug: 'seed-bonus-trivia-classics',
    user_id: DEMO_USER_IDS[3],
    answers: {
      '0': '"Can I borrow you?"',
      '1': 'Pink',
      '2': 'The Hideaway',
      '3': 'Being dumped from the villa',
      '4': 'Soundcity TV',
    },
    score: 5,
  },
  {
    competition_slug: 'seed-bonus-trivia-classics',
    user_id: DEMO_USER_IDS[4],
    answers: {
      '0': '"Can I borrow you?"',
      '1': 'Orange',
      '2': 'The Hideaway',
      '3': 'Losing their beds',
      '4': 'Soundcity TV',
    },
    score: 3,
  },
  {
    competition_slug: 'seed-bonus-trivia-classics',
    user_id: DEMO_USER_IDS[5],
    answers: {
      '0': '"Step aside with me"',
      '1': 'Clear',
      '2': 'The Beach Hut',
      '3': 'Forfeiting challenge points',
      '4': 'NTA',
    },
    score: 0,
  },
  {
    competition_slug: 'seed-bonus-trivia-classics',
    user_id: DEMO_USER_IDS[6],
    answers: {
      '0': '"Can I borrow you?"',
      '1': 'Pink',
      '2': 'The Hideaway',
      '3': 'Being dumped from the villa',
      '4': 'Soundcity TV',
    },
    score: 5,
  },
  {
    competition_slug: 'seed-bonus-trivia-classics',
    user_id: DEMO_USER_IDS[7],
    answers: {
      '0': '"Can I borrow you?"',
      '1': 'Pink',
      '2': 'The Hideaway',
      '3': 'Being dumped from the villa',
      '4': 'Channels TV',
    },
    score: 4,
  },
];

// ── Seeder ───────────────────────────────────────────────────────────────────

async function seed(): Promise<void> {
  const ds = new DataSource(dataSourceOptions);
  await ds.initialize();
  console.log('✔  Database connected\n');

  const slugs = COMPETITIONS.map((c) => `'${c.slug}'`).join(', ');

  // Wipe previous seed data (cascades to questions + submissions automatically)
  const deleted = await ds.query(
    `DELETE FROM "competitions" WHERE "slug" IN (${slugs})`,
  );
  const deletedCount = deleted?.rowCount ?? deleted?.affectedRows ?? '?';
  console.log(`  🗑  Cleared ${deletedCount} existing seeded competition(s)\n`);

  // ── 1. Insert competitions ────────────────────────────────────────────────
  console.log('  Seeding competitions…');
  const competitionIds: Record<string, string> = {};

  for (const c of COMPETITIONS) {
    const [row] = await ds.query<{ id: string }[]>(
      `
      INSERT INTO "competitions"
        ("title", "slug", "type", "description", "banner_url",
         "sponsor_name", "sponsor_logo", "start_at", "end_at", "status")
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING "id"
      `,
      [
        c.title,
        c.slug,
        c.type,
        c.description,
        c.banner_url,
        c.sponsor_name,
        c.sponsor_logo,
        c.start_at,
        c.end_at,
        c.status,
      ],
    );
    competitionIds[c.slug] = row.id;
    console.log(`    ↳ [${c.status.padEnd(9)}] ${c.title}  (${c.type})`);
  }

  // ── 2. Insert questions ───────────────────────────────────────────────────
  console.log('\n  Seeding questions…');
  const questionIds: Record<string, string[]> = {};

  for (const q of QUESTIONS) {
    const competitionId = competitionIds[q.competition_slug];
    if (!competitionId) continue;

    const [row] = await ds.query<{ id: string }[]>(
      `
      INSERT INTO "questions"
        ("competition_id", "question", "options", "correct_answer")
      VALUES ($1, $2, $3::jsonb, $4)
      RETURNING "id"
      `,
      [competitionId, q.question, JSON.stringify(q.options), q.correct_answer],
    );

    if (!questionIds[q.competition_slug]) questionIds[q.competition_slug] = [];
    questionIds[q.competition_slug].push(row.id);
    console.log(`    ↳ [${q.competition_slug}]  "${q.question.slice(0, 55)}…"`);
  }

  // ── 3. Insert demo submissions ────────────────────────────────────────────
  console.log('\n  Seeding demo submissions…');
  let subCount = 0;

  for (const s of DEMO_SUBMISSIONS) {
    const competitionId = competitionIds[s.competition_slug];
    if (!competitionId) continue;

    await ds.query(
      `
      INSERT INTO "submissions"
        ("user_id", "competition_id", "answers", "score")
      VALUES ($1, $2, $3::jsonb, $4)
      `,
      [s.user_id, competitionId, JSON.stringify(s.answers), s.score],
    );
    subCount++;
  }
  console.log(`    ↳ ${subCount} demo submission(s) inserted`);

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log('\n─────────────────────────────────────────────');
  console.log(`✔  Seeded ${COMPETITIONS.length} competitions`);
  console.log(`✔  Seeded ${QUESTIONS.length} questions`);
  console.log(`✔  Seeded ${subCount} demo submissions`);
  console.log('─────────────────────────────────────────────\n');

  await ds.destroy();
}

seed().catch((err) => {
  console.error('\n✖  Seeder failed:', err);
  process.exit(1);
});
