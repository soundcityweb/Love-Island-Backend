import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';

import { Islander } from '../entities/islander.entity';
import { Article } from '../entities/article.entity';
import { Video } from '../entities/video.entity';
import { Product } from '../entities/product.entity';
import { Order } from '../entities/order.entity';
import { OrderStatus } from '../entities/order-status.enum';
import { Application } from '../entities/application.entity';
import { Vote } from '../entities/vote.entity';
import { VotingPeriod } from '../entities/voting-period.entity';
import { VotingPeriodStatus } from '../entities/voting-period-status.enum';
import { LandingSection } from '../entities/landing-section.entity';

export interface ActivityEntry {
  action: string;
  item: string;
  /** ISO-8601 timestamp */
  time: string;
  type: 'article' | 'islander' | 'product' | 'order' | 'video';
}

export interface DashboardData {
  moduleCounts: {
    landingSections: number;
    islanders: number;
    articles: number;
    videos: number;
    products: number;
    orders: number;
    activeVotingPolls: number;
  };
  stats: {
    applications: number;
    totalVotesCast: number;
    publishedArticles: number;
    pendingOrders: number;
  };
  recentActivity: ActivityEntry[];
}

export interface MerchAnalyticsData {
  period: 'daily' | 'weekly' | 'monthly';
  totalRevenue: number;
  totalOrders: number;
  ordersByStatus: Record<string, number>;
  revenueOverTime: Array<{ date: string; revenue: number; orders: number }>;
  topProducts: Array<{ productId: string; name: string; unitsSold: number; revenue: number }>;
  lowStockProducts: Array<{ id: string; name: string; stock: number; lowStockThreshold: number }>;
}

