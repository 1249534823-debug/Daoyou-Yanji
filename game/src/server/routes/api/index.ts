import { getReadinessStatus } from '@server/lib/health/readiness';
import type { AppEnv } from '@server/lib/hono/types';
import accountRouter from '@server/routes/api/account.router';
import adminRouter from '@server/routes/api/admin';
import alchemyFormulasRouter from '@server/routes/api/alchemy-formulas.router';
import arenaRouter from '@server/routes/api/arena.router';
import auctionRouter from '@server/routes/api/auction.router';
import battleRecordsRouter from '@server/routes/api/battle-records.router';
import blackMarketRouter from '@server/routes/api/black-market.router';
import captchaRouter from '@server/routes/api/captcha.router';
import combatV6ArenaRouter from '@server/routes/api/combat-v6-arena.router';
import combatV6AutoStrategyRouter from '@server/routes/api/combat-v6-auto-strategy.router';
import combatV6SharesRouter from '@server/routes/api/combat-v6-shares.router';
import combatV6Router from '@server/routes/api/combat-v6.router';
import communityRouter from '@server/routes/api/community.router';
import craftRouter from '@server/routes/api/craft.router';
import cultivatorRouter from '@server/routes/api/cultivator.router';
import cultivatorsRouter from '@server/routes/api/cultivators.router';
import divineFortuneRouter from '@server/routes/api/divine-fortune.router';
import dungeonRouter from '@server/routes/api/dungeon.router';
import enemiesRouter from '@server/routes/api/enemies.router';
import fateReshapeRouter from '@server/routes/api/fate-reshape.router';
import feedbackRouter from '@server/routes/api/feedback.router';
import friendsRouter from '@server/routes/api/friends.router';
import generateCharacterRouter from '@server/routes/api/generate-character.router';
import generateFatesRouter from '@server/routes/api/generate-fates.router';
import identityReshapeRouter from '@server/routes/api/identity-reshape.router';
import marketRouter from '@server/routes/api/market.router';
import productsRouter from '@server/routes/api/products.router';
import rankingsRouter from '@server/routes/api/rankings.router';
import realtimeRouter from '@server/routes/api/realtime.router';
import reputationShopRouter from '@server/routes/api/reputation-shop.router';
import saveCharacterRouter from '@server/routes/api/save-character.router';
import secretRealmsRouter from '@server/routes/api/secret-realms.router';
import sectsRouter from '@server/routes/api/sects.router';
import spiritFieldRouter from '@server/routes/api/spirit-field.router';
import sponsorshipRouter from '@server/routes/api/sponsorship.router';
import storyRouter from '@server/routes/api/story.router';
import tasksRouter from '@server/routes/api/tasks.router';
import towerRouter from '@server/routes/api/tower.router';
import worldChatRouter from '@server/routes/api/world-chat.router';
import playerRouter from '@server/routes/player.router';
import { allowsLocalDevTools } from '@shared/config/deployment';
import { Hono } from 'hono';
import { artifactMigrationRouter } from './artifact-migration';
import breakthroughV6Router from './combat-v6-breakthrough.router';
import manualsRouter from './combat-v6-manuals.router';
import sectTasksV6Router from './combat-v6-sect-tasks.router';
import sectV6Router from './combat-v6-sect.router';
import devResourcesRouter from './dev-resources.router';
import divinationRouter from './divination.router';
import enlightenmentRouter from './enlightenment.router';
import forgingRouter from './forging.router';
import huntsRouter from './hunts.router';
import inscriptionsRouter from './inscriptions.router';
import { manualMigrationRouter } from './manual-migration';
import playerJournalRouter from './player-journal.router';

const apiRouter = new Hono<AppEnv>();

// Liveness intentionally avoids DB, Redis, NATS and worker dependency checks.
apiRouter.get('/live', (c) => {
  c.header('Cache-Control', 'no-store');
  return c.json({ success: true, message: 'OK' });
});

apiRouter.get('/health-check', readinessHandler);
apiRouter.get('/ready', readinessHandler);

async function readinessHandler(c: import('hono').Context<AppEnv>) {
  c.header('Cache-Control', 'no-store');
  const status = await getReadinessStatus();
  return c.json(
    {
      ...status,
      ...(status.success
        ? { message: 'OK' }
        : { error: 'Service unavailable' }),
    },
    status.success ? 200 : 503,
  );
}

apiRouter.route('/player', playerRouter);
apiRouter.route('/player-journal', playerJournalRouter);
apiRouter.route('/account', accountRouter);
apiRouter.route('/admin', adminRouter);
apiRouter.route('/alchemy', alchemyFormulasRouter);
apiRouter.route('/auction', auctionRouter);
apiRouter.route('/arena', arenaRouter);
apiRouter.route('/hunts', huntsRouter);
apiRouter.route('/battle-records', battleRecordsRouter);
apiRouter.route('/black-market', blackMarketRouter);
apiRouter.route('/captcha', captchaRouter);
apiRouter.route('/community', communityRouter);
apiRouter.route('/combat-v6/arena', combatV6ArenaRouter);
apiRouter.route('/combat-v6/auto-strategy', combatV6AutoStrategyRouter);
apiRouter.route('/combat-v6/forging', forgingRouter);
apiRouter.route('/combat-v6/enlightenment', enlightenmentRouter);
apiRouter.route('/combat-v6/inscriptions', inscriptionsRouter);
apiRouter.route('/combat-v6/manuals', manualsRouter);
apiRouter.route('/manual-migration', manualMigrationRouter);
apiRouter.route('/artifact-migration', artifactMigrationRouter);
apiRouter.route('/combat-v6/sect', sectV6Router);
apiRouter.route('/combat-v6/sect-tasks', sectTasksV6Router);
apiRouter.route('/combat-v6/breakthrough', breakthroughV6Router);
if (allowsLocalDevTools(process.env.APP_ENV, process.env.NODE_ENV))
  apiRouter.route('/dev', devResourcesRouter);
apiRouter.route('/combat-v6', combatV6Router);
apiRouter.route('/combat-v6-shares', combatV6SharesRouter);
apiRouter.route('/craft', craftRouter);
apiRouter.route('/cultivator', cultivatorRouter);
apiRouter.route('/cultivators', cultivatorsRouter);
apiRouter.route('/divine-fortune', divineFortuneRouter);
apiRouter.route('/divination', divinationRouter);
apiRouter.route('/dungeon', dungeonRouter);
apiRouter.route('/enemies', enemiesRouter);
apiRouter.route('/fate-reshape', fateReshapeRouter);
apiRouter.route('/identity-reshape', identityReshapeRouter);
apiRouter.route('/feedback', feedbackRouter);
apiRouter.route('/friends', friendsRouter);
apiRouter.route('/generate-character', generateCharacterRouter);
apiRouter.route('/generate-fates', generateFatesRouter);
apiRouter.route('/market', marketRouter);
apiRouter.route('/rankings', rankingsRouter);
apiRouter.route('/realtime', realtimeRouter);
apiRouter.route('/reputation-shop', reputationShopRouter);
apiRouter.route('/save-character', saveCharacterRouter);
apiRouter.route('/tasks', tasksRouter);
apiRouter.route('/story', storyRouter);
apiRouter.route('/tower', towerRouter);
apiRouter.route('/sects', sectsRouter);
apiRouter.route('/sponsorship', sponsorshipRouter);
apiRouter.route('/spirit-field', spiritFieldRouter);
apiRouter.route('/v2/products', productsRouter);
apiRouter.route('/world-chat', worldChatRouter);

apiRouter.route('/secret-realms', secretRealmsRouter);

export default apiRouter;
