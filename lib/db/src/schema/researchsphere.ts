import { sql } from "drizzle-orm";
import {
  customType,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";
import { usersTable } from "./auth";

export const userRoleEnum = pgEnum("researchsphere_user_role", [
  "STUDENT",
  "REVIEWER",
  "ADMIN",
]);
export const paperStatusEnum = pgEnum("researchsphere_paper_status", [
  "PENDING_REVIEW",
  "APPROVED",
  "REJECTED",
  "REVISION_REQUIRED",
]);
export const categoryKindEnum = pgEnum("researchsphere_category_kind", [
  "RESEARCH_AREA",
  "PAPER_TYPE",
]);
export const reviewStatusEnum = pgEnum("researchsphere_review_status", [
  "APPROVED",
  "REJECTED",
  "REVISION_REQUIRED",
]);
export const activityKindEnum = pgEnum("researchsphere_activity_kind", [
  "VIEW",
  "DOWNLOAD",
]);

export const departmentsTable = pgTable("researchsphere_departments", {
  id: varchar("id").primaryKey(),
  name: text("name").notNull(),
  code: varchar("code", { length: 16 }).notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const userProfilesTable = pgTable(
  "researchsphere_user_profiles",
  {
    id: varchar("id").primaryKey(),
    userId: varchar("user_id")
      .notNull()
      .unique()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    role: userRoleEnum("role").notNull().default("STUDENT"),
    departmentId: varchar("department_id").references(
      () => departmentsTable.id,
      { onDelete: "set null" },
    ),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("researchsphere_profiles_role_idx").on(table.role)],
);

export const categoriesTable = pgTable(
  "researchsphere_categories",
  {
    id: varchar("id").primaryKey(),
    kind: categoryKindEnum("kind").notNull(),
    name: text("name").notNull(),
  },
  (table) => [
    uniqueIndex("researchsphere_categories_kind_name_uq").on(
      table.kind,
      table.name,
    ),
  ],
);

export const uploadsTable = pgTable(
  "researchsphere_uploads",
  {
    id: varchar("id").primaryKey(),
    userId: varchar("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    objectPath: text("object_path").notNull().unique(),
    fileName: text("file_name").notNull(),
    size: integer("size").notNull(),
    contentType: varchar("content_type", { length: 128 }).notNull(),
    fileHash: varchar("file_hash", { length: 64 }),
    paperId: varchar("paper_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("researchsphere_uploads_user_idx").on(table.userId)],
);

export const papersTable = pgTable(
  "researchsphere_papers",
  {
    id: varchar("id").primaryKey(),
    title: text("title").notNull(),
    abstract: text("abstract").notNull(),
    year: integer("year").notNull(),
    departmentId: varchar("department_id")
      .notNull()
      .references(() => departmentsTable.id, { onDelete: "restrict" }),
    researchArea: text("research_area").notNull(),
    paperType: text("paper_type").notNull(),
    doi: text("doi"),
    objectPath: text("object_path"),
    fileHash: varchar("file_hash", { length: 64 }),
    keywords: jsonb("keywords")
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    status: paperStatusEnum("status").notNull().default("PENDING_REVIEW"),
    readingTime: integer("reading_time"),
    complexity: varchar("complexity"),
    rejectionReason: text("rejection_reason"),
    uploadedById: varchar("uploaded_by_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("researchsphere_papers_status_idx").on(table.status),
    index("researchsphere_papers_department_idx").on(table.departmentId),
    index("researchsphere_papers_year_idx").on(table.year),
    uniqueIndex("researchsphere_papers_file_hash_uq").on(table.fileHash),
  ],
);

export const paperVersionsTable = pgTable(
  "researchsphere_paper_versions",
  {
    id: varchar("id").primaryKey(),
    paperId: varchar("paper_id")
      .notNull()
      .references(() => papersTable.id, { onDelete: "cascade" }),
    versionNumber: integer("version_number").notNull(),
    objectPath: text("object_path"),
    fileHash: varchar("file_hash", { length: 64 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("researchsphere_paper_version_number_uq").on(
      table.paperId,
      table.versionNumber,
    ),
  ],
);

export const reviewsTable = pgTable(
  "researchsphere_reviews",
  {
    id: varchar("id").primaryKey(),
    paperId: varchar("paper_id")
      .notNull()
      .references(() => papersTable.id, { onDelete: "cascade" }),
    reviewerId: varchar("reviewer_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "restrict" }),
    status: reviewStatusEnum("status").notNull(),
    comments: text("comments").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("researchsphere_reviews_paper_created_idx").on(
      table.paperId,
      table.createdAt,
    ),
  ],
);

export const bookmarksTable = pgTable(
  "researchsphere_bookmarks",
  {
    id: varchar("id").primaryKey(),
    userId: varchar("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    paperId: varchar("paper_id")
      .notNull()
      .references(() => papersTable.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("researchsphere_bookmarks_user_paper_uq").on(
      table.userId,
      table.paperId,
    ),
  ],
);

export const collectionsTable = pgTable(
  "researchsphere_collections",
  {
    id: varchar("id").primaryKey(),
    userId: varchar("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    name: varchar("name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("researchsphere_collections_user_idx").on(table.userId)],
);

export const collectionBookmarksTable = pgTable(
  "researchsphere_collection_bookmarks",
  {
    id: varchar("id").primaryKey(),
    collectionId: varchar("collection_id")
      .notNull()
      .references(() => collectionsTable.id, { onDelete: "cascade" }),
    bookmarkId: varchar("bookmark_id")
      .notNull()
      .references(() => bookmarksTable.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("researchsphere_cb_collection_bookmark_uq").on(
      table.collectionId,
      table.bookmarkId,
    ),
  ],
);

export const paperActivityTable = pgTable(
  "researchsphere_paper_activity",
  {
    id: varchar("id").primaryKey(),
    paperId: varchar("paper_id")
      .notNull()
      .references(() => papersTable.id, { onDelete: "cascade" }),
    userId: varchar("user_id").references(() => usersTable.id, {
      onDelete: "set null",
    }),
    kind: activityKindEnum("kind").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("researchsphere_activity_kind_idx").on(table.kind)],
);

export const paperCommentsTable = pgTable(
  "researchsphere_paper_comments",
  {
    id: varchar("id").primaryKey(),
    paperId: varchar("paper_id")
      .notNull()
      .references(() => papersTable.id, { onDelete: "cascade" }),
    userId: varchar("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    content: text("content").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("researchsphere_comments_paper_idx").on(table.paperId)],
);

export const paperCitationsTable = pgTable(
  "researchsphere_paper_citations",
  {
    id: varchar("id").primaryKey(),
    citingPaperId: varchar("citing_paper_id")
      .notNull()
      .references(() => papersTable.id, { onDelete: "cascade" }),
    citedPaperId: varchar("cited_paper_id")
      .references(() => papersTable.id, { onDelete: "set null" }),
    rawReferenceText: text("raw_reference_text").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("researchsphere_citations_citing_idx").on(table.citingPaperId),
    index("researchsphere_citations_cited_idx").on(table.citedPaperId),
  ],
);










export const vector = customType<{ data: number[]; driverData: string; config: { dimensions: number } }>({
  dataType(config) {
    return `vector(${config?.dimensions ?? 768})`;
  },
  toDriver(value: number[]): string {
    return `[${value.join(",")}]`;
  },
  fromDriver(value: string): number[] {
    return JSON.parse(value);
  },
});


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

export type Department = typeof departmentsTable.$inferSelect;
export type UserProfile = typeof userProfilesTable.$inferSelect;
export type Category = typeof categoriesTable.$inferSelect;
export type PaperRecord = typeof papersTable.$inferSelect;