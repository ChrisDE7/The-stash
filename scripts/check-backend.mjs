const url = process.env.VITE_SUPABASE_URL,
  key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
if (!url || !key)
  throw Error("Deployment blocked: connect and verify the real backend first.");
if (!/^https:\/\/[a-z0-9]+\.supabase\.co$/.test(url))
  throw Error("Invalid Supabase project URL");
if (key.startsWith("sb_secret_"))
  throw Error("Privileged keys must NEVER be used for the frontend");
if (key.split(".").length === 3) {
  const data = JSON.parse(Buffer.from(key.split(".")[1], "base64url"));
  if (data.role !== "anon")
    throw Error("Only publishable or legacy anon keys may be bundled");
}
const headers = { apikey: key };
const settings = await fetch(
  url + "/rest/v1/site_settings?id=eq.1&select=content",
  { headers },
);
if (!settings.ok || (await settings.json()).length !== 1)
  throw Error("Published site settings are unavailable");
for (const table of ["entries", "media"]) {
  const r = await fetch(url + "/rest/v1/" + table + "?select=*", { headers });
  if (r.ok && (await r.json()).length)
    throw Error("Draft data is anonymously exposed");
}
const media = await fetch(
  url + "/functions/v1/media?id=00000000-0000-4000-8000-000000000000",
);
if (media.status !== 404) throw Error("Media access gate is not ready");
console.log(
  "Basic deployment configuration and anonymous-access checks passed. Owner workflow verification must also be recorded before dispatching deployment.",
);
