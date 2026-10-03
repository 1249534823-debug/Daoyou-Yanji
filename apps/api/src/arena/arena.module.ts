import { Module } from '@nestjs/common';
import { ArenaBattleStartOrchestrator } from '@server/lib/services/ArenaBattleStartOrchestrator';
import { ArenaRoomService } from '@server/lib/services/ArenaRoomService';
import { CombatV6ArenaStore } from '@server/lib/services/combat-v6/CombatV6ArenaStore';
import { AuthModule } from '../auth/auth.module';
import { ArenaBattlesController } from './arena-battles.controller';
import { ArenaBattlesService } from './arena-battles.service';
import { ArenaRealtimeService } from './arena-realtime.service';
import { ArenaRoomsController } from './arena-rooms.controller';
import { ArenaRoomsService } from './arena-rooms.service';
import { ArenaGateway } from './arena.gateway';

@Module({
  imports: [AuthModule],
  controllers: [ArenaRoomsController, ArenaBattlesController],
  providers: [
    { provide: ArenaRoomService, useFactory: () => new ArenaRoomService() },
    { provide: CombatV6ArenaStore, useFactory: () => new CombatV6ArenaStore() },
    {
      provide: ArenaBattleStartOrchestrator,
      useFactory: (rooms: ArenaRoomService) =>
        new ArenaBattleStartOrchestrator(rooms),
      inject: [ArenaRoomService],
    },
    ArenaRoomsService,
    ArenaBattlesService,
    ArenaRealtimeService,
    ArenaGateway,
  ],
  exports: [ArenaRealtimeService],
})
export class ArenaModule {}
