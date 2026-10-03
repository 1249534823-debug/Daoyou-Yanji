import {
  Catch,
  HttpException,
  type ArgumentsHost,
  type ExceptionFilter,
  type Type,
} from '@nestjs/common';
import type { Response as ExpressResponse } from 'express';
import { ApiExceptionFilter } from './api-exception.filter';

/** Preserve each API's existing error contract while keeping controllers transport-only. */
export function apiErrorFilter(
  mapError: (error: unknown) => Response | undefined,
): Type<ExceptionFilter> {
  @Catch()
  class ContractExceptionFilter extends ApiExceptionFilter {
    override async catch(error: unknown, host: ArgumentsHost): Promise<void> {
      // Guard failures and explicit HTTP outcomes already carry their public contract.
      if (
        error instanceof HttpException ||
        (error instanceof Error &&
          'type' in error &&
          error.type === 'entity.too.large')
      )
        return super.catch(error, host);
      const mapped = mapError(error);
      if (!mapped) return super.catch(error, host);
      const response = host.switchToHttp().getResponse<ExpressResponse>();
      if (response.headersSent) {
        response.end();
        return;
      }
      mapped.headers.forEach((value, name) => response.setHeader(name, value));
      response.status(mapped.status).send(await mapped.text());
    }
  }
  return ContractExceptionFilter;
}
