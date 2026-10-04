import pg from 'pg';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
pool.query(`
CREATE TABLE IF NOT EXISTS researchsphere_paper_comments (
  id VARCHAR PRIMARY KEY,
  paper_id VARCHAR NOT NULL REFERENCES researchsphere_papers(id) ON DELETE CASCADE,
  user_id VARCHAR NOT NULL REFERENCES researchsphere_users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS researchsphere_comments_paper_idx ON researchsphere_paper_comments (paper_id);
`).then(() => { 
  console.log('Created'); 
  process.exit(0); 
}).catch(e => { 
  console.error(e); 
  process.exit(1); 
});
