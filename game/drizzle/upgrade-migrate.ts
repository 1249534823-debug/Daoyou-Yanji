/** Explicit target, no implicit env/local.env and no application-side writers. */
import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
const args = process.argv.slice(2);
const expected = args.includes('--database') ? args[args.indexOf('--database') + 1] : undefined;
if (!expected || !process.env.DATABASE_URL) throw new Error('Set DATABASE_URL and --database EXPECTED_NAME');
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
try {
  await client.connect();
  const result = await client.query<{ name: string }>('SELECT current_database() AS name');
  if (result.rows[0]?.name !== expected) throw new Error('Database identity mismatch');
  const db = drizzle(client);
  await migrate(db, { migrationsFolder: './drizzle-auth', migrationsSchema: 'drizzle', migrationsTable: '__drizzle_auth_migrations' });
  console.log('Better Auth migrations complete');
  await migrate(db, { migrationsFolder: './drizzle', migrationsSchema: 'drizzle', migrationsTable: '__drizzle_migrations' });
  console.log('Business migrations complete');
  const ledger = await client.query('SELECT count(*)::int AS entries, max(created_at)::text AS latest FROM drizzle.__drizzle_migrations');
  console.log(JSON.stringify(ledger.rows[0]));
} finally { await client.end(); }
