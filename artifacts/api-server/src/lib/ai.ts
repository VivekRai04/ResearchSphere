import fs from "fs/promises";
import path from "path";
import { PDFParse } from "pdf-parse";
import { db } from "@workspace/db";
import { paperContentsTable, paperEmbeddingsTable } from "@workspace/db/schema";
import { newId } from "./researchsphere";

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || "http://localhost:8000";

export async function processPaperEmbedding(
  paperVersionId: string,
  objectPath: string
) {
  try {
    // 1. Extract text from the PDF file
    const uploadDir = path.resolve(process.cwd(), "uploads");
    const filePath = path.join(uploadDir, objectPath);
    const dataBuffer = await fs.readFile(filePath);
    const parser = new PDFParse({ data: dataBuffer });
    let extractedText = "";
    try {
      extractedText = (await parser.getText()).text.trim();
    } finally {
      await parser.destroy();
    }

    if (!extractedText) {
      throw new Error("No text extracted from PDF");
    }

    // 2. Save extracted text
    await db.insert(paperContentsTable).values({
      id: newId(),
      paperVersionId,
      extractedText,
      extractionStatus: "COMPLETED",
    });

    // 3. Build a high-density semantic text representation from paper metadata + abstract
    const { paperVersionsTable, papersTable, departmentsTable } = await import("@workspace/db/schema");
    const { eq } = await import("drizzle-orm");

    const [paperRecord] = await db
      .select({
        title: papersTable.title,
        abstract: papersTable.abstract,
        researchArea: papersTable.researchArea,
        paperType: papersTable.paperType,
        keywords: papersTable.keywords,
        departmentName: departmentsTable.name,
      })
      .from(paperVersionsTable)
      .innerJoin(papersTable, eq(paperVersionsTable.paperId, papersTable.id))
      .leftJoin(departmentsTable, eq(papersTable.departmentId, departmentsTable.id))
      .where(eq(paperVersionsTable.id, paperVersionId))
      .limit(1);

    let semanticText = "";
    if (paperRecord) {
      const kw = Array.isArray(paperRecord.keywords) ? paperRecord.keywords.join(", ") : "";
      semanticText = `Title: ${paperRecord.title}\nDepartment: ${paperRecord.departmentName ?? ""}\nResearch Area: ${paperRecord.researchArea}\nKeywords: ${kw}\nAbstract: ${paperRecord.abstract}`;
    } else {
      semanticText = extractedText.substring(0, 2000);
    }

    // 4. Request embeddings from Python AI service
    const response = await fetch(`${AI_SERVICE_URL}/embed`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: semanticText }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`AI service failed: ${response.status} ${errorText}`);
    }

    const { embedding, model, dimensions } = (await response.json()) as any;

    // 5. Save embeddings (upsert/delete old if exists)
    await db.delete(paperEmbeddingsTable).where(eq(paperEmbeddingsTable.paperVersionId, paperVersionId));
    await db.insert(paperEmbeddingsTable).values({
      id: newId(),
      paperVersionId,
      embedding,
      modelName: model || "all-mpnet-base-v2",
      modelVersion: "1.0",
    });

    console.log(`Successfully generated dense semantic embeddings for paper version ${paperVersionId}`);
  } catch (error) {
    console.error(`Failed to process embeddings for paper version ${paperVersionId}:`, error);
    // Mark as failed if we at least have a record, but for now just logging is fine
  }
}

export async function embedQuery(text: string): Promise<number[]> {
  const response = await fetch(`${AI_SERVICE_URL}/embed`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`AI service failed: ${response.status} ${errorText}`);
  }

  const { embedding } = (await response.json()) as any;
  return embedding;
}
