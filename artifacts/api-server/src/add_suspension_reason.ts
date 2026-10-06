import { db } from '@workspace/db';
import { sql } from 'drizzle-orm';

async function main() {
  await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS suspension_reason VARCHAR;`);
  console.log("Added suspension_reason to users table");
  process.exit(0);
}

main().catch(console.error);
