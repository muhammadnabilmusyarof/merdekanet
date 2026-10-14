import pg from 'pg';
import { SUPABASE_SETUP_SQL } from './src/lib/constants.js';

const { Client } = pg;

async function runMigration() {
  const password = process.argv[2] || 'mLjA8ggZOlfwUUT5';
  const projectId = 'dbzouczghymsdsfkuvur';

  console.log('⏳ Menghubungkan langsung ke PostgreSQL Supabase (db.' + projectId + '.supabase.co:5432)...');

  const client = new Client({
    host: 'db.' + projectId + '.supabase.co',
    port: 5432,
    database: 'postgres',
    user: 'postgres',
    password: password,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    console.log('✅ Berhasil terhubung ke Supabase PostgreSQL!');
    console.log('🚀 Menjalankan migrasi pembuatan tabel & publikasi Realtime...');

    // Run the migration SQL
    await client.query(SUPABASE_SETUP_SQL);

    console.log('🎉 MIGRASI SUKSES 100%!');
    console.log('Tabel "tickets", "winners", dan publikasi "supabase_realtime" sudah aktif di Supabase!');
  } catch (err) {
    console.error('❌ Terjadi kesalahan saat migrasi:', err.message);
  } finally {
    await client.end();
  }
}

runMigration();
