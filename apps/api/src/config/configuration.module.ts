import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { getRuntimeEnvironment } from '@server/lib/config/environment';
import { AppConfigService } from './app-config.service';
import { runtimeConfig } from './runtime.config';

@Global()
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      ignoreEnvFile: true,
      cache: true,
      skipProcessEnv: true,
      validate: () => getRuntimeEnvironment(),
      load: [runtimeConfig],
    }),
  ],
  providers: [AppConfigService],
  exports: [AppConfigService],
})
export class ConfigurationModule {}
