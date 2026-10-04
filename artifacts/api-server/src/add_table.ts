import { sql } from "drizzle-orm";
import { db } from "@workspace/db";

async function main() {
  console.log("Creating paperCommentsTable...");
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS researchsphere_paper_comments (
      id VARCHAR PRIMARY KEY,
      paper_id VARCHAR NOT NULL REFERENCES researchsphere_papers(id) ON DELETE CASCADE,
      user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      content TEXT NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS researchsphere_comments_paper_idx ON researchsphere_paper_comments (paper_id);
  `);
  console.log("Created successfully");
  process.exit(0);
}

main().catch(console.error);
