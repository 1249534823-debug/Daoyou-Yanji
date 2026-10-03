import { Module } from '@nestjs/common';
import { DatabaseModule } from '@server/database/database.module';
import { ArenaBattleStartOrchestrator } from '@server/arena/application/ArenaBattleStartOrchestrator';
import { ArenaRoomService } from '@server/arena/application/ArenaRoomService';
import { CombatV6ArenaStore } from '@server/combat/application/CombatV6ArenaStore';
import { AuthModule } from '../auth/auth.module';
import { ArenaBattlesController } from './arena-battles.controller';
import { ArenaBattlesService } from './arena-battles.service';
import { ArenaRealtimeService } from './arena-realtime.service';
import { ArenaRoomsController } from './arena-rooms.controller';
import { ArenaRoomsService } from './arena-rooms.service';
import { ArenaGateway } from './arena.gateway';

@Module({
  imports: [DatabaseModule, AuthModule],
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
