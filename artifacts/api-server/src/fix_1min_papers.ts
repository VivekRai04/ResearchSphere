import { db, papersTable } from "@workspace/db";
import { lte, isNotNull, and, eq } from "drizzle-orm";
import { PDFParse } from "pdf-parse";
import fs from "fs/promises";
import path from "path";

async function fixPapers() {
  console.log("Looking for 1-minute read papers with PDFs...");
  const papers = await db.select().from(papersTable).where(
    and(lte(papersTable.readingTime, 1), isNotNull(papersTable.objectPath))
  );

  console.log(`Found ${papers.length} papers to re-evaluate.`);

  for (const paper of papers) {
    try {
      const fullPath = path.resolve(process.cwd(), 'uploads', paper.objectPath!);
      const bytes = await fs.readFile(fullPath);
      const parser = new PDFParse({ data: bytes });
      
      let numPages = 1;
      let text = "";
      try {
        const doc = await (parser as any).load();
        numPages = doc.numPages || 1;
        text = (await parser.getText()).text;
      } finally {
        await parser.destroy();
      }

      const normalized = text.replace(/\0/g, " ").replace(/[ \t]+/g, " ").trim();
      const words = normalized.split(/\s+/);
      let readingTime = Math.ceil(words.length / 200);
      
      // Fallback for scanned or image-heavy PDFs
      if (words.length / numPages < 100) {
        readingTime = Math.max(readingTime, numPages * 2);
      }
      readingTime = Math.max(1, readingTime);

      if (readingTime !== paper.readingTime) {
         await db.update(papersTable)
           .set({ readingTime })
           .where(eq(papersTable.id, paper.id));
         console.log(`Updated paper ${paper.id}: was ${paper.readingTime} min, now ${readingTime} min (Pages: ${numPages})`);
      } else {
         console.log(`Paper ${paper.id}: unchanged (${readingTime} min, Pages: ${numPages})`);
      }
    } catch (e) {
      console.error(`Error processing ${paper.id}:`, e);
    }
  }
  
  console.log("Fix complete.");
}

fixPapers().catch(console.error).finally(() => process.exit(0));
