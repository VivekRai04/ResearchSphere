const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://postgres:root@localhost:5432/researchsphere' });
client.connect().then(() => client.query('select "id", "title", "abstract", "year", "department_id", "research_area", "paper_type", "doi", "object_path", "file_hash", "keywords", "status", "reading_time", "complexity", "uploaded_by_id", "created_at", "updated_at" from "researchsphere_papers" limit 1')).then((res) => { console.log('success'); client.end(); }).catch(e => { console.error('error:', e); client.end(); });
