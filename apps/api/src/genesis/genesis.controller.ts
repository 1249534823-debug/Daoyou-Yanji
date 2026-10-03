import {
  Controller,
  Get,
  HttpCode,
  Inject,
  Post,
  Req,
  UseFilters,
} from '@nestjs/common';
import type { AuthUser } from '@server/lib/auth/types';
import { getRequestIp } from '@server/lib/http/requestIp';
import { CultivatorCreationCommandError } from '@server/genesis/application/CultivatorCreationApplicationService';
import { fromNodeHeaders } from 'better-auth/node';
import type { Request } from 'express';
import type { z } from 'zod';
import { Access, CurrentUser } from '../auth/access';
import { apiErrorFilter } from '../http/error-filter';
import { JsonBody } from '../http/json-body';
import { ZodPipe } from '../http/zod.pipe';
import { GenesisService, SaveCharacterSchema } from './genesis.service';

const SaveErrors = apiErrorFilter((error) =>
  error instanceof CultivatorCreationCommandError
    ? Response.json({ error: error.message }, { status: 400 })
    : undefined,
);

@Controller('api/generate-character')
@Access('user')
export class GenerateCharacterController {
  constructor(
    @Inject(GenesisService) private readonly genesis: GenesisService,
  ) {}
  @Get('quota')
  quota(@CurrentUser() user: AuthUser, @Req() request: Request) {
    return this.genesis.quota(
      user,
      getRequestIp(fromNodeHeaders(request.headers)),
    );
  }
  @Post()
  @HttpCode(200)
  generate(
    @CurrentUser() user: AuthUser,
    @Req() request: Request,
    @JsonBody() input: unknown,
  ) {
    return this.genesis.generate(
      user,
      getRequestIp(fromNodeHeaders(request.headers)),
      input,
    );
  }
}

@Controller('api/generate-fates')
@Access('user')
export class GenerateFatesController {
  constructor(
    @Inject(GenesisService) private readonly genesis: GenesisService,
  ) {}
  @Post()
  @HttpCode(200)
  generate(@JsonBody() input: unknown) {
    return this.genesis.fates(input);
  }
}

@Controller('api/save-character')
@Access('user')
export class SaveCharacterController {
  constructor(
    @Inject(GenesisService) private readonly genesis: GenesisService,
  ) {}
  @Post()
  @HttpCode(200)
  @UseFilters(SaveErrors)
  save(
    @CurrentUser() user: AuthUser,
    @JsonBody(new ZodPipe(SaveCharacterSchema))
    input: z.infer<typeof SaveCharacterSchema>,
  ) {
    return this.genesis.save(user, input);
  }
}
