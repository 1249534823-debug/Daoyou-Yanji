import type { RequestContext } from '@server/lib/http/context';
import type { Request } from 'express';

export type GameRequest = Request & { gameContext: RequestContext };
