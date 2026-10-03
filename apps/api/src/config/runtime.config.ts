import { registerAs } from '@nestjs/config';
import { getRuntimeEnvironment } from '@server/lib/config/environment';

export const runtimeConfig = registerAs('runtime', () =>
  getRuntimeEnvironment(),
);
