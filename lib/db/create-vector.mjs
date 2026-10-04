import pg from "pg";
const { Client } = pg;
const client = new Client({ connectionString: process.env.DATABASE_URL });
client.connect().then(() => client.query('CREATE EXTENSION IF NOT EXISTS vector;')).then(() => { console.log('Vector extension created'); client.end(); }).catch(e => { console.error(e); client.end(); });
