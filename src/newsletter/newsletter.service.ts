import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { NewsletterSubscriber } from '../entities/newsletter-subscriber.entity';
import { Article } from '../entities/article.entity';
import { EmailService } from '../common/services/email.service';

@Injectable()
export class NewsletterService {
  private readonly logger = new Logger(NewsletterService.name);

  constructor(
    @InjectRepository(NewsletterSubscriber)
    private readonly repo: Repository<NewsletterSubscriber>,
    private readonly emailService: EmailService,
  ) {}

  /** Public site origin (emails, redirects). Used for paths that must hit Next, not the API proxy. */
  getPublicSiteBase(): string {
    return (process.env.FRONTEND_URL || process.env.PUBLIC_APP_URL || 'http://localhost:3001').replace(
      /\/$/,
      '',
    );
  }

  /**
   * Idempotent subscribe: same email always returns success; reactivates if previously unsubscribed.
   */
  async subscribe(rawEmail: string): Promise<{ ok: true }> {
    const email = rawEmail.trim().toLowerCase();
    const existing = await this.repo.findOne({ where: { email } });

    if (existing) {
      if (!existing.active) {
        existing.active = true;
        existing.unsubscribeToken = randomUUID();
        await this.repo.save(existing);
      }
      return { ok: true };
    }

    try {
      await this.repo.save(
        this.repo.create({
          email,
          unsubscribeToken: randomUUID(),
          active: true,
        }),
      );
    } catch (err: unknown) {
      const code = err && typeof err === 'object' && 'code' in err ? String((err as { code: string }).code) : '';
      if (code === '23505') {
        const dup = await this.repo.findOne({ where: { email } });
        if (dup && !dup.active) {
          dup.active = true;
          dup.unsubscribeToken = randomUUID();
          await this.repo.save(dup);
        }
        return { ok: true };
      }
      throw err;
    }
    return { ok: true };
  }

  async unsubscribeByToken(token: string): Promise<{ ok: true }> {
    const sub = await this.repo.findOne({ where: { unsubscribeToken: token } });
    if (!sub) {
      throw new NotFoundException('Invalid or expired unsubscribe link.');
    }
    sub.active = false;
    await this.repo.save(sub);
    return { ok: true };
  }

  /**
   * Sends one email per active subscriber; failures are logged and do not abort the batch.
   */
  async notifyNewArticlePublished(article: Article): Promise<void> {
    const subs = await this.repo.find({ where: { active: true } });
    if (subs.length === 0) {
      this.logger.debug('No active newsletter subscribers; skipping article alerts.');
      return;
    }

    const base = this.getPublicSiteBase();
    const articleUrl = `${base}/news/${encodeURIComponent(article.slug)}`;

    for (const sub of subs) {
      const unsubscribeUrl = `${base}/newsletter/unsubscribe?token=${encodeURIComponent(sub.unsubscribeToken)}`;
      try {
        await this.emailService.sendNewArticleAlert(sub.email, {
          title: article.title,
          articleUrl,
          unsubscribeUrl,
        });
      } catch (err) {
        this.logger.warn(`Failed to send article alert to ${sub.email}`, err);
      }
    }

    this.logger.log(`Article publish alerts processed for "${article.slug}" (${subs.length} subscriber(s)).`);
  }
}
