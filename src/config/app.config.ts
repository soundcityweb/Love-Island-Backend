import { registerAs } from '@nestjs/config';

export default registerAs('app', () => ({
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
  apiPrefix: process.env.API_PREFIX || 'api',
  /** IANA zone for interpreting schedule dates/times (e.g. Africa/Lagos). */
  scheduleTimezone: process.env.SCHEDULE_TIMEZONE || 'Africa/Lagos',
}));
