/**
 * Standalone Migration Runner (plain JS, no tsx required)
 *
 * Designed to run inside the production Docker image where tsx
 * and the full settings module are not available.
 *
 * Usage: DATABASE_URL=... node server/db/migrate.mjs
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('DATABASE_URL environment variable is not set');
  process.exit(1);
}

console.log('Running migrations...');
console.log(`Database: ${connectionString.replace(/:[^:@]+@/, ':****@')}`);

const client = postgres(connectionString, { max: 1 });
const db = drizzle(client);

try {
  await migrate(db, { migrationsFolder: './server/db/migrations' });
  console.log('Migrations complete!');
} catch (error) {
  console.error('Migration failed:', error);
  process.exit(1);
} finally {
  await client.end();
}
