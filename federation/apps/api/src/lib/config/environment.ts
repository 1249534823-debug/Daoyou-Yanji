import { z } from 'zod';

const positiveInteger = (fallback: string, max = Number.MAX_SAFE_INTEGER) =>
  z
    .string()
    .default(fallback)
    .refine(
      (value) =>
        /^\d+$/.test(value) && Number(value) > 0 && Number(value) <= max,
      'must be a positive integer within the allowed range',
    );

const environmentSchema = z
  .object({
    NODE_ENV: z
      .enum(['development', 'production', 'test'])
      .default('development'),
    APP_ENV: z.enum(['local', 'staging', 'production']).optional(),
    HOST: z.string().min(1).default('0.0.0.0'),
    PORT: positiveInteger('3000', 65535),
    DATABASE_URL: z
      .url()
      .refine(
        (value) => /^postgres(?:ql)?:/.test(value),
        'must be a PostgreSQL URL',
      ),
    DB_MAX_CONNECTIONS: positiveInteger('20'),
    BETTER_AUTH_SECRET: z.string().min(32),
    BETTER_AUTH_URL: z.url(),
    REDIS_URL: z
      .union([
        z.literal(''),
        z
          .url()
          .refine((value) => /^rediss?:/.test(value), 'must be a Redis URL'),
      ])
      .optional(),
    NATS_SERVERS: z.string().trim().min(1),
    NATS_USER: z.string().trim().min(1),
    NATS_PASSWORD: z.string().min(1),
    CRON_SECRET: z.string().optional(),
    CROSS_SERVER_ENABLED: z.enum(['true', 'false']).default('false'),
    CROSS_SERVER_SITE_ID: z.uuid().optional(),
    CROSS_SERVER_NAME: z.string().trim().min(1).max(80).optional(),
    CROSS_SERVER_API_BASE_URL: z.url().max(300).optional(),
    CROSS_SERVER_PRIVATE_KEY: z
      .string()
      .regex(/^[A-Za-z0-9+/]+={0,2}$/)
      .max(256)
      .optional(),
    CROSS_SERVER_ALLOW_LOCALHOST: z.enum(['true', 'false']).default('false'),
    SMTP_PORT: positiveInteger('465', 65535),
    API_IP_RATE_LIMIT_WINDOW_SECONDS: positiveInteger('60'),
    API_IP_RATE_LIMIT_MAX_REQUESTS: positiveInteger('300'),
  })
  .catchall(z.string().optional())
  .superRefine((env, ctx) => {
    if (env.CROSS_SERVER_ENABLED === 'true') {
      for (const key of [
        'CROSS_SERVER_SITE_ID',
        'CROSS_SERVER_NAME',
        'CROSS_SERVER_API_BASE_URL',
        'CROSS_SERVER_PRIVATE_KEY',
      ] as const) {
        if (!env[key])
          ctx.addIssue({
            code: 'custom',
            path: [key],
            message: 'is required when cross-server access is enabled',
          });
      }
    }
    if (env.NODE_ENV === 'production' && !env.REDIS_URL) {
      ctx.addIssue({
        code: 'custom',
        path: ['REDIS_URL'],
        message: 'is required in production',
      });
    }
    if (env.NODE_ENV === 'production' && !env.CRON_SECRET?.trim()) {
      ctx.addIssue({
        code: 'custom',
        path: ['CRON_SECRET'],
        message: 'is required in production',
      });
    }
    if (env.NODE_ENV === 'production' && env.APP_ENV === 'local') {
      ctx.addIssue({
        code: 'custom',
        path: ['APP_ENV'],
        message: 'local is forbidden in production',
      });
    }
  });

export type RuntimeEnvironment = z.infer<typeof environmentSchema>;
let environment: RuntimeEnvironment | undefined;

// Also used by framework-independent repositories and maintenance commands.
// One immutable startup snapshot; no implicit dotenv files or secret logging.
export function getRuntimeEnvironment(): RuntimeEnvironment {
  if (environment) return environment;
  const result = environmentSchema.safeParse(process.env);
  if (!result.success) {
    throw new Error(
      `Invalid server configuration: ${result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ')}`,
    );
  }
  environment = Object.freeze(result.data);
  return environment;
}
