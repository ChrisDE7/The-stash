import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';

test('activity permits constrained anonymous events, deduplicates, and protects individual records', async () => {
 const db = new PGlite();
 try {
  await db.exec(`create role anon;create role authenticated;create schema private;
   create function public.is_owner() returns boolean language sql stable as $$select coalesce(current_setting('app.owner',true),'')='yes'$$;
   create table public.published_entries(id uuid primary key,content jsonb);`);
  await db.exec(await readFile(new URL('../supabase/migrations/202609240001_activity.sql',import.meta.url),'utf8'));
  const session='11111111-1111-4111-8111-111111111111', item='22222222-2222-4222-8222-222222222222';
  await db.query('insert into public.published_entries values($1,$2)',[item,{links:[{type:'Download',url:'https://example.com/file'}]}]);
  await db.exec('set role anon');
  const record=(event,target='')=>db.query('select public.record_activity($1,$2,$3)',[session,event,target]);
  await record('visit'); await record('visit'); await record('project',item); await record('download',item); await record('download',item);
  await record('download','not-published'); await record('visit','untrusted'); await record('invalid');
  const totals=(await db.query('select public.activity_totals() as value')).rows[0].value;
  assert.equal(totals.visits,1); assert.equal(totals.projectViews,1); assert.equal(totals.downloadClicks,1);
  await assert.rejects(db.query('select * from private.activity'));
  await assert.rejects(db.query('insert into private.activity(session_id,event,target) values($1,$2,$3)',[session,'visit','']));
  await assert.rejects(db.query('select public.owner_activity()'));
  await db.exec('reset role;set role authenticated');
  await assert.rejects(db.query('select public.owner_activity()'));
  await db.exec("reset role;select set_config('app.owner','yes',false);set role authenticated");
  await record('project',item);
  await db.query('select public.record_activity($1,$2,$3)',['44444444-4444-4444-8444-444444444444','visit','']);
  const report=(await db.query('select public.owner_activity() as value')).rows[0].value;
  assert.equal(report.totals.visits,1); assert.equal(report.days.length,1);
  await db.exec("reset role;select set_config('app.owner','',false);delete from public.published_entries;set role anon");
  await db.query('select public.record_activity($1,$2,$3)',['33333333-3333-4333-8333-333333333333','project',item]);
  assert.equal((await db.query('select public.activity_totals() as value')).rows[0].value.projectViews,1);
 } finally { await db.close(); }
});
