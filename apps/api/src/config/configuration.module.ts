import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { getRuntimeEnvironment } from '@server/lib/config/environment';
import { runtimeConfig } from './runtime.config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      ignoreEnvFile: true,
      cache: true,
      validate: () => getRuntimeEnvironment(),
      load: [runtimeConfig],
    }),
  ],
  exports: [ConfigModule],
})
export class ConfigurationModule {}
