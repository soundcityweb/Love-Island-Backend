import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, In } from 'typeorm';
import { Vote } from '../entities/vote.entity';
import { VotingPeriod } from '../entities/voting-period.entity';
import { VotingEventContestant } from '../entities/voting-event-contestant.entity';
import { VotingEventResult } from '../entities/voting-event-result.entity';
import { Islander } from '../entities/islander.entity';
import { VotingPeriodStatus } from '../entities/voting-period-status.enum';
import { VotingService } from '../voting/voting.service';
import { VotingPreviewTokenService } from '../voting/voting-preview-token.service';
import { CreateVotingEventDto } from './dto/create-voting-event.dto';
import { UpdateVotingEventDto } from './dto/update-voting-event.dto';
import { AddContestantsDto } from './dto/add-contestants.dto';
import * as XLSX from 'xlsx';

function escapeCsvField(value: string | number): string {
  const s = String(value);
  if (/[",\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

@Injectable()
export class AdminVotingEventsService {
  constructor(
    @InjectRepository(VotingPeriod)
    private readonly periodRepository: Repository<VotingPeriod>,
    @InjectRepository(VotingEventContestant)
    private readonly contestantRepository: Repository<VotingEventContestant>,
    @InjectRepository(Islander)
    private readonly islanderRepository: Repository<Islander>,
    private readonly dataSource: DataSource,
    private readonly votingService: VotingService,
    private readonly votingPreviewToken: VotingPreviewTokenService,
  ) {}

  /**
   * Mint a short-lived signed token so the public vote page can load a draft event in preview mode.
   */
  async createPreviewToken(id: string): Promise<{ token: string; expiresAt: string }> {
    const period = await this.periodRepository.findOne({
      where: { id },
      select: { id: true, status: true },
    });
    if (!period) {
      throw new NotFoundException(`Voting period with id "${id}" not found.`);
    }
    if (period.status !== VotingPeriodStatus.DRAFT) {
      throw new BadRequestException(
        'Preview links can only be created for draft events.',
      );
    }
    return this.votingPreviewToken.createToken(id);
  }

  async findOne(id: string): Promise<VotingPeriod> {
    const period = await this.periodRepository.findOne({
      where: { id },
      select: [
        'id',
        'code',
        'name',
        'description',
        'status',
        'startsAt',
        'endsAt',
        'resultsPublic',
        'closedAt',
        'finalizedAt',
        'createdAt',
        'updatedAt',
      ],
    });
    if (!period) {
      throw new NotFoundException(`Voting period with id "${id}" not found.`);
    }
    return period;
  }

  /**
   * Update voting event. Rules by status:
   * DRAFT: name, description, startsAt, endsAt, resultsPublic.
   * OPEN: endsAt only (must extend), resultsPublic. end_time >= now.
   * CLOSED: resultsPublic only.
   * Validates start < end; transaction-safe.
   */
  async update(id: string, dto: UpdateVotingEventDto): Promise<VotingPeriod> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const repo = queryRunner.manager.getRepository(VotingPeriod);
      const period = await repo.findOne({ where: { id } });
      if (!period) {
        throw new NotFoundException(`Voting period with id "${id}" not found.`);
      }

      const status = period.status;

      if (status === VotingPeriodStatus.DRAFT) {
        if (dto.name !== undefined) period.name = dto.name;
        if (dto.description !== undefined) period.description = dto.description ?? null;
        if (dto.startsAt !== undefined) period.startsAt = new Date(dto.startsAt);
        if (dto.endsAt !== undefined) period.endsAt = new Date(dto.endsAt);
        if (dto.resultsPublic !== undefined) period.resultsPublic = dto.resultsPublic;

        if (dto.contestantIds !== undefined) {
          const contestantRepo = queryRunner.manager.getRepository(VotingEventContestant);
          const islanderRepo = queryRunner.manager.getRepository(Islander);
          const uniqueIds = [...new Set(dto.contestantIds)];

          const islanders = await islanderRepo.find({
            where: { id: In(uniqueIds) },
            select: { id: true, isPublic: true },
          });
          const foundIds = new Set(islanders.map((i) => i.id));
          const missing = uniqueIds.filter((id) => !foundIds.has(id));
          if (missing.length > 0) {
            throw new BadRequestException(`Islander(s) not found: ${missing.join(', ')}`);
          }
          const notVisible = islanders.filter((i) => !i.isPublic).map((i) => i.id);
          if (notVisible.length > 0) {
            throw new BadRequestException(
              `Islander(s) must be visible (isPublic): ${notVisible.join(', ')}`,
            );
          }

          await contestantRepo.delete({ votingPeriodId: id });
          for (const islanderId of uniqueIds) {
            await contestantRepo.save(
              contestantRepo.create({
                votingPeriodId: id,
                islanderId,
              }),
            );
          }
        }
      } else if (status === VotingPeriodStatus.OPEN) {
        if (dto.endsAt !== undefined) {
          const newEndsAt = new Date(dto.endsAt);
          if (newEndsAt.getTime() < period.endsAt.getTime()) {
            throw new BadRequestException(
              'When event is open, end date & time can only be extended, not reduced.',
            );
          }
          const now = new Date();
          if (newEndsAt.getTime() < now.getTime()) {
            throw new BadRequestException(
              'End date & time cannot be earlier than now when event is open.',
            );
          }
          period.endsAt = newEndsAt;
        }
        if (dto.resultsPublic !== undefined) period.resultsPublic = dto.resultsPublic;
      } else if (status === VotingPeriodStatus.CLOSED) {
        if (dto.resultsPublic !== undefined) period.resultsPublic = dto.resultsPublic;
      }

      const startsAt = period.startsAt.getTime();
      const endsAt = period.endsAt.getTime();
      if (startsAt >= endsAt) {
        throw new BadRequestException(
          'End date & time must be after start date & time.',
        );
      }

      const updated = await repo.save(period);
      await queryRunner.commitTransaction();
      return updated;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async create(dto: CreateVotingEventDto): Promise<VotingPeriod> {
    const startsAt = new Date(dto.startsAt);
    const endsAt = new Date(dto.endsAt);
    if (startsAt.getTime() >= endsAt.getTime()) {
      throw new BadRequestException(
        'End date & time must be after start date & time.',
      );
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const repo = queryRunner.manager.getRepository(VotingPeriod);
      const period = repo.create({
        code: dto.code,
        name: dto.name,
        description: dto.description ?? null,
        startsAt,
        endsAt,
        status: VotingPeriodStatus.DRAFT,
      });
      const created = await repo.save(period);
      await queryRunner.commitTransaction();
      return created;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Open a voting event. Only if status is DRAFT; at least one contestant; current time >= startsAt.
   * Once an event has been closed, it cannot be reopened to OPEN.
   */
  async open(id: string): Promise<VotingPeriod> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const periodRepo = queryRunner.manager.getRepository(VotingPeriod);
      const contestantRepo = queryRunner.manager.getRepository(VotingEventContestant);

      const period = await periodRepo.findOne({ where: { id } });
      if (!period) {
        throw new NotFoundException(`Voting period with id "${id}" not found.`);
      }
      if (period.status !== VotingPeriodStatus.DRAFT) {
        throw new BadRequestException(
          `Cannot open: period status is ${period.status}. Only draft periods can be opened.`,
        );
      }

      const contestantCount = await contestantRepo.count({
        where: { votingPeriodId: id },
      });
      if (contestantCount === 0) {
        throw new BadRequestException(
          'Cannot open: at least one contestant must be attached to the event.',
        );
      }

      const now = new Date();
      if (now.getTime() < period.startsAt.getTime()) {
        throw new BadRequestException(
          `Cannot open: start time has not been reached. Voting opens at ${period.startsAt.toISOString()}.`,
        );
      }

      period.status = VotingPeriodStatus.OPEN;
      const updated = await periodRepo.save(period);
      await queryRunner.commitTransaction();
      return updated;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Close a voting event. Admin-only. Requires status = OPEN.
   * Inside transaction: set status = CLOSED, closed_at; aggregate vote counts; store in voting_event_results; set finalized_at.
   * Does not modify vote records or Redis. Results endpoint reads from snapshot when finalized_at is set.
   */
  async close(id: string): Promise<VotingPeriod> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const repo = queryRunner.manager.getRepository(VotingPeriod);
      const period = await repo
        .createQueryBuilder('p')
        .where('p.id = :id', { id })
        .setLock('pessimistic_write')
        .getOne();
      if (!period) {
        throw new NotFoundException(`Voting period with id "${id}" not found.`);
      }
      if (period.status !== VotingPeriodStatus.OPEN) {
        throw new BadRequestException(
          `Cannot close: period status is ${period.status}, expected OPEN.`,
        );
      }

      period.status = VotingPeriodStatus.CLOSED;
      period.closedAt = new Date();

      const voteRepo = queryRunner.manager.getRepository(Vote);
      const rows = await voteRepo
        .createQueryBuilder('v')
        .select('v.islander_id', 'islanderId')
        .addSelect('COUNT(*)::int', 'count')
        .where('v.voting_period_id = :periodId', { periodId: id })
        .groupBy('v.islander_id')
        .getRawMany<{ islanderId: string; count: number }>();

      const resultRepo = queryRunner.manager.getRepository(VotingEventResult);
      for (const row of rows) {
        await resultRepo.save(
          resultRepo.create({
            votingPeriodId: id,
            islanderId: row.islanderId,
            voteCount: row.count,
          }),
        );
      }

      period.finalizedAt = new Date();
      const updated = await repo.save(period);
      await queryRunner.commitTransaction();
      return updated;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Publish results for a voting event by making results public.
   * Only allowed when the event status is CLOSED.
   */
  async publishResults(id: string): Promise<VotingPeriod> {
    const period = await this.periodRepository.findOne({ where: { id } });
    if (!period) {
      throw new NotFoundException(`Voting period with id "${id}" not found.`);
    }
    if (period.status !== VotingPeriodStatus.CLOSED) {
      throw new BadRequestException(
        'Results can only be published for events that are closed.',
      );
    }

    // Idempotent: if already public, just return as-is.
    if (period.resultsPublic) {
      return period;
    }

    period.resultsPublic = true;
    return this.periodRepository.save(period);
  }

  async getResults(id: string): Promise<{ islanderId: string; count: number }[]> {
    return this.votingService.getResults(id);
  }

  /**
   * Aggregated analytics for admin dashboard: totals, per-islander votes + %, time series.
   * Uses existing getResults + one time-bucket query on votes.
   */
  async getAnalytics(id: string): Promise<{
    eventId: string;
    eventName: string;
    totalVotes: number;
    contestants: {
      islanderId: string;
      name: string;
      votes: number;
      percentage: number;
    }[];
    timeSeries: { bucketStart: string; count: number }[];
    timeSeriesBucket: 'hour' | 'day';
  }> {
    const period = await this.periodRepository.findOne({
      where: { id },
      select: { id: true, name: true, startsAt: true, endsAt: true },
    });
    if (!period) {
      throw new NotFoundException(`Voting period with id "${id}" not found.`);
    }

    const results = await this.votingService.getResults(id);
    const islanderIds = [...new Set(results.map((r) => r.islanderId))];
    const islanders =
      islanderIds.length === 0
        ? []
        : await this.islanderRepository.find({
            where: { id: In(islanderIds) },
            select: { id: true, firstName: true, lastName: true },
          });
    const nameById = new Map(
      islanders.map((i) => [
        i.id,
        [i.firstName, i.lastName].filter(Boolean).join(' '),
      ]),
    );

    const totalVotes = results.reduce((sum, r) => sum + r.count, 0);

    const contestants = results
      .map((r) => {
        const votes = r.count;
        const percentage =
          totalVotes === 0
            ? 0
            : Math.round((votes * 10000) / totalVotes) / 100;
        return {
          islanderId: r.islanderId,
          name: nameById.get(r.islanderId) ?? 'Unknown',
          votes,
          percentage,
        };
      })
      .sort((a, b) => b.votes - a.votes);

    const durationMs = period.endsAt.getTime() - period.startsAt.getTime();
    const timeSeriesBucket: 'hour' | 'day' =
      durationMs <= 72 * 60 * 60 * 1000 ? 'hour' : 'day';

    const timeSeries = await this.votingService.getVotesTimeSeries(
      id,
      timeSeriesBucket,
    );

    return {
      eventId: period.id,
      eventName: period.name,
      totalVotes,
      contestants,
      timeSeries,
      timeSeriesBucket,
    };
  }

  /**
   * Build CSV or XLSX export for admin (event name, islander name, votes, export timestamp).
   * Suitable for large result sets: CSV is built in one pass; XLSX buffers in memory.
   */
  async buildVotingExport(
    id: string,
    format: 'csv' | 'xlsx',
  ): Promise<{ buffer: Buffer; filename: string; mimeType: string }> {
    const period = await this.periodRepository.findOne({
      where: { id },
      select: { id: true, name: true },
    });
    if (!period) {
      throw new NotFoundException(`Voting period with id "${id}" not found.`);
    }

    const results = await this.votingService.getResults(id);
    const islanderIds = [...new Set(results.map((r) => r.islanderId))];
    const islanders =
      islanderIds.length === 0
        ? []
        : await this.islanderRepository.find({
            where: { id: In(islanderIds) },
            select: { id: true, firstName: true, lastName: true },
          });
    const nameById = new Map(
      islanders.map((i) => [
        i.id,
        [i.firstName, i.lastName].filter(Boolean).join(' '),
      ]),
    );

    const exportedAt = new Date();
    const exportedAtIso = exportedAt.toISOString();

    const rows = results
      .map((r) => ({
        eventName: period.name,
        islanderName: nameById.get(r.islanderId) ?? 'Unknown',
        totalVotes: r.count,
        exportTimestamp: exportedAtIso,
      }))
      .sort((a, b) => b.totalVotes - a.totalVotes);

    const safeSlug = this.slugifyForFilename(period.name);
    const ts = exportedAt.toISOString().replace(/[:.]/g, '-').slice(0, 19);

    if (format === 'csv') {
      const header = [
        'Event Name',
        'Islander Name',
        'Total Votes',
        'Export Timestamp',
      ];
      const lines = [
        header.map(escapeCsvField).join(','),
        ...rows.map((row) =>
          [
            row.eventName,
            row.islanderName,
            row.totalVotes,
            row.exportTimestamp,
          ]
            .map(escapeCsvField)
            .join(','),
        ),
      ];
      const csv = '\uFEFF' + lines.join('\r\n');
      return {
        buffer: Buffer.from(csv, 'utf-8'),
        filename: `voting-results-${safeSlug}-${ts}.csv`,
        mimeType: 'text/csv; charset=utf-8',
      };
    }

    const sheetData: (string | number)[][] = [
      ['Event Name', 'Islander Name', 'Total Votes', 'Export Timestamp'],
      ...rows.map((r) => [
        r.eventName,
        r.islanderName,
        r.totalVotes,
        r.exportTimestamp,
      ]),
    ];
    const ws = XLSX.utils.aoa_to_sheet(sheetData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Results');
    const buffer = XLSX.write(wb, {
      type: 'buffer',
      bookType: 'xlsx',
    }) as Buffer;

    return {
      buffer,
      filename: `voting-results-${safeSlug}-${ts}.xlsx`,
      mimeType:
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    };
  }

  private slugifyForFilename(name: string): string {
    const slug = name
      .normalize('NFKD')
      .replace(/[^\w\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .slice(0, 80);
    return slug || 'event';
  }

  /**
   * Attach islanders as contestants to a voting event. Validates: islander exists, is visible (isPublic), no duplicates.
   */
  async addContestants(periodId: string, dto: AddContestantsDto): Promise<{ added: number; contestantIds: string[] }> {
    const period = await this.periodRepository.findOne({ where: { id: periodId } });
    if (!period) {
      throw new NotFoundException(`Voting period with id "${periodId}" not found.`);
    }

    const uniqueIds = [...new Set(dto.islanderIds)];
    if (uniqueIds.length !== dto.islanderIds.length) {
      throw new BadRequestException('Duplicate islander IDs are not allowed.');
    }

    const islanders = await this.islanderRepository.find({
      where: { id: In(uniqueIds) },
      select: { id: true, isPublic: true },
    });
    const foundIds = new Set(islanders.map((i) => i.id));
    const missing = uniqueIds.filter((id) => !foundIds.has(id));
    if (missing.length > 0) {
      throw new BadRequestException(`Islander(s) not found: ${missing.join(', ')}`);
    }
    const notVisible = islanders.filter((i) => !i.isPublic).map((i) => i.id);
    if (notVisible.length > 0) {
      throw new BadRequestException(
        `Islander(s) must be visible (isPublic): ${notVisible.join(', ')}`,
      );
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const repo = queryRunner.manager.getRepository(VotingEventContestant);
      const existing = await repo.find({
        where: { votingPeriodId: periodId, islanderId: In(uniqueIds) },
        select: { islanderId: true },
      });
      const existingSet = new Set(existing.map((c) => c.islanderId));
      const toAdd = uniqueIds.filter((id) => !existingSet.has(id));

      const created = await Promise.all(
        toAdd.map((islanderId) =>
          repo.save(
            repo.create({
              votingPeriodId: periodId,
              islanderId,
            }),
          ),
        ),
      );
      await queryRunner.commitTransaction();
      return {
        added: created.length,
        contestantIds: created.map((c) => c.id),
      };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }
}
