import 'dotenv/config';
import fs from 'fs';
import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

async function run() {
  try {
    let sql = fs.readFileSync('wilayah.sql', 'utf8');
    console.log('Original Length:', sql.length);
    
    // Replace MySQL specific syntax
    sql = sql.replace(/ENGINE=MyISAM/gi, '');
    sql = sql.replace(/ENGINE=InnoDB/gi, '');
    sql = sql.replace(/CREATE INDEX (.*?) ON (.*?) \((.*?)\);/gi, 'CREATE INDEX IF NOT EXISTS $1 ON $2 ($3);');
    
    console.log('Modified Length:', sql.length);
    console.log('Executing...');
    await pool.query(sql);
    console.log('Import successful!');
  } catch (err) {
    console.error('Error importing:', err);
  } finally {
    await pool.end();
  }
}
run();