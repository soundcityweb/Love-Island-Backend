import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
  PayloadTooLargeException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThanOrEqual } from 'typeorm';
import { EmailService } from '../common/services/email.service';
import { CloudinaryService } from '../common/cloudinary/cloudinary.service';
import { RedisService } from '../redis/redis.service';
import {
  ContactAutoCategory,
  ContactMessage,
  ContactMessageStatus,
  ContactSubject,
} from '../entities/contact-message.entity';
import { ContactMessageReply } from '../entities/contact-message-reply.entity';
import { CreateContactDto } from './dto/create-contact.dto';
import { ListContactMessagesDto } from './dto/list-contact-messages.dto';
import { UpdateContactStatusDto } from './dto/update-contact-status.dto';
import { ReplyContactDto } from './dto/reply-contact.dto';
import { detectAutoCategory, detectUrgent } from './contact-auto-tag.util';
import { isHoneypotTriggered, looksLikeSpamMessage } from './contact-spam.util';

const CONTACT_IP_LIMIT = 5;
const CONTACT_IP_WINDOW_SEC = 3600;
const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
]);

/** In-memory fallback when Redis is unavailable. */
const memContactLimits = new Map<string, { count: number; resetAt: number }>();

function clientIp(req: { headers: Record<string, string | string[] | undefined>; ip?: string; socket?: { remoteAddress?: string } }): string {
  const xf = req.headers['x-forwarded-for'];
  if (typeof xf === 'string') return xf.split(',')[0].trim();
  return req.ip ?? req.socket?.remoteAddress ?? 'unknown';
}

@Injectable()
export class ContactService {
  private readonly logger = new Logger(ContactService.name);

  constructor(
    @InjectRepository(ContactMessage)
    private readonly messages: Repository<ContactMessage>,
    @InjectRepository(ContactMessageReply)
    private readonly replies: Repository<ContactMessageReply>,
    private readonly email: EmailService,
    private readonly cloudinary: CloudinaryService,
    private readonly redis: RedisService,
  ) {}

