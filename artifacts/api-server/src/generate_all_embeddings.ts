import { db } from "@workspace/db";
import { paperEmbeddingsTable, paperVersionsTable, papersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { embedQuery } from "./lib/ai.js";
import { newId } from "./lib/researchsphere.js";

async function generateAllEmbeddings() {
  console.log("Checking papers missing vector embeddings...");
  
  const papersWithVersions = await db
    .select({
      paperId: papersTable.id,
      title: papersTable.title,
      abstract: papersTable.abstract,
      keywords: papersTable.keywords,
      versionId: paperVersionsTable.id,
    })
    .from(papersTable)
    .innerJoin(paperVersionsTable, eq(papersTable.id, paperVersionsTable.paperId));

  for (const item of papersWithVersions) {
    const [existing] = await db
      .select({ id: paperEmbeddingsTable.id })
      .from(paperEmbeddingsTable)
      .where(eq(paperEmbeddingsTable.paperVersionId, item.versionId))
      .limit(1);

    if (existing) {
      console.log(`Skipping "${item.title}" (embedding already exists)`);
      continue;
    }

    console.log(`Generating embedding for "${item.title}"...`);
    const textToEmbed = `${item.title}. ${item.abstract}. Keywords: ${item.keywords.join(", ")}`;
    
    try {
      const embedding = await embedQuery(textToEmbed);
      await db.insert(paperEmbeddingsTable).values({
        id: newId(),
        paperVersionId: item.versionId,
        embedding,
        modelName: "all-mpnet-base-v2",
        modelVersion: "1.0",
      });
      console.log(`Successfully saved embedding for "${item.title}"`);
    } catch (err) {
      console.error(`Failed to generate embedding for "${item.title}":`, err);
    }
  }

  console.log("Done generating embeddings!");
  process.exit(0);
}

generateAllEmbeddings().catch((err) => {
  console.error(err);
  process.exit(1);
});
