// TEST ONLY. Loopback HTTP adapter around the real PostgreSQL migration.
// This is not Supabase Auth/Storage/Edge Functions and cannot certify those services.
import http from "node:http";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { sniff, limits } from "../src/validation.js";
const db = new PGlite(),
  files = new Map(),
  failures = new Set();
await db.exec(
  `create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;create schema storage;create table storage.buckets(id text,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid,bucket_id text,name text);alter table storage.objects enable row level security;`,
);
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
await db.exec(await readFile(new URL('../supabase/migrations/202609240001_activity.sql', import.meta.url), 'utf8'));
const owner = "11111111-1111-4111-8111-111111111111",
  other = "22222222-2222-4222-8222-222222222222";
await db.exec(
  `insert into auth.users values('${owner}'),('${other}');insert into private.owners values('${owner}');`,
);
const jwt = (uid) =>
  [
    Buffer.from('{"alg":"HS256"}').toString("base64url"),
    Buffer.from(
      JSON.stringify({
        sub: uid,
        role: "authenticated",
        exp: Math.floor(Date.now() / 1000) + 3600,
      }),
    ).toString("base64url"),
    "test-only",
  ].join(".");
const token = jwt(owner),
  otherToken = jwt(other);
let queue = Promise.resolve();
const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization,apikey,content-type,x-client-info,prefer,range,x-supabase-api-version,content-profile,accept-profile",
  "Access-Control-Allow-Methods": "GET,POST,DELETE,OPTIONS,PATCH",
  "Cache-Control": "no-store",
};
const server = http.createServer((req, res) => {
  if (req.method === "OPTIONS") {
    res.writeHead(204, headers);
    res.end();
    return;
  }
  queue = queue
    .then(() => handle(req, res))
    .catch((e) => {
      res.writeHead(500, headers);
      res.end(JSON.stringify({ message: e.message }));
    });
});
async function handle(req, res) {
  const u = new URL(req.url, "http://127.0.0.1:54331"),
    authorized = req.headers.authorization === `Bearer ${token}`,
    loggedIn =
      authorized || req.headers.authorization === `Bearer ${otherToken}`;
  const send = (data, status = 200, type = "application/json") => {
    res.writeHead(status, { ...headers, "Content-Type": type });
    res.end(type === "application/json" ? JSON.stringify(data) : data);
  };
  const chunks = [];
  for await (const b of req) chunks.push(b);
  const buffer = Buffer.concat(chunks);
  let body = {};
  if (
    req.headers["content-type"]?.includes("application/json") &&
    buffer.length
  )
    body = JSON.parse(buffer.toString());
  try {
    await db.exec("reset role");
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
      authorized ? owner : loggedIn ? other : "",
    ]);
    if (u.pathname === "/auth/v1/token") {
      const uid =
        body.email === "owner@test.invalid" &&
        body.password === "test-only-password"
          ? owner
          : body.email === "other@test.invalid" &&
              body.password === "test-only-password"
            ? other
            : null;
      if (!uid)
        return send(
          { error: "invalid_grant", error_description: "Invalid credentials" },
          400,
        );
      return send({
        access_token: uid === owner ? token : otherToken,
        refresh_token: "test-only-refresh",
        token_type: "bearer",
        expires_in: 3600,
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        user: {
          id: uid,
          aud: "authenticated",
          role: "authenticated",
          email: body.email,
          app_metadata: { provider: "email" },
          user_metadata: {},
          created_at: new Date().toISOString(),
        },
      });
    }
    if (u.pathname === "/auth/v1/logout") return send({});
    if (u.pathname === "/auth/v1/user")
      return loggedIn
        ? send({ id: authorized ? owner : other, email: "owner@test.invalid" })
        : send({ message: "Unauthorized" }, 401);
    if (u.pathname.startsWith("/rest/v1/rpc/")) {
      const name = u.pathname.split("/").pop();
      const funcs = {
        is_owner: [],
        activity_totals: [],
        owner_activity: [],
        record_activity: ['session_id', 'event', 'target'],
        save_categories: ["categories"],
        save_entry: ["entry", "publish_now"],
        unpublish_entry: ["entry_id"],
        delete_entry: ["entry_id"],
        delete_media: ["asset_id"],
      };
      if (!Object.hasOwn(funcs, name)) return send({}, 404);
      await db.exec("set role " + (loggedIn ? "authenticated" : "anon"));
      const args = funcs[name];
      const result = await db.query(
        `select public.${name}(${args.map((_, i) => "$" + (i + 1)).join(",")}) as result`,
        args.map((k) => body[k]),
      );
      return send(result.rows[0].result);
    }
    if (u.pathname.startsWith("/rest/v1/")) {
      const table = u.pathname.split("/").pop();
      if (
        !["entries", "published_entries", "site_settings", "media"].includes(
          table,
        )
      )
        return send({}, 404);
      await db.exec("set role " + (loggedIn ? "authenticated" : "anon"));
      if (req.method === "POST" && table === "site_settings") {
        await db.query(
          "insert into public.site_settings values(1,$1) on conflict(id) do update set content=excluded.content",
          [body.content],
        );
        return send(null);
      }
      if (req.method !== "GET") return send({}, 403);
      const order = ["entries", "published_entries"].includes(table)
        ? " order by updated_at desc"
        : table === "media"
          ? " order by created_at desc"
          : "";
      let result = (await db.query(`select * from public.${table}${order}`))
        .rows;
      return send(
        table === "site_settings" &&
          req.headers.accept?.includes("vnd.pgrst.object")
          ? result[0]
          : result,
      );
    }
    if (u.pathname === "/functions/v1/upload") {
      if (!authorized) return send({ error: "Owner access required" }, 403);
      if (req.method === "DELETE") {
        await db.exec("set role authenticated");
        const { rows } = await db.query(
          "select public.delete_media($1) as paths",
          [u.searchParams.get("id")],
        );
        for (const p of Object.values(rows[0].paths || {})) files.delete(p);
        return send({ ok: true });
      }
      const form = await new Response(buffer, {
          headers: { "content-type": req.headers["content-type"] },
        }).formData(),
        file = form.get("file");
      if (file.name === "fail-once.png" && !failures.has(file.name)) {
        failures.add(file.name);
        return send(
          {
            error:
              "Test connection failure. Your text is preserved. Retry this upload.",
          },
          503,
        );
      }
      const mime = sniff(
        new Uint8Array(await file.slice(0, 256).arrayBuffer()),
      );
      if (
        !mime ||
        file.type !== mime ||
        file.size > (mime.startsWith("image") ? limits.image : limits.video)
      )
        return send({ error: "Unsupported format or file too large" }, 400);
      const id = crypto.randomUUID(),
        variants = {};
      for (const v of ["original", "display", "thumb"]) {
        const part = v === "original" ? file : form.get(v);
        if (part) {
          const p = id + "/" + v;
          files.set(p, {
            data: Buffer.from(await part.arrayBuffer()),
            type: part.type,
          });
          variants[v] = p;
        }
      }
      const { rows } = await db.query(
        "insert into public.media(id,name,mime,size,variants) values($1,$2,$3,$4,$5) returning *",
        [id, file.name, mime, file.size, variants],
      );
      return send(rows[0]);
    }
    if (u.pathname.startsWith("/storage/v1/object/")) {
      if (!authorized) return send({ error: "Denied" }, 403);
      const p = u.pathname.split("/portfolio/")[1];
      const f = files.get(decodeURIComponent(p));
      return f ? send(f.data, 200, f.type) : send({}, 404);
    }
    if (u.pathname === "/functions/v1/media") {
      const id = u.searchParams.get("id");
      const allowed = await db.query(
        "select * from public.published_media where media_id=$1",
        [id],
      );
      if (!allowed.rows.length) return send({}, 404);
      const asset = (
        await db.query("select * from public.media where id=$1", [id])
      ).rows[0];
      const f = files.get(
        asset.variants[u.searchParams.get("variant")] ||
          asset.variants.original,
      );
      return f ? send(f.data, 200, f.type) : send({}, 404);
    }
    return send({}, 404);
  } catch (e) {
    return send({ message: e.message, error: e.message }, 403);
  } finally {
    await db.exec("reset role");
  }
}
server.listen(54331, "127.0.0.1", () =>
  console.log(
    "TEST ONLY API on 127.0.0.1:54331; all data is disposable and in memory.",
  ),
);
