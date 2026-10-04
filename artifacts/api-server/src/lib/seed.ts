import { eq, sql } from "drizzle-orm";
import {
  db,
  categoriesTable,
  departmentsTable,
  paperActivityTable,
  paperEmbeddingsTable,
  paperVersionsTable,
  papersTable,
  usersTable,
} from "@workspace/db";
import { newId } from "./researchsphere";
import { embedQuery } from "./ai";

await db.execute(sql`CREATE TABLE IF NOT EXISTS researchsphere_paper_citations (id VARCHAR(255) PRIMARY KEY, citing_paper_id VARCHAR(255) NOT NULL REFERENCES researchsphere_papers(id) ON DELETE CASCADE, cited_paper_id VARCHAR(255) REFERENCES researchsphere_papers(id) ON DELETE SET NULL, raw_reference_text TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());`); const departments = [
  { id: "computer-science", name: "Computer Science", code: "CS" },
  { id: "electrical-engineering", name: "Electrical Engineering", code: "EE" },
  { id: "data-science", name: "Data Science", code: "DS" },
  { id: "mathematics", name: "Mathematics", code: "MATH" },
  { id: "physics", name: "Physics", code: "PHYS" },
  { id: "biology", name: "Biology", code: "BIO" },
  { id: "economics", name: "Economics", code: "ECON" },
];

const categories = [
  ["RESEARCH_AREA", "Artificial Intelligence"],
  ["RESEARCH_AREA", "Information Security"],
  ["RESEARCH_AREA", "Climate Informatics"],
  ["RESEARCH_AREA", "Distributed Systems"],
  ["RESEARCH_AREA", "Quantum Computing"],
  ["RESEARCH_AREA", "Biomedical Engineering"],
  ["RESEARCH_AREA", "Behavioral Economics"],
  ["RESEARCH_AREA", "Astrophysics"],
  ["PAPER_TYPE", "Journal Article"],
  ["PAPER_TYPE", "Conference Paper"],
  ["PAPER_TYPE", "Research Note"],
] as const;

const authors = [
  { id: "rs-seed-author-1", firstName: "Mira", lastName: "Sen", email: "mira.sen@researchsphere.example" },
  { id: "rs-seed-author-2", firstName: "Jun", lastName: "Park", email: "jun.park@researchsphere.example" },
  { id: "rs-seed-author-3", firstName: "Anika", lastName: "Rao", email: "anika.rao@researchsphere.example" },
  { id: "rs-seed-author-4", firstName: "Elena", lastName: "Marquez", email: "elena.marquez@researchsphere.example" },
  { id: "rs-seed-author-5", firstName: "Ravi", lastName: "Narayanan", email: "ravi.narayanan@researchsphere.example" },
];

