import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

async function run() {
  await db.execute(sql`ALTER TABLE researchsphere_papers ADD COLUMN IF NOT EXISTS rejection_reason TEXT;`);
  console.log("Added rejection_reason to researchsphere_papers table");
  process.exit(0);
}
run().catch(console.error);
