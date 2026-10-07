import { NestFactory } from '@nestjs/core';
import {
  ExpressAdapter,
  type NestExpressApplication,
} from '@nestjs/platform-express';
import { closeDatabase } from '@server/lib/drizzle/db.js';
import { closeRedisConnection } from '@server/lib/redis/index.js';
import express from 'express';
import 'reflect-metadata';
import { AppConfigService } from './config/app-config.service.js';
import { CrossServerStandaloneModule } from './cross-server/standalone.module.js';
import { configureHttp } from './http/configure-http.js';

// ExpressAdapter installs middleware in its constructor, creating the router.
// Configure matching before that first use so the API keeps Hono's strict paths.
const server = express();
server.set('case sensitive routing', true);
server.set('strict routing', true);
let closing = false;
function startShutdownDeadline() {
  if (closing) return;
  closing = true;
  setTimeout(() => {
    console.error('[runtime] shutdown exceeded 60s; forcing process exit');
    process.exit(1);
  }, 60_000).unref();
}

const shutdownSignals = ['SIGTERM', 'SIGINT'] as const;
let startupSignal: NodeJS.Signals | undefined;
function deferStartupShutdown(signal: NodeJS.Signals) {
  startupSignal ??= signal;
  startShutdownDeadline();
}
// Serialize shutdown with bootstrap: Nest's HTTP init does not populate the
// application context initializationPromise awaited by its shutdown hooks.
for (const signal of shutdownSignals) process.on(signal, deferStartupShutdown);

let app: NestExpressApplication | undefined;
try {
  app = await NestFactory.create<NestExpressApplication>(
    CrossServerStandaloneModule,
    new ExpressAdapter(server),
    { bodyParser: false, return503OnClosing: true, abortOnError: false },
  );
  configureHttp(app);
  await app.init();
  if (!startupSignal) {
    const config = app.get(AppConfigService);
    await app.listen(Number(config.get('PORT')), config.get('HOST'));
  }
  if (startupSignal) {
    console.info(`[runtime] ${startupSignal} received during startup; closing`);
    await app.close();
    process.exit(startupSignal === 'SIGINT' ? 130 : 143);
  }
  for (const signal of shutdownSignals) {
    process.removeListener(signal, deferStartupShutdown);
    process.once(signal, startShutdownDeadline);
  }
  app.enableShutdownHooks([...shutdownSignals]);
} catch (error) {
  console.error('[runtime] startup failed', error);
  startShutdownDeadline();
  try {
    if (app) await app.close();
    else {
      await Promise.allSettled([closeDatabase(), closeRedisConnection()]);
    }
  } catch (cleanupError) {
    console.error('[runtime] startup cleanup failed', cleanupError);
  }
  process.exit(1);
}
