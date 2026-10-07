import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module.js';
import { CrossServerService } from './application/cross-server.service.js';
import {
  CrossServerAdminController,
  CrossServerController,
  CrossServerManifestController,
  CrossServerPeerController,
} from './cross-server.controller.js';
import { CrossServerBodyGuard, CrossServerPeerGuard } from './peer.guard.js';
import { CrossServerPeersService } from './peers.service.js';
import { CrossServerTransport } from './transport.js';

@Module({
  imports: [DatabaseModule],
  controllers: [
    CrossServerController,
    CrossServerAdminController,
    CrossServerManifestController,
    CrossServerPeerController,
  ],
  providers: [
    CrossServerService,
    CrossServerPeersService,
    CrossServerTransport,
    CrossServerPeerGuard,
    CrossServerBodyGuard,
  ],
})
export class CrossServerModule {}
