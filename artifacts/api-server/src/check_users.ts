import { db } from '@workspace/db';

async function main() {
  const profiles = await db.query.userProfilesTable.findMany({ with: { user: true } });
  console.log(JSON.stringify(profiles, null, 2));
  process.exit(0);
}

main().catch(console.error);
