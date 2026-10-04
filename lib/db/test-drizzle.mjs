import { drizzle } from "drizzle-orm/node-postgres";
import { pgTable, varchar, integer, timestamp, jsonb } from "drizzle-orm/pg-core";
import { Client } from "pg";
import { eq } from "drizzle-orm";

const papersTable = pgTable("researchsphere_papers", {
  id: varchar("id"),
  title: varchar("title"),
  abstract: varchar("abstract"),
  year: integer("year"),
  departmentId: varchar("department_id"),
  researchArea: varchar("research_area"),
  paperType: varchar("paper_type"),
  doi: varchar("doi"),
  objectPath: varchar("object_path"),
  fileHash: varchar("file_hash"),
  keywords: jsonb("keywords"),
  status: varchar("status"),
  readingTime: integer("reading_time"),
  complexity: varchar("complexity"),
  uploadedById: varchar("uploaded_by_id"),
  createdAt: timestamp("created_at"),
  updatedAt: timestamp("updated_at")
});

async function main() {
  const client = new Client({ connectionString: 'postgresql://postgres:root@localhost:5432/researchsphere' });
  await client.connect();
  const db = drizzle(client);

  try {
    await db.select().from(papersTable).where(eq(papersTable.id, 'e223b271-a222-4e0e-b20e-904cfb650b19')).limit(1);
    console.log("Success");
  } catch (e) {
    console.error("Original error:", e);
  } finally {
    await client.end();
  }
}
main();