  async assertIpRateLimit(ip: string): Promise<void> {
    const key = `contact:submit:ip:${ip}`;
    const n = await this.redis.incrWithTtl(key, CONTACT_IP_WINDOW_SEC);
    if (n != null) {
      if (n > CONTACT_IP_LIMIT) {
        throw new HttpException(
          'Too many contact submissions from this address. Try again later.',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
      return;
    }
    const now = Date.now();
    const windowMs = CONTACT_IP_WINDOW_SEC * 1000;
    let entry = memContactLimits.get(ip);
    if (!entry || entry.resetAt < now) {
      entry = { count: 0, resetAt: now + windowMs };
      memContactLimits.set(ip, entry);
    }
    entry.count += 1;
    if (entry.count > CONTACT_IP_LIMIT) {
      throw new HttpException(
        'Too many contact submissions from this address. Try again later.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  async submit(
    dto: CreateContactDto,
    file: { buffer: Buffer; mimetype: string; size: number } | undefined,
    req: { headers: Record<string, string | string[] | undefined>; ip?: string; socket?: { remoteAddress?: string } },
  ): Promise<{ id: string; ok: true }> {
    const ip = clientIp(req);
    await this.assertIpRateLimit(ip);

    if (isHoneypotTriggered(dto.website)) {
      this.logger.warn(`Contact honeypot triggered from IP ${ip}`);
      throw new BadRequestException('Invalid submission.');
    }

    if (!dto.privacyConsent) {
      throw new BadRequestException('Privacy consent is required.');
    }

    if (looksLikeSpamMessage(dto.message)) {
      throw new BadRequestException('Message could not be sent. Please revise and try again.');
    }

    let attachmentUrl: string | null = null;
    if (file?.buffer?.length) {
      if (file.size > 5 * 1024 * 1024) {
        throw new PayloadTooLargeException('Attachment must be 5MB or smaller.');
      }
      const mime = (file.mimetype || '').toLowerCase();
      if (!ALLOWED_MIME.has(mime)) {
        throw new BadRequestException('Only images (JPEG, PNG, GIF, WebP) or PDF are allowed.');
      }
      const resourceType = mime === 'application/pdf' ? 'raw' : 'image';
      const folder = 'contact-attachments';
      const up = await this.cloudinary.uploadBuffer(file.buffer, folder, resourceType);
      attachmentUrl = up.secureUrl;
    }

    const category = detectAutoCategory(dto.message, dto.subject);
    const isUrgent = detectUrgent(dto.message);

    const entity = this.messages.create({
      name: dto.name.trim(),
      email: dto.email.trim().toLowerCase(),
      phone: dto.phone?.trim() || null,
      subject: dto.subject,
      message: dto.message.trim(),
      attachmentUrl,
      status: ContactMessageStatus.NEW,
      category,
      isUrgent,
    });

    const saved = await this.messages.save(entity);

    await this.email.sendContactFormAdminNotification({
      id: saved.id,
      name: saved.name,
      email: saved.email,
      subject: saved.subject,
      messagePreview: saved.message.slice(0, 400),
      isUrgent: saved.isUrgent,
    });

    // Stagger second mail to reduce "too many emails per second" on dev SMTP (e.g. Mailtrap).
    await new Promise((r) => setTimeout(r, 800));

    await this.email.sendContactFormAutoReply(saved.email, saved.name);

    await this.notifySlackNewContact(saved).catch((e) =>
      this.logger.warn(`Slack notify failed: ${e instanceof Error ? e.message : e}`),
    );

    return { id: saved.id, ok: true };
  }

  private async notifySlackNewContact(msg: ContactMessage): Promise<void> {
    const url = process.env.SLACK_CONTACT_WEBHOOK_URL?.trim();
    if (!url) return;

    const text = [
      '*New contact message*',
      `*From:* ${msg.name} <${msg.email}>`,
      `*Subject:* ${msg.subject}`,
      `*Category:* ${msg.category}${msg.isUrgent ? ' :rotating_light: *urgent*' : ''}`,
      `*Preview:* ${msg.message.slice(0, 200).replace(/\n/g, ' ')}…`,
    ].join('\n');

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) {
      this.logger.warn(`Slack webhook returned ${res.status}`);
    }
  }

  async listAdmin(dto: ListContactMessagesDto) {
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 20;
    const qb = this.messages.createQueryBuilder('m').orderBy('m.createdAt', 'DESC');

    if (dto.status) qb.andWhere('m.status = :status', { status: dto.status });
    if (dto.q?.trim()) {
      const q = `%${dto.q.trim()}%`;
      qb.andWhere('(m.name ILIKE :q OR m.email ILIKE :q)', { q });
    }
    if (dto.from && dto.to) {
      qb.andWhere('m.createdAt BETWEEN :from AND :to', {
        from: new Date(dto.from),
        to: new Date(dto.to),
      });
    } else if (dto.from) {
      qb.andWhere('m.createdAt >= :from', { from: new Date(dto.from) });
    } else if (dto.to) {
      qb.andWhere('m.createdAt <= :to', { to: new Date(dto.to) });
    }

    const total = await qb.getCount();
    const data = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getMany();

    return {
      data: data.map((m) => ({
        id: m.id,
        name: m.name,
        email: m.email,
        phone: m.phone,
        subject: m.subject,
        status: m.status,
        category: m.category,
        isUrgent: m.isUrgent,
        createdAt: m.createdAt.toISOString(),
        hasAttachment: Boolean(m.attachmentUrl),
      })),
      total,
      page,
      limit,
    };
  }

  async statsNewCount(): Promise<{ newCount: number }> {
    const newCount = await this.messages.count({
      where: { status: ContactMessageStatus.NEW },
    });
    return { newCount };
  }

  async findOneAdmin(id: string) {
    const m = await this.messages.findOne({
      where: { id },
      relations: ['replies'],
    });
    if (!m) throw new NotFoundException('Message not found.');
    const replies = [...(m.replies ?? [])].sort(
      (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
    );
    return {
      id: m.id,
      name: m.name,
      email: m.email,
      phone: m.phone,
      subject: m.subject,
      message: m.message,
      attachmentUrl: m.attachmentUrl,
      status: m.status,
      category: m.category,
      isUrgent: m.isUrgent,
      firstResponseAt: m.firstResponseAt?.toISOString() ?? null,
      createdAt: m.createdAt.toISOString(),
      updatedAt: m.updatedAt.toISOString(),
      replies: replies.map((r) => ({
        id: r.id,
        body: r.body,
        sentByLabel: r.sentByLabel,
        createdAt: r.createdAt.toISOString(),
      })),
    };
  }

  async updateStatus(id: string, dto: UpdateContactStatusDto) {
    const m = await this.messages.findOne({ where: { id } });
    if (!m) throw new NotFoundException('Message not found.');
    m.status = dto.status;
    await this.messages.save(m);
    return { ok: true };
  }

  async reply(id: string, dto: ReplyContactDto) {
    const m = await this.messages.findOne({ where: { id } });
    if (!m) throw new NotFoundException('Message not found.');

    const reply = this.replies.create({
      contactMessageId: m.id,
      body: dto.body.trim(),
      sentByLabel: dto.sentByLabel?.trim() || 'Love Island Nigeria Support',
    });
    await this.replies.save(reply);

    if (!m.firstResponseAt) {
      m.firstResponseAt = new Date();
      await this.messages.save(m);
    }

    await this.email.sendContactReplyToUser(
      m.email,
      m.name,
      dto.body.trim(),
      reply.sentByLabel ?? undefined,
    );

    return { ok: true, replyId: reply.id };
  }

  async exportCsv(dto: ListContactMessagesDto): Promise<string> {
    const qb = this.messages.createQueryBuilder('m').orderBy('m.createdAt', 'DESC');
    if (dto.status) qb.andWhere('m.status = :status', { status: dto.status });
    if (dto.q?.trim()) {
      const q = `%${dto.q.trim()}%`;
      qb.andWhere('(m.name ILIKE :q OR m.email ILIKE :q)', { q });
    }
    if (dto.from && dto.to) {
      qb.andWhere('m.createdAt BETWEEN :from AND :to', {
        from: new Date(dto.from),
        to: new Date(dto.to),
      });
    } else if (dto.from) {
      qb.andWhere('m.createdAt >= :from', { from: new Date(dto.from) });
    } else if (dto.to) {
      qb.andWhere('m.createdAt <= :to', { to: new Date(dto.to) });
    }

    const rows = await qb.getMany();
    const header = [
      'id',
      'name',
      'email',
      'phone',
      'subject',
      'status',
      'category',
      'is_urgent',
      'created_at',
      'message',
    ];
    const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
    const lines = [
      header.join(','),
      ...rows.map((m) =>
        [
          m.id,
          esc(m.name),
          esc(m.email),
          m.phone ? esc(m.phone) : '',
          m.subject,
          m.status,
          m.category,
          m.isUrgent ? 'true' : 'false',
          m.createdAt.toISOString(),
          esc(m.message),
        ].join(','),
      ),
    ];
    return lines.join('\n');
  }

  async analyticsSummary() {
    const since = new Date();
    since.setUTCDate(since.getUTCDate() - 30);
    const recent = await this.messages.find({
      where: { createdAt: MoreThanOrEqual(since) },
      select: ['id', 'createdAt'],
    });
    const byDayMap = new Map<string, number>();
    for (const r of recent) {
      const d = r.createdAt.toISOString().slice(0, 10);
      byDayMap.set(d, (byDayMap.get(d) ?? 0) + 1);
    }
    const byDay = [...byDayMap.entries()]
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => b.date.localeCompare(a.date));

    const subjectRaw = await this.messages
      .createQueryBuilder('m')
      .select('m.subject', 'subject')
      .addSelect('COUNT(*)', 'c')
      .groupBy('m.subject')
      .getRawMany<{ subject: string; c: string }>();

    const avgMs = await this.messages
      .createQueryBuilder('m')
      .select('AVG(EXTRACT(EPOCH FROM (m.firstResponseAt - m.createdAt)))', 'avg')
      .where('m.firstResponseAt IS NOT NULL')
      .getRawOne<{ avg: string | null }>();

    const avgSeconds = avgMs?.avg != null ? parseFloat(avgMs.avg) : null;
    const avgResponseHours =
      avgSeconds != null && !Number.isNaN(avgSeconds) ? avgSeconds / 3600 : null;

    return {
      byDay,
      subjectCounts: subjectRaw.map((r) => ({
        subject: r.subject,
        count: parseInt(r.c, 10),
      })),
      avgResponseHours,
    };
  }
}
