#!/usr/bin/env node
// Manual production database backup. Run from repo root: `npm run backup`.

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const BACKUP_DIR = path.join(REPO_ROOT, 'backups');
const ENV_BACKUP_FILE = path.join(REPO_ROOT, '.env.backup');
const PG_IMAGE = 'postgres:18-alpine';

function loadDatabaseUrl() {
  if (process.env.DATABASE_URL) {
    return { url: process.env.DATABASE_URL, source: 'process env' };
  }
  if (fs.existsSync(ENV_BACKUP_FILE)) {
    const text = fs.readFileSync(ENV_BACKUP_FILE, 'utf8');
    for (const rawLine of text.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;
      const eq = line.indexOf('=');
      if (eq < 0) continue;
      const key = line.slice(0, eq).trim();
      const value = line.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
      if (key === 'DATABASE_URL' && value) {
        return { url: value, source: '.env.backup' };
      }
    }
  }
  return null;
}

function timestamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
}

function summarizeUrl(url) {
  try {
    const u = new URL(url);
    return `${u.hostname}:${u.port || '5432'}${u.pathname}`;
  } catch {
    return '(unparseable URL)';
  }
}

function isLocalhost(url) {
  try {
    const u = new URL(url);
    return ['localhost', '127.0.0.1', '0.0.0.0'].includes(u.hostname);
  } catch {
    return false;
  }
}

function main() {
  const loaded = loadDatabaseUrl();
  if (!loaded) {
    console.error('No DATABASE_URL found.');
    console.error('');
    console.error('Either:');
    console.error('  1. Create .env.backup at repo root (copy .env.backup.example)');
    console.error('  2. Pass inline: DATABASE_URL="postgresql://..." npm run backup');
    process.exit(1);
  }

  const { url: dbUrl, source } = loaded;

  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }

  const filename = `cornhole-${timestamp()}.sql`;
  const filepath = path.join(BACKUP_DIR, filename);
  const relPath = path.relative(REPO_ROOT, filepath).replace(/\\/g, '/');

  console.log(`Backing up   ${summarizeUrl(dbUrl)}  (from ${source})`);
  console.log(`Writing to   ${relPath}`);
  console.log(`Using image  ${PG_IMAGE}`);
  if (isLocalhost(dbUrl)) {
    console.log('Note: target looks like localhost. Backing up your local Docker DB, not production.');
  }
  console.log('');

  const out = fs.createWriteStream(filepath);
  const proc = spawn(
    'docker',
    ['run', '--rm', PG_IMAGE, 'pg_dump', '--no-owner', '--no-acl', dbUrl],
    { stdio: ['ignore', 'pipe', 'pipe'] }
  );

  proc.stdout.pipe(out);

  let stderr = '';
  proc.stderr.on('data', (chunk) => { stderr += chunk.toString(); });

  proc.on('error', (err) => {
    out.destroy();
    try { fs.unlinkSync(filepath); } catch {}
    console.error('Failed to spawn docker:', err.message);
    console.error('Is Docker Desktop running?');
    process.exit(1);
  });

  proc.on('close', (code) => {
    out.end(() => {
      if (code !== 0) {
        console.error(`pg_dump failed (exit ${code}):`);
        if (stderr.trim()) console.error(stderr.trim());
        try { fs.unlinkSync(filepath); } catch {}
        process.exit(1);
      }

      const stats = fs.statSync(filepath);
      if (stats.size === 0) {
        console.error('pg_dump produced an empty file. Aborting.');
        try { fs.unlinkSync(filepath); } catch {}
        process.exit(1);
      }

      const head = fs.readFileSync(filepath, { encoding: 'utf8', flag: 'r' }).slice(0, 200);
      if (!head.includes('PostgreSQL database dump')) {
        console.error('Output does not look like a pg_dump file. Aborting.');
        try { fs.unlinkSync(filepath); } catch {}
        process.exit(1);
      }

      const kb = (stats.size / 1024).toFixed(1);
      console.log(`Done. ${kb} KB written.`);
      console.log('');
      console.log('To restore, pipe the file into psql against the target DB:');
      console.log(`  docker run --rm -i ${PG_IMAGE} psql "<DATABASE_URL>" < ${relPath}`);
    });
  });
}

main();