const papers = [
  {
    id: "seed-paper-clinical-retrieval",
    title: "Reliable Retrieval-Augmented Generation for Clinical Decision Support",
    abstract: "Clinical language models can produce fluent answers while obscuring the evidence behind them. We present a retrieval-augmented decision-support pipeline that separates evidence retrieval, answer synthesis, and citation verification. In a blinded evaluation across 640 de-identified clinical questions, evidence-first generation improved citation completeness and reduced unsupported recommendations compared with a prompt-only baseline. The results suggest that retrieval quality and source traceability should be measured alongside answer accuracy when language models are introduced into clinical workflows.",
    year: 2025,
    departmentId: "computer-science",
    researchArea: "Artificial Intelligence",
    paperType: "Journal Article",
    keywords: ["retrieval-augmented generation", "clinical NLP", "evidence grounding", "evaluation"],
    authorId: authors[0].id,
  },
  {
    id: "seed-paper-fraud-graphs",
    title: "Temporal Graph Learning for Early Detection of Coordinated Financial Fraud",
    abstract: "Financial fraud frequently appears as a coordinated sequence of individually plausible transactions. This study introduces a temporal graph-learning method that combines account relationships, transaction timing, and weak supervision from delayed investigation outcomes. Experiments on a year-long, privacy-preserving transaction graph show that the model improves early-warning precision over static graph and gradient-boosted baselines while preserving an interpretable set of contributing neighborhoods. We discuss deployment constraints, alert review burden, and the implications of label delay for operational monitoring.",
    year: 2024,
    departmentId: "computer-science",
    researchArea: "Artificial Intelligence",
    paperType: "Conference Paper",
    keywords: ["graph neural networks", "financial fraud", "temporal learning", "anomaly detection"],
    authorId: authors[1].id,
  },
  {
    id: "seed-paper-federated-city",
    title: "Communication-Efficient Federated Learning for Urban Sensor Networks",
    abstract: "Urban sensing systems collect data across institutions that cannot always share their raw measurements. We evaluate a communication-efficient federated optimization procedure for traffic and air-quality forecasting across heterogeneous municipal sensor networks. Adaptive client sampling and compressed updates reduce communication volume without sacrificing forecast quality under realistic device drop-out. Results across three city-scale simulations identify where non-identical data distributions remain the main source of error and provide practical guidance for selecting aggregation intervals.",
    year: 2025,
    departmentId: "electrical-engineering",
    researchArea: "Distributed Systems",
    paperType: "Journal Article",
    keywords: ["federated learning", "smart cities", "edge computing", "sensor networks"],
    authorId: authors[2].id,
  },
  {
    id: "seed-paper-prompt-injection",
    title: "Detecting Prompt Injection in Tool-Using Language Models",
    abstract: "Tool-using language models create new security boundaries because untrusted documents can influence actions beyond text generation. We introduce a threat taxonomy and a lightweight detection method that scores instruction-bearing passages against the active task and tool permissions. Across a curated benchmark of direct and indirect prompt-injection attempts, the detector reduced unauthorized tool calls when paired with least-privilege execution, although adaptive attacks continued to expose failure modes. We release a reproducible evaluation protocol and recommend layered controls rather than reliance on a single classifier.",
    year: 2025,
    departmentId: "computer-science",
    researchArea: "Information Security",
    paperType: "Research Note",
    keywords: ["prompt injection", "language model security", "tool use", "adversarial evaluation"],
    authorId: authors[3].id,
  },
  {
    id: "seed-paper-flood-forecasting",
    title: "Low-Cost Flood Forecasting with Multimodal Satellite and Rainfall Data",
    abstract: "Flood forecasts in data-sparse regions are limited by uneven gauge coverage and changing land conditions. This paper combines open satellite imagery, rainfall estimates, and a compact recurrent model to produce short-horizon inundation risk maps. Evaluation against held-out flood events shows that multimodal inputs improve recall in catchments without dense ground sensors, while uncertainty remains highest in rapidly urbanizing areas. The approach is designed for low-cost updating and includes a calibration step to communicate confidence to local planning teams.",
    year: 2023,
    departmentId: "data-science",
    researchArea: "Climate Informatics",
    paperType: "Journal Article",
    keywords: ["flood forecasting", "remote sensing", "climate informatics", "uncertainty"],
    authorId: authors[4].id,
  },
];

export async function seedResearchSphere(): Promise<void> {
  await db.insert(departmentsTable).values(departments).onConflictDoNothing();
  await db.insert(categoriesTable).values(
    categories.map(([kind, name]) => ({ id: `seed-${kind.toLowerCase()}-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`, kind, name })),
  ).onConflictDoNothing();
  await db.insert(usersTable).values(authors).onConflictDoNothing();

  for (const seed of papers) {
    const [existing] = await db.select({ id: papersTable.id })
      .from(papersTable)
      .where(eq(papersTable.id, seed.id))
      .limit(1);
    if (existing) continue;

    await db.transaction(async (tx) => {
      await tx.insert(papersTable).values({
        ...seed,
        doi: null,
        objectPath: null,
        fileHash: null,
        status: "APPROVED",
        uploadedById: seed.authorId,
        readingTime: Math.max(1, Math.ceil((seed.abstract.split(/\s+/).length * 25) / 200)),
        complexity: "Advanced",
      });
      const versionId = newId();
      await tx.insert(paperVersionsTable).values({
        id: versionId,
        paperId: seed.id,
        versionNumber: 1,
        objectPath: null,
        fileHash: null,
      });
      await tx.insert(paperActivityTable).values(
        Array.from({ length: 4 }, (_, index) => ({
          id: newId(),
          paperId: seed.id,
          userId: null,
          kind: index === 3 ? "DOWNLOAD" as const : "VIEW" as const,
        })),
      );

      try {
        const textToEmbed = `${seed.title}. ${seed.abstract}. Keywords: ${seed.keywords.join(", ")}`;
        const embedding = await embedQuery(textToEmbed);
        await tx.insert(paperEmbeddingsTable).values({
          id: newId(),
          paperVersionId: versionId,
          embedding,
          modelName: "all-mpnet-base-v2",
          modelVersion: "1.0",
        });
      } catch (err) {
        console.error(`Failed to generate seed embedding for "${seed.title}":`, err);
      }
    });
  }
}