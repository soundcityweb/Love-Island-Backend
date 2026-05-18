import './seed-env';
import { Prisma, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/** Calendar anchor (UTC). First broadcast day = BASE; digital/recap/podcast use following days as needed. */
const BASE_YMD = '2026-04-07';

const DAYS = 14;

/** YYYY-MM-DD → UTC midnight (matches ScheduleService.parseDateOnly). */
function parseDateOnly(ymd: string): Date {
  return new Date(`${ymd}T00:00:00.000Z`);
}

/** HH:mm or HH:mm:ss → Prisma @db.Time (UTC time-of-day anchor). */
function parseTime(hms: string): Date {
  const [h = '0', m = '0', s = '0'] = hms.trim().split(':');
  return new Date(
    Date.UTC(1970, 0, 1, parseInt(h, 10), parseInt(m, 10), parseInt(s, 10)),
  );
}

/** Add days to a YYYY-MM-DD string (UTC calendar math). */
function addDaysYmd(ymd: string, delta: number): string {
  const d = new Date(`${ymd}T12:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

const EPISODE_DESCRIPTIONS: string[] = [
  'Hearts race as new couplings form — and one Islander faces the first tough goodbye.',
  'A surprise recoupling ceremony flips the villa upside down. Trust is on thin ice.',
  'Secret texts, sideways glances, and a challenge that exposes every crack.',
  'The Hideaway opens its doors. Sparks fly — but not everyone is invited.',
  'Double trouble: two bombshells walk in and rewrite the power balance overnight.',
  'Friendships fracture when votes go public and loyalties are tested at the fire pit.',
  'A dramatic exit and an emotional speech nobody saw coming.',
  'Casa sparks rumours; the main villa fights to keep it together.',
  'Games night goes wrong when old flames get dragged back into the spotlight.',
  'The Islanders choose: head vs heart. One couple leaves for good.',
  'Family video messages land — tears, tension, and a few brutal truths.',
  'Final dates under the stars. Who is playing for keeps?',
  'The last recoupling before the finale. No second chances.',
  'Finale week kicks off: speeches, votes, and the road to crowning a winning couple.',
];

const FIRST_LOOK_BLURBS: string[] = [
  'Tonight’s episode teased: new drama before the 8PM premiere across linear channels.',
  'Exclusive clips and context — get hyped before the main show drops.',
  'See what the Islanders were up to hours before lights go down in the villa.',
  'A bite-sized preview: one twist you will not want to miss.',
  'Behind-the-moodboards energy: who is cracking and who is coasting?',
  'Spoiler-light sneak peek at the challenge that changes everything.',
  'Micro-drama, macro stakes — the pre-show you need in your group chat.',
  'Quick hits from the Beach Hut before the big night unfolds.',
  'Six PM sharp: your first look at the episode everyone will be talking about.',
  'Tone-setter for the night — romance, rivalry, and one rogue confession.',
  'The calm before the storm. Then… not calm.',
  'Clip pack + context: what to watch for in the full episode.',
  'First Look: the appetizer before Love, Drama & Chaos goes live.',
  'Finale-week preview — every second counts from here.',
];

const RECAP_BLURBS: string[] = [
  'All the best moments, fights, and flirts from last night — in one tight package.',
  'Missed the episode? Catch the chaos: recouplings, recriminations, and receipts.',
  'The highlights reel with zero filler — pure villa voltage.',
  'Who said what, who kissed who, and who is already in trouble.',
  'Your midday catch-up: the story beats you need before tonight.',
  'Recap refresh: votes, villains, and viral moments from the latest drop.',
  'Twelve PM rewind — perfect lunch-break drama.',
  'The episode distilled: laughs, tears, and one massive cliffhanger.',
  'Fast, sharp, addictive — the recap that keeps you in the loop.',
  'From first toast to last tear: everything that mattered yesterday.',
  'Plot threads tied (and untied) — recap before the next First Look.',
  'Midweek energy: catch up before the villa shifts again.',
  'Almost finale: relive the shocks that set up the endgame.',
  'The road to the crown — recap the stakes before the live final.',
];

const PODCAST_BLURBS: string[] = [
  'Hosts debate the messiest moments and predict who is next to go.',
  'Aftersun energy: hot takes, cold facts, and listener questions.',
  'Deep dive on strategy vs feelings — who is playing 4D chess?',
  'Guest chatter, villa lore, and the meme-of-the-episode award.',
  'Two PM tea: chemistry reads, edit reads, and chaos reads.',
  'The podcast table is divided. Pick a side (you will flip by minute ten).',
  'Bonus angles the show did not have time for — we do.',
  'Fan theories vs reality: we separate signal from noise.',
  'Comedy, commentary, and the one line nobody can stop quoting.',
  'Post-episode therapy for viewers who need to vent.',
  'Power rankings, flop rankings, and one chaotic wildcard.',
  'Finale-week special: paths to victory — and paths to heartbreak.',
  'Live-show prep: what the finalists need to nail on the night.',
  'The last word before the crown — predictions, prayers, and plot twists.',
];

function buildScheduleRows(): Prisma.ScheduleCreateManyInput[] {
  const rows: Prisma.ScheduleCreateManyInput[] = [];

  for (let i = 0; i < DAYS; i++) {
    const episodeNum = i + 1;
    const dayYmd = addDaysYmd(BASE_YMD, i);
    const nextYmd = addDaysYmd(BASE_YMD, i + 1);

    const mainTitle = `Episode ${episodeNum} – Love, Drama & Chaos`;
    const epDesc =
      EPISODE_DESCRIPTIONS[i % EPISODE_DESCRIPTIONS.length] ?? EPISODE_DESCRIPTIONS[0];

    // 1. Main episode — same day, three linear platforms
    rows.push(
      {
        title: mainTitle,
        episodeNumber: episodeNum,
        contentType: 'episode',
        platform: 'ontv',
        airDate: parseDateOnly(dayYmd),
        startTime: parseTime('20:00:00'),
        endTime: parseTime('22:00:00'),
        description: epDesc,
        isPublished: true,
      },
      {
        title: mainTitle,
        episodeNumber: episodeNum,
        contentType: 'episode',
        platform: 'soundcity',
        airDate: parseDateOnly(dayYmd),
        startTime: parseTime('21:00:00'),
        endTime: parseTime('23:00:00'),
        description: epDesc,
        isPublished: true,
      },
      {
        title: mainTitle,
        episodeNumber: episodeNum,
        contentType: 'episode',
        platform: 'spice',
        airDate: parseDateOnly(dayYmd),
        startTime: parseTime('22:00:00'),
        endTime: parseTime('23:59:59'),
        description: epDesc,
        isPublished: true,
      },
    );

    // 2. Digital full episode — next day 10:00 AM
    rows.push({
      title: mainTitle,
      episodeNumber: episodeNum,
      contentType: 'episode',
      platform: 'digital',
      airDate: parseDateOnly(nextYmd),
      startTime: parseTime('10:00:00'),
      endTime: parseTime('12:30:00'),
      description: `${epDesc} Stream the full episode on digital the morning after linear.`,
      isPublished: true,
    });

    // 3. First Look — same day 6:00 PM, digital
    rows.push({
      title: `First Look – Episode ${episodeNum}`,
      episodeNumber: episodeNum,
      contentType: 'first_look',
      platform: 'digital',
      airDate: parseDateOnly(dayYmd),
      startTime: parseTime('18:00:00'),
      endTime: parseTime('18:25:00'),
      description:
        FIRST_LOOK_BLURBS[i % FIRST_LOOK_BLURBS.length] ?? FIRST_LOOK_BLURBS[0],
      isPublished: true,
    });

    // 4. Recap — next day 12:00 PM (platform digital for on-demand)
    rows.push({
      title: `Recap – Episode ${episodeNum}`,
      episodeNumber: episodeNum,
      contentType: 'recap',
      platform: 'digital',
      airDate: parseDateOnly(nextYmd),
      startTime: parseTime('12:00:00'),
      endTime: parseTime('12:45:00'),
      description: RECAP_BLURBS[i % RECAP_BLURBS.length] ?? RECAP_BLURBS[0],
      isPublished: true,
    });

    // 5. Podcast — next day 2:00 PM
    rows.push({
      title: `Aftersun Podcast – Episode ${episodeNum}`,
      episodeNumber: episodeNum,
      contentType: 'podcast',
      platform: 'digital',
      airDate: parseDateOnly(nextYmd),
      startTime: parseTime('14:00:00'),
      endTime: parseTime('15:00:00'),
      description: PODCAST_BLURBS[i % PODCAST_BLURBS.length] ?? PODCAST_BLURBS[0],
      isPublished: true,
    });
  }

  return rows;
}

async function main() {
  const deleted = await prisma.schedule.deleteMany({});
  console.log(`Removed ${deleted.count} existing schedule row(s).`);

  const data = buildScheduleRows();
  const result = await prisma.schedule.createMany({ data });

  console.log(
    `Inserted ${result.count} schedule row(s) (${DAYS} days × 7 slots = ${DAYS * 7}).`,
  );
  console.log(`Window: ${BASE_YMD} → ${addDaysYmd(BASE_YMD, DAYS)} (linear + follow-up slots).`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
