import pg from 'pg';

const pool = new pg.Pool({ connectionString: 'postgresql://postgres:root@localhost:5432/researchsphere' });
pool.query(`select "researchsphere_paper_comments"."id", "researchsphere_paper_comments"."user_id", "researchsphere_paper_comments"."content", "researchsphere_paper_comments"."created_at", "users"."first_name", "users"."last_name", "users"."email" from "researchsphere_paper_comments" inner join "users" on "researchsphere_paper_comments"."user_id" = "users"."id" limit 1`).then(res => { console.log(res.rows); process.exit(0); }).catch(e => { console.error(e); process.exit(1); });
