import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
test("Postgres policies and publication transitions deny anonymous and non-owner draft access", async () => {
  const db = new PGlite();
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
 create schema auth; create table auth.users(id uuid primary key);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;
 create schema storage; create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid,bucket_id text,name text);alter table storage.objects enable row level security;
 grant usage on schema storage to anon,authenticated;grant select,insert,update,delete on storage.objects to anon,authenticated;
 `);
  await db.exec(
    await readFile(
      new URL(
        "../supabase/migrations/202609220001_portfolio.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  await db.exec(
    await readFile(
      new URL(
        "../supabase/migrations/202609220002_preserve_starter_drafts.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  await db.exec(
    await readFile(
      new URL(
        "../supabase/migrations/202609230001_categories.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  const owner = "11111111-1111-4111-8111-111111111111",
    other = "22222222-2222-4222-8222-222222222222",
    id = "33333333-3333-4333-8333-333333333333",
    asset = "44444444-4444-4444-8444-444444444444";
  await db.exec(
    `insert into auth.users values('${owner}'),('${other}');insert into private.owners values('${owner}');insert into public.media values('${asset}','test.png','image/png',100,'{"original":"${asset}/original"}',now());insert into storage.objects values('${asset}','portfolio','${asset}/original');`,
  );
  const entry = {
    id,
    kind: "plugin",
    title: "Private test plugin",
    media: [{ id: "test-media", kind: "image", asset }],
    links: [],
  };
  const as = async (role, uid = "") => {
    await db.exec("reset role");
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
      uid,
    ]);
    await db.exec(`set role ${role}`);
  };
  await as("anon");
  assert.equal(
    (await db.query("select * from public.published_entries")).rows.length,
    0,
  );
  await assert.rejects(db.query("select * from public.entries"));
  assert.equal(
    (await db.query("select * from storage.objects")).rows.length,
    0,
  );
  await assert.rejects(db.query("select public.save_entry($1,false)", [entry]));
  await as("authenticated", other);
  assert.equal(
    (await db.query("select public.is_owner() as ok")).rows[0].ok,
    false,
  );
  assert.equal((await db.query("select * from public.entries")).rows.length, 0);
  assert.equal((await db.query("select * from public.media")).rows.length, 0);
  assert.equal(
    (await db.query("select * from storage.objects")).rows.length,
    0,
  );
  await assert.rejects(db.query("select public.save_entry($1,true)", [entry]));
  await assert.rejects(db.query("select public.unpublish_entry($1)", [id]));
  await assert.rejects(
    db
      .query("update public.site_settings set content='{}' returning *")
      .then((r) => {
        if (r.rows.length === 0) throw Error("denied");
      }),
  );
  await as("authenticated", owner);
  assert.equal(
    (await db.query("select public.is_owner() as ok")).rows[0].ok,
    true,
  );
  assert.equal(
    (await db.query("select * from storage.objects")).rows.length,
    1,
  );
  await assert.rejects(
    db.query("select public.save_entry($1,false)", [{ ...entry, title: null }]),
  );
  await assert.rejects(
    db.query("select public.save_entry($1,false)", [
      { ...entry, links: [{ label: "Bad", url: "javascript:alert(1)" }] },
    ]),
  );
  await db.query("select public.save_entry($1,false)", [entry]);
  await as("anon");
  assert.equal(
    (await db.query("select * from public.published_entries")).rows.length,
    0,
  );
  await as("authenticated", owner);
  await db.query("select public.save_entry($1,true)", [entry]);
  await db.query("select public.save_entry($1,false)", [
    { ...entry, title: "Unpublished edit" },
  ]);
  await as("anon");
  assert.equal(
    (await db.query("select content from public.published_entries")).rows[0]
      .content.title,
    "Private test plugin",
  );
  assert.equal(
    (await db.query("select * from storage.objects")).rows.length,
    0,
  );
  await as("authenticated", owner);
  await assert.rejects(db.query("select public.delete_media($1)", [asset]));
  await db.query("select public.unpublish_entry($1)", [id]);
  await as("anon");
  assert.equal(
    (await db.query("select * from public.published_entries")).rows.length,
    0,
  );
  await as("authenticated", owner);
  await assert.rejects(db.query("select public.delete_media($1)", [asset]));
  await db.query("select public.delete_entry($1)", [id]);
  await db.query("select public.delete_media($1)", [asset]);
  await db.exec("reset role");
  assert.equal(
    (await db.query("select * from public.published_media")).rows.length,
    0,
  );
  await db.close();
});
