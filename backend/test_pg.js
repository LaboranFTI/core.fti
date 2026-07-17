import pg from 'pg';
const { Client } = pg;
const client = new Client({ user: 'corefti', password: 'c0r3ft1', host: '192.168.229.196', database: 'dbcorefti', port: 5432, ssl: false });
client.connect().then(async () => {
  const res = await client.query("SELECT CURRENT_TIMESTAMP, NOW(), '2026-07-17 10:56:00'::timestamp AS test_ts, '2026-07-17 10:56:00'::timestamp with time zone AS test_ts_tz");
  console.log(res.rows[0]);
  console.log('Parsed test_ts (timestamp):', res.rows[0].test_ts.toISOString());
  console.log('Parsed test_ts_tz (timestamptz):', res.rows[0].test_ts_tz.toISOString());
  
  // also test insert behavior
  const d = new Date('2026-07-17T03:56:00.000Z'); // 10:56 WIB
  console.log('Binding Date object:', d.toISOString());
  const res2 = await client.query("SELECT $1::timestamp AS b_ts, $1::timestamp with time zone AS b_ts_tz", [d]);
  console.log('Bound as timestamp:', res2.rows[0].b_ts.toISOString());
  console.log('Bound as timestamptz:', res2.rows[0].b_ts_tz.toISOString());
  
  client.end();
}).catch(console.error);
