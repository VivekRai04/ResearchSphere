import { eq, desc } from "drizzle-orm";
import { db, paperCommentsTable, usersTable, papersTable } from "@workspace/db";

async function test() {
  try {
    const query = db
      .select({
        id: paperCommentsTable.id,
        userId: paperCommentsTable.userId,
        content: paperCommentsTable.content,
        createdAt: paperCommentsTable.createdAt,
        firstName: usersTable.firstName,
        lastName: usersTable.lastName,
        email: usersTable.email,
      })
      .from(paperCommentsTable)
      .innerJoin(usersTable, eq(paperCommentsTable.userId, usersTable.id))
      .where(eq(paperCommentsTable.paperId, "test-id"))
      .orderBy(desc(paperCommentsTable.createdAt));
      
    console.log("SQL:", query.toSQL());
    const res = await query;
    console.log("Success", res);
  } catch (err) {
    console.error("Query failed!");
    console.error(err);
  }
  process.exit(0);
}
test();
