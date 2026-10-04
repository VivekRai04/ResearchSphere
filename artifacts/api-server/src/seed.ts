import { pool } from "@workspace/db";
import { seedResearchSphere } from "./lib/seed";

seedResearchSphere()
  .then(() => {
    console.info("ResearchSphere seed data is present.");
  })
  .catch((error) => {
    console.error("Could not seed ResearchSphere data.", error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());