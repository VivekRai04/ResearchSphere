const fs = require('fs');
const path = 'lib/db/src/schema/researchsphere.ts';
let code = fs.readFileSync(path, 'utf8');

// First remove any existing customType vector or tables if we added them recently
code = code.replace(/export const vector = customType[\s\S]*?\}\);/g, '');
code = code.replace(/export const paperContentsTable = [\s\S]*?\);/g, '');
code = code.replace(/export const paperEmbeddingsTable = [\s\S]*?\);/g, '');
// Replace the old customType import if we accidentally mangled it, or ensure it's there
if (!code.includes('customType,')) {
  code = code.replace('import {', 'import {\\n  customType,');
}

const vectorDef = `
export const vector = customType<{ data: number[]; driverData: string; config: { dimensions: number } }>({
  dataType(config) {
    return \`vector(\${config?.dimensions ?? 768})\`;
  },
  toDriver(value: number[]): string {
    return \`[\${value.join(",")}]\`;
  },
  fromDriver(value: string): number[] {
    return JSON.parse(value);
  },
});
`;

const newTables = `
export const paperContentsTable = pgTable(
  "researchsphere_paper_contents",
  {
    id: varchar("id").primaryKey(),
    paperVersionId: varchar("paper_version_id")
      .notNull()
      .references(() => paperVersionsTable.id, { onDelete: "cascade" }),
    extractedText: text("extracted_text").notNull(),
    extractionStatus: varchar("extraction_status").notNull().default("PENDING"),
  }
);

export const paperEmbeddingsTable = pgTable(
  "researchsphere_paper_embeddings",
  {
    id: varchar("id").primaryKey(),
    paperVersionId: varchar("paper_version_id")
      .notNull()
      .references(() => paperVersionsTable.id, { onDelete: "cascade" }),
    embedding: vector("embedding", { dimensions: 768 }).notNull(),
    modelName: varchar("model_name").notNull(),
    modelVersion: varchar("model_version").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  }
);
`;

code = code.replace(
  'export type Department =',
  vectorDef + '\\n' + newTables + '\\nexport type Department ='
);

fs.writeFileSync(path, code);
