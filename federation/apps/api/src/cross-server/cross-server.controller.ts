import {
  CrossServerCreateSchema,
  CrossServerIdSchema,
  CrossServerInspectSchema,
  CrossServerPeerPatchSchema,
  CrossServerProfileSchema,
  CrossServerRegisterSchema,
} from '@daoyou/contracts/cross-server';
import {
  Controller,
  Get,
  Header,
  HttpCode,
  Inject,
  Param,
  Patch,
  type PipeTransform,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { z } from 'zod';
import { Access, CurrentCultivator, CurrentUser } from '../auth/access.js';
import { FirstQuery } from '../http/first-query.js';
import { JsonBody } from '../http/json-body.js';
import type { ActiveCultivatorRef, AuthUser } from '../lib/auth/types.js';
import {
  CrossServerService,
  crossServerWire,
} from './application/cross-server.service.js';
import {
  CrossServerBodyGuard,
  CrossServerPeerGuard,
  type CrossServerRequest,
} from './peer.guard.js';
import { CrossServerPeersService } from './peers.service.js';
import { crossServerError } from './transport.js';

// New federation endpoints return a client error without changing legacy HTTP contracts.
class CrossServerInputPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: z.ZodType<T>) {}
  transform(value: unknown): T {
    const parsed = this.schema.safeParse(value);
    if (!parsed.success) crossServerError('跨服请求参数无效', 400);
    return parsed.data;
  }
}

const directoryQuery = z.strictObject({
  cursor: CrossServerIdSchema.optional(),
});
const empty = z.strictObject({});

@Controller('api/cross-server')
@Access('active')
@UseGuards(CrossServerBodyGuard)
export class CrossServerController {
  constructor(
    @Inject(CrossServerService) private readonly service: CrossServerService,
  ) {}
  @Get('state')
  @Header('Cache-Control', 'private, no-store')
  state(@CurrentCultivator() actor: ActiveCultivatorRef) {
    return this.service.state(actor);
  }
  @Patch('profile')
  profile(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @JsonBody(
      { fallback: undefined },
      new CrossServerInputPipe(CrossServerProfileSchema),
    )
    input: z.infer<typeof CrossServerProfileSchema>,
  ) {
    return this.service.profile(actor, input.enabled);
  }
  @Get('peers/:peerId/players')
  @Header('Cache-Control', 'private, no-store')
  players(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @Param('peerId', new CrossServerInputPipe(CrossServerIdSchema))
    peerId: string,
    @FirstQuery(new CrossServerInputPipe(directoryQuery))
    query: z.infer<typeof directoryQuery>,
  ) {
    return this.service.remoteDirectory(actor, peerId, query.cursor);
  }
  @Post('challenges')
  @HttpCode(200)
  create(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @JsonBody(
      { fallback: undefined },
      new CrossServerInputPipe(CrossServerCreateSchema),
    )
    input: z.infer<typeof CrossServerCreateSchema>,
  ) {
    return this.service.create(actor, input);
  }
  @Post('challenges/:id/accept')
  @HttpCode(200)
  accept(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @Param('id', new CrossServerInputPipe(CrossServerIdSchema)) id: string,
    @JsonBody({ fallback: undefined }, new CrossServerInputPipe(empty))
    _input: z.infer<typeof empty>,
  ) {
    void _input;
    return this.service.accept(actor, id);
  }
  @Post('challenges/:id/decline')
  @HttpCode(200)
  decline(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @Param('id', new CrossServerInputPipe(CrossServerIdSchema)) id: string,
    @JsonBody({ fallback: undefined }, new CrossServerInputPipe(empty))
    _input: z.infer<typeof empty>,
  ) {
    void _input;
    return this.service.decline(actor, id);
  }
  @Post('challenges/:id/sync')
  @HttpCode(200)
  sync(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @Param('id', new CrossServerInputPipe(CrossServerIdSchema)) id: string,
    @JsonBody({ fallback: undefined }, new CrossServerInputPipe(empty))
    _input: z.infer<typeof empty>,
  ) {
    void _input;
    return this.service.sync(actor, id);
  }
  @Post('challenges/:id/cancel')
  @HttpCode(200)
  cancel(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @Param('id', new CrossServerInputPipe(CrossServerIdSchema)) id: string,
    @JsonBody({ fallback: undefined }, new CrossServerInputPipe(empty))
    _input: z.infer<typeof empty>,
  ) {
    void _input;
    return this.service.cancel(actor, id);
  }
}

