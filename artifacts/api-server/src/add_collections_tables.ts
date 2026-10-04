import { sql } from "drizzle-orm";
import { db } from "@workspace/db";

async function main() {
  console.log("Creating collections tables...");
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS researchsphere_collections (
      id VARCHAR PRIMARY KEY,
      user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name VARCHAR NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS researchsphere_collections_user_idx ON researchsphere_collections (user_id);

    CREATE TABLE IF NOT EXISTS researchsphere_collection_bookmarks (
      id VARCHAR PRIMARY KEY,
      collection_id VARCHAR NOT NULL REFERENCES researchsphere_collections(id) ON DELETE CASCADE,
      bookmark_id VARCHAR NOT NULL REFERENCES researchsphere_bookmarks(id) ON DELETE CASCADE,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    );
    CREATE UNIQUE INDEX IF NOT EXISTS researchsphere_cb_collection_bookmark_uq ON researchsphere_collection_bookmarks (collection_id, bookmark_id);
  `);
  console.log("Created successfully");
  process.exit(0);
}

main().catch(console.error);
