import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Request } from 'express';
import { requireAdminApiKey } from '../middleware/admin-api-key.utils';

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    requireAdminApiKey(context.switchToHttp().getRequest<Request>());
    return true;
  }
}