@Injectable()
export class AdminDashboardService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Islander)
    private readonly islanderRepo: Repository<Islander>,
    @InjectRepository(Article)
    private readonly articleRepo: Repository<Article>,
    @InjectRepository(Video)
    private readonly videoRepo: Repository<Video>,
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    @InjectRepository(Application)
    private readonly applicationRepo: Repository<Application>,
    @InjectRepository(Vote)
    private readonly voteRepo: Repository<Vote>,
    @InjectRepository(VotingPeriod)
    private readonly votingPeriodRepo: Repository<VotingPeriod>,
    @InjectRepository(LandingSection)
    private readonly landingSectionRepo: Repository<LandingSection>,
  ) {}

  async getDashboardData(): Promise<DashboardData> {
    // ── Counts (parallel) ───────────────────────────────────────────────────
    const [
      islandersCount,
      articlesCount,
      videosCount,
      productsCount,
      ordersCount,
      activeVotingPolls,
      landingSectionsCount,
      applicationsCount,
      votesCastCount,
      publishedArticlesCount,
      pendingOrdersCount,
    ] = await Promise.all([
      this.islanderRepo.count(),
      this.articleRepo.count(),
      this.videoRepo.count(),
      this.productRepo.count(),
      this.orderRepo.count(),
      this.votingPeriodRepo.count({ where: { status: VotingPeriodStatus.OPEN } }),
      this.landingSectionRepo.count(),
      this.applicationRepo.count(),
      this.voteRepo.count(),
      this.articleRepo.count({ where: { isPublished: true } }),
      this.orderRepo.count({ where: { status: OrderStatus.PENDING } }),
    ]);

    // ── Recent activity ──────────────────────────────────────────────────────
    // Fetch the 3 most-recently-updated rows from each content table in parallel,
    // then merge, sort, and take the top 10.

    const [recentArticles, recentIslanders, recentProducts, recentOrders, recentVideos] =
      await Promise.all([
        this.articleRepo.find({
          order: { updatedAt: 'DESC' },
          take: 3,
          select: ['id', 'title', 'updatedAt', 'isPublished'],
        }),
        this.islanderRepo.find({
          order: { updatedAt: 'DESC' },
          take: 3,
          select: ['id', 'firstName', 'lastName', 'updatedAt', 'isPublic'],
        }),
        this.productRepo.find({
          order: { createdAt: 'DESC' },
          take: 3,
          select: ['id', 'name', 'createdAt'],
        }),
        this.orderRepo.find({
          order: { createdAt: 'DESC' },
          take: 3,
          select: ['id', 'orderNumber', 'customerFirstName', 'customerLastName', 'status', 'createdAt'],
        }),
        this.videoRepo.find({
          order: { updatedAt: 'DESC' },
          take: 3,
          select: ['id', 'title', 'updatedAt', 'isPublished'],
        }),
      ]);

    const activity: ActivityEntry[] = [];

    for (const a of recentArticles) {
      activity.push({
        action: a.isPublished ? 'Article published' : 'Article updated',
        item: a.title,
        time: a.updatedAt.toISOString(),
        type: 'article',
      });
    }

    for (const i of recentIslanders) {
      const name = [i.firstName, i.lastName].filter(Boolean).join(' ');
      activity.push({
        action: i.isPublic ? 'Islander profile live' : 'Islander updated',
        item: name,
        time: i.updatedAt.toISOString(),
        type: 'islander',
      });
    }

    for (const p of recentProducts) {
      activity.push({
        action: 'Product added',
        item: p.name,
        time: (p.createdAt as Date).toISOString(),
        type: 'product',
      });
    }

    for (const o of recentOrders) {
      const name = [o.customerFirstName, o.customerLastName].filter(Boolean).join(' ');
      activity.push({
        action: `Order ${o.status}`,
        item: `${o.orderNumber} — ${name}`,
        time: (o.createdAt as Date).toISOString(),
        type: 'order',
      });
    }

    for (const v of recentVideos) {
      activity.push({
        action: v.isPublished ? 'Video published' : 'Video updated',
        item: v.title,
        time: v.updatedAt.toISOString(),
        type: 'video',
      });
    }

    // Sort newest-first and cap to 10 items.
    activity.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
    const recentActivity = activity.slice(0, 10);

    return {
      moduleCounts: {
        landingSections: landingSectionsCount,
        islanders: islandersCount,
        articles: articlesCount,
        videos: videosCount,
        products: productsCount,
        orders: ordersCount,
        activeVotingPolls,
      },
      stats: {
        applications: applicationsCount,
        totalVotesCast: votesCastCount,
        publishedArticles: publishedArticlesCount,
        pendingOrders: pendingOrdersCount,
      },
      recentActivity,
    };
  }

  async getMerchAnalytics(period: 'daily' | 'weekly' | 'monthly'): Promise<MerchAnalyticsData> {
    const paidStatuses = ['paid', 'processing', 'shipped', 'delivered'];

    // ── Total revenue and order count ──────────────────────────────────────────
    const revenueResult: Array<{ total_revenue: string; total_orders: string }> =
      await this.dataSource.query(`
        SELECT
          COALESCE(SUM(total_amount), 0) AS total_revenue,
          COUNT(*) AS total_orders
        FROM orders
        WHERE status = ANY($1)
      `, [paidStatuses]);

    const totalRevenue = parseFloat(revenueResult[0]?.total_revenue ?? '0');
    const totalOrders = parseInt(revenueResult[0]?.total_orders ?? '0', 10);

    // ── Orders by status ───────────────────────────────────────────────────────
    const statusResult: Array<{ status: string; cnt: string }> =
      await this.dataSource.query(`
        SELECT status, COUNT(*) AS cnt FROM orders GROUP BY status
      `);
    const ordersByStatus: Record<string, number> = {};
    for (const row of statusResult) {
      ordersByStatus[row.status] = parseInt(row.cnt, 10);
    }

    // ── Revenue over time ──────────────────────────────────────────────────────
    const truncUnit =
      period === 'daily' ? 'day' : period === 'weekly' ? 'week' : 'month';
    const revenueOverTimeResult: Array<{
      bucket: string;
      revenue: string;
      orders: string;
    }> = await this.dataSource.query(`
      SELECT
        DATE_TRUNC('${truncUnit}', created_at) AS bucket,
        COALESCE(SUM(total_amount), 0) AS revenue,
        COUNT(*) AS orders
      FROM orders
      WHERE status = ANY($1)
        AND created_at >= NOW() - INTERVAL '90 days'
      GROUP BY bucket
      ORDER BY bucket ASC
    `, [paidStatuses]);

    const revenueOverTime = revenueOverTimeResult.map((row) => ({
      date: new Date(row.bucket).toISOString().split('T')[0],
      revenue: parseFloat(row.revenue),
      orders: parseInt(row.orders, 10),
    }));

    // ── Top selling products ───────────────────────────────────────────────────
    const topProductsResult: Array<{
      product_id: string;
      name: string;
      units_sold: string;
      revenue: string;
    }> = await this.dataSource.query(`
      SELECT
        oi.product_id,
        p.name,
        SUM(oi.quantity) AS units_sold,
        SUM(oi.quantity * oi.price_snapshot) AS revenue
      FROM order_items oi
      JOIN products p ON p.id = oi.product_id
      JOIN orders o ON o.id = oi.order_id
      WHERE o.status = ANY($1)
      GROUP BY oi.product_id, p.name
      ORDER BY units_sold DESC
      LIMIT 10
    `, [paidStatuses]);

    const topProducts = topProductsResult.map((row) => ({
      productId: row.product_id,
      name: row.name,
      unitsSold: parseInt(row.units_sold, 10),
      revenue: parseFloat(row.revenue),
    }));

    // ── Low stock products ─────────────────────────────────────────────────────
    const lowStockResult: Array<{
      id: string;
      name: string;
      stock: number;
      low_stock_threshold: number;
    }> = await this.dataSource.query(`
      SELECT id, name, stock, low_stock_threshold
      FROM products
      WHERE is_active = true AND stock <= low_stock_threshold
      ORDER BY stock ASC
      LIMIT 20
    `);

    const lowStockProducts = lowStockResult.map((row) => ({
      id: row.id,
      name: row.name,
      stock: row.stock,
      lowStockThreshold: row.low_stock_threshold,
    }));

    return {
      period,
      totalRevenue,
      totalOrders,
      ordersByStatus,
      revenueOverTime,
      topProducts,
      lowStockProducts,
    };
  }
}
