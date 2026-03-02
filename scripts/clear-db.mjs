import pg from 'pg';
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL || 'postgres://localhost:5432/ib4sales' });
await pool.query('TRUNCATE deals, clients, uploads RESTART IDENTITY CASCADE');
console.log('Данные очищены.');
await pool.end();