@Controller('api/admin/cross-server')
@Access('admin')
@UseGuards(CrossServerBodyGuard)
export class CrossServerAdminController {
  constructor(
    @Inject(CrossServerPeersService)
    private readonly peers: CrossServerPeersService,
  ) {}
  @Get()
  @Header('Cache-Control', 'private, no-store')
  async state() {
    return {
      configured: !!this.peers.transport.identity,
      manifest: this.peers.transport.identity?.manifest ?? null,
      peers: await this.peers.list(),
    };
  }
  @Post('inspect')
  @HttpCode(200)
  inspect(
    @JsonBody(
      { fallback: undefined },
      new CrossServerInputPipe(CrossServerInspectSchema),
    )
    input: z.infer<typeof CrossServerInspectSchema>,
  ) {
    return this.peers.inspect(input.url);
  }
  @Post('peers')
  @HttpCode(200)
  async register(
    @CurrentUser() user: AuthUser,
    @JsonBody(
      { fallback: undefined },
      new CrossServerInputPipe(CrossServerRegisterSchema),
    )
    input: z.infer<typeof CrossServerRegisterSchema>,
  ) {
    await this.peers.register(input.manifest, input.fingerprint, user.id);
    return this.state();
  }
  @Patch('peers/:id')
  async enable(
    @CurrentUser() user: AuthUser,
    @Param('id', new CrossServerInputPipe(CrossServerIdSchema)) id: string,
    @JsonBody(
      { fallback: undefined },
      new CrossServerInputPipe(CrossServerPeerPatchSchema),
    )
    input: z.infer<typeof CrossServerPeerPatchSchema>,
  ) {
    await this.peers.enable(id, input.enabled, user.id);
    return this.state();
  }
  @Post('peers/:id/check')
  @HttpCode(200)
  async check(
    @CurrentUser() user: AuthUser,
    @Param('id', new CrossServerInputPipe(CrossServerIdSchema)) id: string,
    @JsonBody({ fallback: undefined }, new CrossServerInputPipe(empty))
    _input: z.infer<typeof empty>,
  ) {
    void _input;
    await this.peers.check(id, user.id);
    return this.state();
  }
}

@Controller('api/cross-server/v1')
@Access('public')
export class CrossServerManifestController {
  constructor(
    @Inject(CrossServerPeersService)
    private readonly peers: CrossServerPeersService,
  ) {}
  @Get('manifest')
  @Header('Cache-Control', 'no-store')
  manifest() {
    return this.peers.manifest();
  }
}

@Controller('api/cross-server/v1')
@Access('public')
@UseGuards(CrossServerPeerGuard)
export class CrossServerPeerController {
  constructor(
    @Inject(CrossServerService) private readonly service: CrossServerService,
  ) {}
  @Get('ping')
  @Header('Cache-Control', 'no-store')
  ping(@Req() request: CrossServerRequest) {
    return this.service.peers.transport.reply(
      request.crossServerPeer,
      request,
      this.service.peers.manifest(),
    );
  }
  @Get('players')
  @Header('Cache-Control', 'no-store')
  async directory(
    @Req() request: CrossServerRequest,
    @FirstQuery(new CrossServerInputPipe(directoryQuery))
    query: z.infer<typeof directoryQuery>,
  ) {
    return this.service.peers.transport.reply(
      request.crossServerPeer,
      request,
      await this.service.localDirectory(
        request.crossServerPeer.siteId,
        query.cursor,
      ),
    );
  }
  @Post('challenges')
  @HttpCode(200)
  async invite(
    @Req() request: CrossServerRequest,
    @JsonBody(
      { fallback: undefined },
      new CrossServerInputPipe(crossServerWire.invitation),
    )
    input: z.infer<typeof crossServerWire.invitation>,
  ) {
    return this.service.peers.transport.reply(
      request.crossServerPeer,
      request,
      await this.service.invite(request.crossServerPeer, input),
    );
  }
  @Get('challenges/:id')
  @Header('Cache-Control', 'no-store')
  async lookup(
    @Req() request: CrossServerRequest,
    @Param('id', new CrossServerInputPipe(CrossServerIdSchema)) id: string,
  ) {
    return this.service.peers.transport.reply(
      request.crossServerPeer,
      request,
      await this.service.lookup(request.crossServerPeer, id),
    );
  }
  @Post('challenges/:id/cancel')
  @HttpCode(200)
  async cancel(
    @Req() request: CrossServerRequest,
    @Param('id', new CrossServerInputPipe(CrossServerIdSchema)) id: string,
    @JsonBody({ fallback: undefined }, new CrossServerInputPipe(empty))
    _input: z.infer<typeof empty>,
  ) {
    void _input;
    return this.service.peers.transport.reply(
      request.crossServerPeer,
      request,
      await this.service.cancelReceived(request.crossServerPeer, id),
    );
  }
}
