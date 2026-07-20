const { Pool } = require('pg');
const pool = new Pool({
  user: 'corefti',
  password: 'c0r3ft1',
  host: '192.168.229.196',
  database: 'dbcorefti',
  port: 5432,
  ssl: false
});
pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'active_student_requests'").then(r => {
  console.log(r.rows.map(row => row.column_name));
  pool.end();
});
