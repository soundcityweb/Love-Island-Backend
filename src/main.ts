import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

const logger = new Logger('Bootstrap');

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { rawBody: true });

  // ── Security headers ─────────────────────────────────────────────────────
  app.use(helmet());

  // ── Cookie parsing ────────────────────────────────────────────────────────
  // Required for reading HTTP-only auth cookies in JWT strategies and guards.
  app.use(cookieParser());

  app.setGlobalPrefix('api');

  // ── CORS ─────────────────────────────────────────────────────────────────
  const isProduction = process.env.NODE_ENV === 'production';

  if (isProduction && !process.env.CORS_ORIGIN) {
    // Fail fast rather than silently allowing localhost in production.
    logger.error(
      '[SECURITY] CORS_ORIGIN is not set in production. ' +
        'Set the CORS_ORIGIN environment variable to the allowed frontend origin(s). ' +
        'Refusing to start with open localhost fallback.',
    );
    process.exit(1);
  }

  const corsOrigins = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim()).filter(Boolean)
    : [
        'http://localhost:3000',
        'http://localhost:3001',
        'http://127.0.0.1:3000',
        'http://127.0.0.1:3001',
      ];

  app.enableCors({
    origin: corsOrigins.length ? corsOrigins : false,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true,
  });

  // ── Validation ───────────────────────────────────────────────────────────
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // ── Exception filters (most specific first) ──────────────────────────────
  // AllExceptionsFilter is the outer net for unhandled errors;
  // HttpExceptionFilter formats known HTTP errors with the standard envelope.
  app.useGlobalFilters(new AllExceptionsFilter(), new HttpExceptionFilter());

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
