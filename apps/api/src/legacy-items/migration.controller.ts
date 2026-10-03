import {
  Controller,
  Get,
  HttpCode,
  Inject,
  Post,
  UseFilters,
} from '@nestjs/common';
import type { ActiveCultivatorRef } from '@server/lib/auth/types';
import {
  ExchangeArtifactSchema,
  type ExchangeArtifact,
} from '@daoyou/shared/contracts/artifactMigration';
import {
  ExchangeManualSchema,
  type ExchangeManual,
} from '@daoyou/shared/contracts/manualMigration';
import { Access, CurrentCultivator } from '../auth/access';
import { JsonBody } from '../http/json-body';
import { ZodPipe } from '../http/zod.pipe';
import { migrationErrors } from './migration-errors';
import { MigrationService } from './migration.service';

const ManualErrors = migrationErrors('manual');
const ArtifactErrors = migrationErrors('artifact');

@Controller('api/artifact-migration')
@Access('active')
@UseFilters(ArtifactErrors)
export class ArtifactMigrationController {
  constructor(
    @Inject(MigrationService) private readonly migration: MigrationService,
  ) {}

  @Get('availability')
  availability(@CurrentCultivator() actor: ActiveCultivatorRef) {
    return this.migration.artifactAvailability(actor);
  }

  @Get()
  read(@CurrentCultivator() actor: ActiveCultivatorRef) {
    return this.migration.artifacts(actor);
  }

  @Post('exchange')
  @HttpCode(200)
  exchange(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @JsonBody({ fallback: undefined }, new ZodPipe(ExchangeArtifactSchema))
    input: ExchangeArtifact,
  ) {
    return this.migration.exchangeArtifact(actor, input);
  }
}

@Controller('api/manual-migration')
@Access('active')
@UseFilters(ManualErrors)
export class ManualMigrationController {
  constructor(
    @Inject(MigrationService) private readonly migration: MigrationService,
  ) {}

  @Get('availability')
  availability(@CurrentCultivator() actor: ActiveCultivatorRef) {
    return this.migration.manualAvailability(actor);
  }

  @Get()
  read(@CurrentCultivator() actor: ActiveCultivatorRef) {
    return this.migration.manuals(actor);
  }

  @Post('exchange')
  @HttpCode(200)
  exchange(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @JsonBody({ fallback: undefined }, new ZodPipe(ExchangeManualSchema))
    input: ExchangeManual,
  ) {
    return this.migration.exchangeManual(actor, input);
  }
}

@Controller('api/admin/manual-migration')
@Access('admin')
@UseFilters(ManualErrors)
export class ManualMigrationAdminController {
  constructor(
    @Inject(MigrationService) private readonly migration: MigrationService,
  ) {}

  @Get()
  read() {
    return this.migration.manualAdmin();
  }
}
