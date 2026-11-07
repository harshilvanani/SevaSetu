#!/usr/bin/env node
// Apply migrations / run SQL against a hosted Supabase project through the Management API.
// Usage:
//   SUPABASE_PROJECT_REF=xxxx SUPABASE_ACCESS_TOKEN=sbp_... node scripts/db.mjs migrate
//   node scripts/db.mjs sql "select 1"
//   node scripts/db.mjs file supabase/seed.sql
//   node scripts/db.mjs test            # runs supabase/tests/*.sql, each inside a rolled-back transaction
// Migrations are recorded in supabase_migrations.schema_migrations (same table the Supabase CLI uses).
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const ref = process.env.SUPABASE_PROJECT_REF;
const token = process.env.SUPABASE_ACCESS_TOKEN;
if (!ref || !token) {
  console.error('Set SUPABASE_PROJECT_REF and SUPABASE_ACCESS_TOKEN');
  process.exit(1);
}

async function query(sql) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${res.status}: ${text}`);
  return text ? JSON.parse(text) : [];
}

const lit = (s) => `'${s.replaceAll("'", "''")}'`;

async function migrate() {
  await query(`create schema if not exists supabase_migrations;
    create table if not exists supabase_migrations.schema_migrations (
      version text primary key, statements text[], name text);`);
  const applied = new Set((await query('select version from supabase_migrations.schema_migrations')).map((r) => r.version));
  const dir = 'supabase/migrations';
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
    const [version, ...rest] = file.replace('.sql', '').split('_');
    if (applied.has(version)) continue;
    const sql = readFileSync(join(dir, file), 'utf8');
    process.stdout.write(`applying ${file} ... `);
    await query(`begin;\n${sql}\n;insert into supabase_migrations.schema_migrations (version, name, statements)
      values (${lit(version)}, ${lit(rest.join('_'))}, array[${lit(sql)}]);\ncommit;`);
    console.log('ok');
  }
  console.log('migrations up to date');
}

async function test() {
  const dir = 'supabase/tests';
  let failed = 0;
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
    const body = readFileSync(join(dir, file), 'utf8').replace(/^\s*(begin|rollback);\s*$/gim, '');
    // Collect TAP output into a temp table, then abort with it as the error message:
    // the exception guarantees everything the test did is rolled back.
    const sql = `begin;
      create extension if not exists pgtap with schema extensions;
      set local search_path = public, extensions;
      create temp table _tap(n serial, line text) on commit drop;
      grant all on _tap to public; grant all on sequence _tap_n_seq to public;
      ${body.replace(/select\s+(plan|ok|is|isnt|throws_ok|lives_ok|throws_like|results_eq|finish|is_empty|cmp_ok|pass|fail)\s*\(/gi, (m) => `insert into _tap(line) ${m}`)}
      reset role;
      do $tap$ begin raise exception 'TAP_RESULT:%', (select string_agg(line, E'\\n' order by n) from _tap); end $tap$;`;
    try {
      await query(sql);
      console.log(`# ${file}\nnot ok - test did not report results`);
      failed++;
    } catch (e) {
      const m = e.message.match(/TAP_RESULT:([\s\S]*?)(?:"\s*}|$)/);
      if (!m) {
        console.log(`# ${file}\nnot ok - error: ${e.message}`);
        failed++;
        continue;
      }
      const lines = JSON.parse(`"${m[1]}"`).split('\n');
      console.log(`# ${file}\n${lines.join('\n')}`);
      failed += lines.filter((l) => l.startsWith('not ok')).length;
    }
  }
  if (failed) {
    console.error(`\n${failed} failing`);
    process.exit(1);
  }
  console.log('\nall tests passed');
}

const [cmd, arg] = process.argv.slice(2);
try {
  if (cmd === 'migrate') await migrate();
  else if (cmd === 'sql') console.log(JSON.stringify(await query(arg), null, 2));
  else if (cmd === 'file') console.log(JSON.stringify(await query(readFileSync(arg, 'utf8')), null, 2));
  else if (cmd === 'test') await test();
  else console.error('commands: migrate | sql "<sql>" | file <path> | test');
} catch (e) {
  console.error(e.message);
  process.exit(1);
}
