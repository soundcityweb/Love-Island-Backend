import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { requireAdminApiKey } from './admin-api-key.utils';

const MUTATING = new Set(['POST', 'PATCH', 'DELETE']);

/**
 * Requires a valid admin API key for POST, PATCH, and DELETE only.
 * Use on controllers that also expose public GET routes (e.g. podcasts).
 */
@Injectable()
export class AdminApiKeyMiddleware implements NestMiddleware {
  use(req: Request, _res: Response, next: NextFunction): void {
    if (!MUTATING.has(req.method)) {
      next();
      return;
    }
    requireAdminApiKey(req);
    next();
  }
}

/**
 * Requires a valid admin API key for every HTTP method.
 * Use on dedicated admin route trees (e.g. /admin/articles).
 */
@Injectable()
export class AdminSectionApiKeyMiddleware implements NestMiddleware {
  use(req: Request, _res: Response, next: NextFunction): void {
    requireAdminApiKey(req);
    next();
  }
}
