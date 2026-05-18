import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, type Schedule, SchedulePlatform } from '@prisma/client';
import { DateTime } from 'luxon';
import { PrismaService } from '../prisma/prisma.service';
import { CreateScheduleDto } from './dto/create-schedule.dto';
import { UpdateScheduleDto } from './dto/update-schedule.dto';
import { QueryScheduleDto, ScheduleView } from './dto/query-schedule.dto';

export type ScheduleStatus = 'live' | 'upcoming' | 'completed';

/** Weekly buckets (Monday → Sunday), lowercase keys. */
export type WeeklyDayKey =
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday'
  | 'sunday';

const WEEK_DAY_KEYS: WeeklyDayKey[] = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
];

const PLATFORM_ORDER: SchedulePlatform[] = [
  'ontv',
  'soundcity',
  'spice',
  'digital',
];

const PUBLIC_LISTING_ORDER_BY: Prisma.ScheduleOrderByWithRelationInput[] = [
  { airDate: 'asc' },
  { startTime: 'asc' },
  { id: 'asc' },
];

export type ScheduleSlotJson = {
  id: string;
  title: string;
  episodeNumber: number | null;
  contentType: Schedule['contentType'];
  platform: SchedulePlatform;
  date: string;
  startTime: string;
  endTime: string | null;
  description: string | null;
  isPublished: boolean;
  createdAt: string;
  status: ScheduleStatus;
  isNowPlaying: boolean;
};

type SlotCtx = { now: DateTime; tz: string };

