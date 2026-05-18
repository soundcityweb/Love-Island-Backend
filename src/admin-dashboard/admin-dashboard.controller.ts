import { Controller, Get, Query } from '@nestjs/common';
import { AdminDashboardService } from './admin-dashboard.service';

@Controller('admin/dashboard')
export class AdminDashboardController {
  constructor(private readonly dashboardService: AdminDashboardService) {}

  /** Returns aggregated counts, quick stats, and recent activity for the admin dashboard. */
  @Get()
  getDashboard() {
    return this.dashboardService.getDashboardData();
  }

  /** Returns merch analytics: revenue, top products, revenue over time, low stock. */
  @Get('analytics/merch')
  getMerchAnalytics(
    @Query('period') period?: string,
  ) {
    const validPeriod =
      period === 'daily' || period === 'weekly' || period === 'monthly'
        ? period
        : 'monthly';
    return this.dashboardService.getMerchAnalytics(validPeriod);
  }
}
