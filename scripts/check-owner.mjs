import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';

// Explicit opt-in: briefly publishes a generated test entry, then removes only
// this run's entry and asset. Never touches existing portfolio content.
if (process.env.VERIFY_OWNER_WORKFLOW !== 'yes') throw Error('Set VERIFY_OWNER_WORKFLOW=yes to run the live workflow check');
const url = process.env.VITE_SUPABASE_URL, key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const db = createClient(url, key, { auth: { persistSession: false } });
const anon = createClient(url, key, { auth: { persistSession: false } });
const checked = async p => { const r = await p; if (r.error) throw r.error; return r.data; };
const { session } = await checked(db.auth.signInWithPassword({ email: process.env.OWNER_EMAIL, password: process.env.OWNER_PASSWORD }));
assert.equal(await checked(db.rpc('is_owner')), true);
console.log('Owner sign-in and authorization passed');
const headers = { apikey: key, Authorization: `Bearer ${session.access_token}` };
const id = crypto.randomUUID();
let asset;
try {
  const form = new FormData();
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6AAAAAElFTkSuQmCC', 'base64');
  form.append('file', new Blob([png], { type: 'image/png' }), 'temporary-verification.png');
  const uploaded = await fetch(`${url}/functions/v1/upload`, { method: 'POST', headers, body: form });
  asset = await uploaded.json();
  assert.equal(uploaded.status, 200, JSON.stringify(asset));
  await checked(db.storage.from('portfolio').download(asset.variants.original));
  const mediaURL = `${url}/functions/v1/media?id=${asset.id}`;
  assert.equal((await fetch(mediaURL)).status, 404);
  const direct = await anon.storage.from('portfolio').download(asset.variants.original);
  assert.ok(direct.error, 'Anonymous storage download must fail');
  const entry = { id, kind: 'project', title: 'Temporary setup verification', summary: 'Automated setup check', description: '', features: [], tags: [], category: 'Unturned Maps', media: [{ id: 'image', asset: asset.id, kind: 'image', title: 'Test', alt: 'Test', caption: '', focalX: 50, focalY: 50 }], cover: 'image', links: [], version: '', compatibility: '', comingSoon: false };
  await checked(db.rpc('save_entry', { entry, publish_now: false }));
  assert.equal((await checked(anon.from('published_entries').select('id').eq('id', id))).length, 0);
  console.log('Upload, owner download, private draft and anonymous media denial passed');
  await checked(db.rpc('save_entry', { entry, publish_now: true }));
  const publicImage = await fetch(mediaURL);
  assert.equal(publicImage.status, 200);
  assert.equal(publicImage.headers.get('content-type'), 'image/png');
  assert.deepEqual(Buffer.from(await publicImage.arrayBuffer()), png);
  const range = await fetch(mediaURL, { headers: { Range: 'bytes=0-7' } });
  assert.equal(range.status, 206);
  assert.deepEqual(Buffer.from(await range.arrayBuffer()), png.subarray(0, 8));
  await checked(db.rpc('save_entry', { entry: { ...entry, title: 'Private revision' }, publish_now: false }));
  assert.equal((await checked(anon.from('published_entries').select('content').eq('id', id).single())).content.title, entry.title);
  const inUse = await fetch(`${url}/functions/v1/upload?id=${asset.id}`, { method: 'DELETE', headers });
  assert.equal(inUse.status, 409);
  await checked(db.rpc('unpublish_entry', { entry_id: id }));
  assert.equal((await fetch(mediaURL)).status, 404);
  assert.equal((await checked(anon.from('published_entries').select('id').eq('id', id))).length, 0);
  console.log('Publish, public media, draft isolation, in-use protection and unpublish passed');
} finally {
  await checked(db.rpc('delete_entry', { entry_id: id }));
  if (asset?.id) {
    const removed = await fetch(`${url}/functions/v1/upload?id=${asset.id}`, { method: 'DELETE', headers });
    assert.equal(removed.status, 200, await removed.text());
  }
  await db.auth.signOut();
  console.log('Temporary verification content removed; signed out');
}
