import { Module } from '@nestjs/common';
import { AnalyticsEventEmitter } from './analytics.events';
import { AnalyticsListener } from './analytics.listener';
import { AnalyticsMiddleware } from './analytics.middleware';

@Module({
  providers: [
    {
      provide: AnalyticsEventEmitter,
      useFactory: () => new AnalyticsEventEmitter(),
    },
    AnalyticsListener,
    AnalyticsMiddleware,
  ],
  exports: [AnalyticsEventEmitter, AnalyticsMiddleware],
})
export class AnalyticsModule {}