@Injectable()
export class ScheduleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  private scheduleTz(): string {
    return (
      this.config.get<string>('app.scheduleTimezone') ?? 'Africa/Lagos'
    );
  }

  private ctx(): SlotCtx {
    const tz = this.scheduleTz();
    return { now: DateTime.now().setZone(tz), tz };
  }

  async create(dto: CreateScheduleDto): Promise<{ schedule: ScheduleSlotJson }> {
    const row = await this.prisma.schedule.create({
      data: {
        title: dto.title,
        episodeNumber: dto.episodeNumber ?? null,
        contentType: dto.contentType,
        platform: dto.platform,
        airDate: this.parseDateOnly(dto.date),
        startTime: this.parseTime(dto.startTime),
        endTime: dto.endTime ? this.parseTime(dto.endTime) : null,
        description: dto.description ?? null,
        isPublished: dto.isPublished ?? true,
      },
    });
    return { schedule: this.toSlot(row, this.ctx()) };
  }

  async findAllAdmin(limit?: number) {
    const ctx = this.ctx();
    const cap = Math.min(Math.max(limit ?? 200, 1), 500);
    const rows = await this.prisma.schedule.findMany({
      take: cap,
      orderBy: [{ airDate: 'desc' }, { startTime: 'desc' }, { id: 'desc' }],
    });
    return { data: rows.map((r) => this.toSlot(r, ctx)) };
  }

  async update(id: string, dto: UpdateScheduleDto) {
    await this.ensureScheduleExists(id);
    const data = this.buildUpdateData(dto);
    const row = await this.prisma.schedule.update({
      where: { id },
      data,
    });
    return { schedule: this.toSlot(row, this.ctx()) };
  }

  async togglePublished(id: string) {
    const row = await this.prisma.schedule.findUnique({ where: { id } });
    if (!row) {
      throw new NotFoundException('Schedule not found');
    }
    const updated = await this.prisma.schedule.update({
      where: { id },
      data: { isPublished: !row.isPublished },
    });
    return { schedule: this.toSlot(updated, this.ctx()) };
  }

  async remove(id: string) {
    await this.ensureScheduleExists(id);
    await this.prisma.schedule.delete({ where: { id } });
    return { deleted: true as const };
  }

  async findWithView(query: QueryScheduleDto) {
    const view = query.view ?? ScheduleView.daily;
    switch (view) {
      case ScheduleView.weekly:
        return this.findWeeklyGrouped(query);
      case ScheduleView.episode:
        return this.findGroupedByEpisode(query);
      default:
        return this.findDaily(query);
    }
  }

  async findDaily(query: QueryScheduleDto) {
    const ctx = this.ctx();
    if (query.date) {
      return this.findDailySingleDay(query, ctx);
    }
    return this.findDailyAllPaginated(query, ctx);
  }

  /** One calendar day of published slots. */
  private async findDailySingleDay(query: QueryScheduleDto, ctx: SlotCtx) {
    const dateStr = query.date!;
    const where = this.buildWhere({
      airDate: dateStr,
      platform: query.platform,
    });
    const rows = await this.prisma.schedule.findMany({
      where,
      orderBy: [{ startTime: 'asc' }, { id: 'asc' }],
    });
    return {
      view: ScheduleView.daily,
      listMode: 'day' as const,
      date: dateStr,
      timezone: ctx.tz,
      filters: this.filtersMeta(query.platform),
      items: rows.map((r) => this.toSlot(r, ctx)),
      hasMore: false as const,
      nextOffset: null as null,
    };
  }

  /** All published slots, chronological, offset/limit (for infinite scroll). */
  private async findDailyAllPaginated(query: QueryScheduleDto, ctx: SlotCtx) {
    const limit = Math.min(Math.max(query.limit ?? 30, 1), 100);
    const offset = Math.max(query.offset ?? 0, 0);
    const todayYmd = this.todayYmdInZone(ctx.tz);
    const where: Prisma.ScheduleWhereInput = {
      ...this.buildListedWhere(query.platform),
      airDate: { gte: this.parseDateOnly(todayYmd) },
    };
    const { page, hasMore } = await this.sliceVisibleSchedules({
      where,
      offset,
      limit,
      ctx,
    });
    return {
      view: ScheduleView.daily,
      listMode: 'all' as const,
      date: null,
      timezone: ctx.tz,
      filters: this.filtersMeta(query.platform),
      items: page.map((r) => this.toSlot(r, ctx)),
      hasMore,
      nextOffset: hasMore ? offset + limit : null,
    };
  }

  async findWeeklyGrouped(query: QueryScheduleDto) {
    const ctx = this.ctx();
    const anchor = query.date ?? this.todayYmdInZone(ctx.tz);
    const monday = this.mondayOfWeekInZone(anchor, ctx.tz);
    const weekStart = monday.toISODate()!;
    const sunday = monday.plus({ days: 6 });
    const weekEnd = sunday.toISODate()!;
    const where: Prisma.ScheduleWhereInput = {
      ...this.publishedOnlyWhere(),
      ...this.platformFilter(query.platform),
      airDate: {
        gte: this.parseDateOnly(weekStart),
        lte: this.parseDateOnly(weekEnd),
      },
    };
    const rows = await this.prisma.schedule.findMany({
      where,
      orderBy: PUBLIC_LISTING_ORDER_BY,
    });
    const byDate = new Map<string, Schedule[]>();
    for (const row of rows) {
      const key = this.storageDateYmd(row.airDate);
      const list = byDate.get(key) ?? [];
      list.push(row);
      byDate.set(key, list);
    }
    const buckets = this.emptyWeekBuckets();
    for (let i = 0; i < 7; i++) {
      const day = monday.plus({ days: i });
      const ymd = day.toISODate()!;
      const key = WEEK_DAY_KEYS[i];
      const slots = (byDate.get(ymd) ?? [])
        .filter((r) => this.isSlotStillPublicVisible(r, ctx))
        .map((r) => this.toSlot(r, ctx));
      buckets[key] = slots;
    }
    return {
      view: ScheduleView.weekly,
      timezone: ctx.tz,
      weekStart,
      weekEnd,
      filters: this.filtersMeta(query.platform),
      monday: buckets.monday,
      tuesday: buckets.tuesday,
      wednesday: buckets.wednesday,
      thursday: buckets.thursday,
      friday: buckets.friday,
      saturday: buckets.saturday,
      sunday: buckets.sunday,
    };
  }

  async findGroupedByEpisode(query: QueryScheduleDto) {
    const ctx = this.ctx();
    const where: Prisma.ScheduleWhereInput = {
      ...this.publishedOnlyWhere(),
      ...this.platformFilter(query.platform),
    };
    const rows = await this.prisma.schedule.findMany({
      where,
      orderBy: [
        { episodeNumber: { sort: 'asc', nulls: 'last' } },
        { airDate: 'asc' },
        { startTime: 'asc' },
        { id: 'asc' },
      ],
    });
    const visibleRows = rows.filter((r) => this.isSlotStillPublicVisible(r, ctx));
    const groupsMap = new Map<
      string,
      { episodeNumber: number | null; byPlatform: Map<SchedulePlatform, Schedule[]> }
    >();
    for (const row of visibleRows) {
      const key =
        row.episodeNumber === null || row.episodeNumber === undefined
          ? '__null__'
          : String(row.episodeNumber);
      let g = groupsMap.get(key);
      if (!g) {
        g = {
          episodeNumber: row.episodeNumber ?? null,
          byPlatform: new Map(),
        };
        groupsMap.set(key, g);
      }
      const list = g.byPlatform.get(row.platform) ?? [];
      list.push(row);
      g.byPlatform.set(row.platform, list);
    }
    const groups = [...groupsMap.values()]
      .map((g) => {
        const platforms = [...g.byPlatform.entries()]
          .sort(([a], [b]) => this.platformRank(a) - this.platformRank(b))
          .map(([platform, items]) => ({
            platform,
            entries: items.map((r) => this.toSlot(r, ctx)),
          }))
          .filter((p) => p.entries.length > 0);
        return {
          episodeNumber: g.episodeNumber,
          platforms,
        };
      })
      .filter((g) => g.platforms.length > 0);
    groups.sort((a, b) => {
      if (a.episodeNumber === null && b.episodeNumber === null) return 0;
      if (a.episodeNumber === null) return 1;
      if (b.episodeNumber === null) return -1;
      return a.episodeNumber - b.episodeNumber;
    });
    return {
      view: ScheduleView.episode,
      timezone: ctx.tz,
      filters: this.filtersMeta(query.platform),
      groups,
    };
  }

  async findWeeklyRoute(query: QueryScheduleDto) {
    const body = await this.findWeeklyGrouped(query);
    return {
      timezone: body.timezone,
      weekStart: body.weekStart,
      weekEnd: body.weekEnd,
      filters: body.filters,
      monday: body.monday,
      tuesday: body.tuesday,
      wednesday: body.wednesday,
      thursday: body.thursday,
      friday: body.friday,
      saturday: body.saturday,
      sunday: body.sunday,
    };
  }

  async findEpisodesRoute(query: QueryScheduleDto) {
    const body = await this.findGroupedByEpisode(query);
    return {
      timezone: body.timezone,
      filters: body.filters,
      groups: body.groups,
    };
  }

  async findTodayTimeline(query: QueryScheduleDto) {
    const ctx = this.ctx();
    const dateStr = this.todayYmdInZone(ctx.tz);
    const where = this.buildWhere({
      airDate: dateStr,
      platform: query.platform,
    });
    const rows = await this.prisma.schedule.findMany({
      where,
      orderBy: [{ startTime: 'asc' }, { id: 'asc' }],
    });
    const visible = rows.filter((r) => this.isSlotStillPublicVisible(r, ctx));
    return {
      date: dateStr,
      timezone: ctx.tz,
      filters: this.filtersMeta(query.platform),
      timeline: visible.map((r) => this.toSlot(r, ctx)),
    };
  }

  /**
   * Public listings only: slot is hidden once its end time (or end of air day) has passed
   * in the configured schedule timezone.
   */
  private isSlotStillPublicVisible(row: Schedule, ctx: SlotCtx): boolean {
    const { end } = this.zonedRange(row, ctx.tz);
    return ctx.now <= end;
  }

  /**
   * Paginate over DB rows in order, counting only {@link isSlotStillPublicVisible} rows,
   * so `offset` / `limit` apply to what the public site actually shows.
   */
  private async sliceVisibleSchedules(opts: {
    where: Prisma.ScheduleWhereInput;
    offset: number;
    limit: number;
    ctx: SlotCtx;
  }): Promise<{ page: Schedule[]; hasMore: boolean }> {
    const { where, offset, limit, ctx } = opts;
    const batchSize = 100;
    let dbSkip = 0;
    let visibleSeen = 0;
    const out: Schedule[] = [];

    load: while (out.length < limit + 1) {
      const batch = await this.prisma.schedule.findMany({
        where,
        orderBy: PUBLIC_LISTING_ORDER_BY,
        skip: dbSkip,
        take: batchSize,
      });
      if (batch.length === 0) break;

      for (const row of batch) {
        if (!this.isSlotStillPublicVisible(row, ctx)) continue;
        visibleSeen++;
        if (visibleSeen <= offset) continue;
        out.push(row);
        if (out.length >= limit + 1) break load;
      }

      dbSkip += batch.length;
      if (batch.length < batchSize) break;
    }

    const hasMore = out.length > limit;
    const page = hasMore ? out.slice(0, limit) : out;
    return { page, hasMore };
  }

  private emptyWeekBuckets(): Record<WeeklyDayKey, ScheduleSlotJson[]> {
    return {
      monday: [],
      tuesday: [],
      wednesday: [],
      thursday: [],
      friday: [],
      saturday: [],
      sunday: [],
    };
  }

  private platformRank(p: SchedulePlatform): number {
    const i = PLATFORM_ORDER.indexOf(p);
    return i === -1 ? 999 : i;
  }

  private filtersMeta(platform?: SchedulePlatform) {
    return { platform: platform ?? null };
  }

  private publishedOnlyWhere(): Prisma.ScheduleWhereInput {
    return { isPublished: true };
  }

  private platformFilter(platform?: SchedulePlatform): Prisma.ScheduleWhereInput {
    return platform ? { platform } : {};
  }

  /** Published listings, optional platform — no airDate filter. */
  private buildListedWhere(platform?: SchedulePlatform): Prisma.ScheduleWhereInput {
    return {
      ...this.publishedOnlyWhere(),
      ...this.platformFilter(platform),
    };
  }

  private buildWhere(opts: {
    airDate: string;
    platform?: SchedulePlatform;
  }): Prisma.ScheduleWhereInput {
    return {
      ...this.publishedOnlyWhere(),
      ...this.platformFilter(opts.platform),
      airDate: this.parseDateOnly(opts.airDate),
    };
  }

  private async ensureScheduleExists(id: string): Promise<void> {
    const n = await this.prisma.schedule.count({ where: { id } });
    if (n === 0) {
      throw new NotFoundException('Schedule not found');
    }
  }

  private buildUpdateData(dto: UpdateScheduleDto): Prisma.ScheduleUpdateInput {
    const data: Prisma.ScheduleUpdateInput = {};
    if (dto.title !== undefined) {
      data.title = dto.title;
    }
    if (dto.episodeNumber !== undefined) {
      data.episodeNumber = dto.episodeNumber;
    }
    if (dto.contentType !== undefined) {
      data.contentType = dto.contentType;
    }
    if (dto.platform !== undefined) {
      data.platform = dto.platform;
    }
    if (dto.date !== undefined) {
      data.airDate = this.parseDateOnly(dto.date);
    }
    if (dto.startTime !== undefined) {
      data.startTime = this.parseTime(dto.startTime);
    }
    if (dto.endTime !== undefined) {
      data.endTime =
        dto.endTime && dto.endTime.trim() !== ''
          ? this.parseTime(dto.endTime)
          : null;
    }
    if (dto.description !== undefined) {
      data.description = dto.description || null;
    }
    if (dto.isPublished !== undefined) {
      data.isPublished = dto.isPublished;
    }
    return data;
  }

  private toSlot(row: Schedule, ctx: SlotCtx): ScheduleSlotJson {
    const { status, isNowPlaying } = this.computeStatus(row, ctx);
    return {
      id: row.id,
      title: row.title,
      episodeNumber: row.episodeNumber,
      contentType: row.contentType,
      platform: row.platform,
      date: this.storageDateYmd(row.airDate),
      startTime: this.formatTime(row.startTime),
      endTime: row.endTime ? this.formatTime(row.endTime) : null,
      description: row.description,
      isPublished: row.isPublished,
      createdAt: row.createdAt.toISOString(),
      status,
      isNowPlaying,
    };
  }

  private computeStatus(
    row: Schedule,
    ctx: SlotCtx,
  ): { status: ScheduleStatus; isNowPlaying: boolean } {
    const { start, end } = this.zonedRange(row, ctx.tz);
    const { now } = ctx;
    if (now < start) {
      return { status: 'upcoming', isNowPlaying: false };
    }
    if (now <= end) {
      return { status: 'live', isNowPlaying: true };
    }
    return { status: 'completed', isNowPlaying: false };
  }

  /**
   * Interprets stored calendar date + wall-clock time in `tz` and returns an inclusive
   * window [start, end] as Luxon instants. Missing `end_time` uses end-of-day in `tz`.
   */
  private zonedRange(row: Schedule, tz: string): { start: DateTime; end: DateTime } {
    const dateYmd = this.storageDateYmd(row.airDate);
    const start = this.wallTimeOnDate(dateYmd, row.startTime, tz);
    let end: DateTime;
    if (row.endTime) {
      end = this.wallTimeOnDate(dateYmd, row.endTime, tz);
      if (end <= start) {
        end = end.plus({ days: 1 });
      }
    } else {
      end = DateTime.fromISO(dateYmd, { zone: tz }).endOf('day');
    }
    return { start, end };
  }

  private wallTimeOnDate(dateYmd: string, time: Date, tz: string): DateTime {
    const h = time.getUTCHours();
    const m = time.getUTCMinutes();
    const s = time.getUTCSeconds();
    const ms = time.getUTCMilliseconds();
    return DateTime.fromISO(`${dateYmd}T00:00:00`, { zone: tz }).set({
      hour: h,
      minute: m,
      second: s,
      millisecond: ms,
    });
  }

  /** Calendar YYYY-MM-DD for a Postgres `date` / Prisma @db.Date (UTC midnight). */
  private storageDateYmd(d: Date): string {
    return d.toISOString().slice(0, 10);
  }

  private todayYmdInZone(tz: string): string {
    return DateTime.now().setZone(tz).toISODate()!;
  }

  private mondayOfWeekInZone(anchorYmd: string, tz: string): DateTime {
    const dt = DateTime.fromISO(anchorYmd, { zone: tz });
    const weekday = dt.weekday;
    return dt.minus({ days: weekday - 1 }).startOf('day');
  }

  private parseDateOnly(ymd: string): Date {
    return new Date(`${ymd}T00:00:00.000Z`);
  }

  private parseTime(hms: string): Date {
    const [h = '0', m = '0', s = '0'] = hms.trim().split(':');
    return new Date(
      Date.UTC(1970, 0, 1, parseInt(h, 10), parseInt(m, 10), parseInt(s, 10)),
    );
  }

  private formatTime(t: Date): string {
    const h = t.getUTCHours().toString().padStart(2, '0');
    const m = t.getUTCMinutes().toString().padStart(2, '0');
    const s = t.getUTCSeconds().toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
  }
}
