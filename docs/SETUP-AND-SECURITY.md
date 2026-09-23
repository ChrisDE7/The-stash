# One-time connection and release checklist

This is maintainer setup. Normal content editing does not require code, GitHub commits, JSON editing or deployments.

## Access blockers at handoff

- `ChrisDE7/The-stash` was verified and cloned from GitHub. Local branch: `codex/portfolio-dashboard`.
- GitHub CLI's saved login is expired. The available computer-use connection exposes only Codex's browser, not the user's Brave session. No cookies or credentials have been extracted.
- No authenticated Supabase project or explicitly selected owner Auth user is available. Do not deploy this branch until connection and real service tests are complete.

## Provisioning

1. Owner signs into Supabase and creates/selects a project on the Free plan. Account agreements, a new database password and owner password are user actions. Do not enable paid billing without approval.
2. Apply the SQL migrations in `supabase/migrations` in filename order using the project's SQL editor or authenticated Supabase CLI. They create a private `portfolio` bucket, tables, RLS policies and narrowly scoped functions.
3. Create/confirm the owner's Auth user using the project dashboard. Insert **only its verified UUID** into `private.owners`. Never choose an owner based on a display name, browser-supplied metadata or the first person to register.
4. In hosted Auth settings, turn off new user signups and anonymous sign-ins. `supabase/config.toml` documents the intended settings but must not be assumed to configure hosted Auth merely by running a database migration. Set site URL to `https://chrisde7.github.io/The-stash/`. Email/password sign-in has no OAuth redirect dependency.
5. Deploy `media` and `upload` Edge Functions. `verify_jwt = false` on these routes is intentional: `media` checks published references for anonymous delivery; `upload` explicitly validates the bearer token with Auth and calls the checked `is_owner` function. The browser receives only the project URL and publishable/legacy anon key. Service-role keys stay in the Edge Function environment supplied by Supabase.
6. Configure GitHub repository variables `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`. These are public connection identifiers, not privileged secrets. Use ignored `.env.local` for equivalent local integration tests. Never prefix a secret/service-role key with `VITE_`.
7. Check the existing GitHub Pages source before changing it. Preserve the original tag remotely. Publish the built `dist` artifact using the included workflow, with Pages set to GitHub Actions. The workflow is manual dispatch, so merely pushing the branch does not release an unconnected replacement.

## Security model

- `private.owners` cannot be written/read by public API roles. `is_owner` uses the verified Auth subject, with a fixed empty search path and a locked-down function grant.
- `entries` holds private working drafts. `published_entries` holds separate released snapshots. Saving a draft never overwrites a released snapshot.
- `save_entry` checks the owner, validates entry and media references and publishes atomically with `published_media` references. Direct client mutations of those tables are revoked. Unpublish/delete functions separately check ownership.
- Storage bucket is private. Only the owner can directly download objects. No anonymous Storage policy grants access, even for published files. Uploads go through the owner-checked function, with MIME/signature and size checks and UUID paths. SVG/HTML uploads and arbitrary embed HTML are unsupported.
- Public `media` requests verify a published reference, fetch the private object using server credentials and stream only that response. Range headers are validated and forwarded. Unpublishing removes the reference; each new request fails closed. Storage credentials never appear in public responses. There are no public signed URLs with delayed expiry.
- Deleting a library asset checks both draft and released references under a database lock. Detaching it from one entry cannot delete shared files.
- Text is rendered through React escaping, never raw HTML. Buttons accept HTTPS/mailto links only. Video embeds are constructed from supported provider IDs. All public images are passive raster formats. Auth tokens remain in memory; no service-role keys, passwords or GitHub tokens are stored in browser persistence.
- A signed-in owner can intentionally publish files. This is an owner CMS, not a hostile multi-tenant upload service. File signature checks are not an antivirus service. Browser decoding validates images/video for ordinary uploads; the backend additionally checks signatures and MIME and never serves active HTML/SVG content.

## Required real-service checks before release

Use disposable test records and media, then remove them. Local fixture tests are NOT proof that hosted Supabase permissions and functions are correctly deployed.

- Owner login/logout; reject a real second Auth user; disable registration; deny raw anonymous and second-user draft queries, Storage downloads/list/upload/delete, privileged RPCs and Edge upload calls.
- Save a draft with media. Attempt its exact record ID, Storage path and public media proxy URL without credentials. All must deny private content.
- Multiple images, MP4 and WebM; progress, invalid signatures/oversize errors, retry, replacement, alt/caption, mixed drag/up/down order, posters and cover.
- Save draft, private preview, publish, update draft while keeping live snapshot unchanged, publish update, unpublish. Verify each in a separate signed-out tab and by direct requests.
- Verify video byte-range responses on the hosted Storage proxy, cached media headers, no external iframe until clicked, provider fallback, shared-file deletion guards and no uploaded originals lost during replacement.
- Category rename/reorder, featured order, contact changes, link validation, navigation, detail refresh and `/The-stash/` asset base path.
- Check phone/tablet/desktop views, keyboard/focus/Escape, reduced motion, broken images and console errors. Test backend failure states.
- Run `npm run check`, `npm test`, Deno check for both Edge Functions, `npm run build`, `npm audit --omit=dev`, then `node scripts/check-backend.mjs` with real public configuration. The last script provides basic release guards, not a complete security audit.
- Dispatch Pages workflow only after these pass; verify the actual live URL and dashboard against the real backend.

## Known operational boundaries

The application currently has simple retrying whole-file uploads, not resumable uploads. Uploads are capped at 40 MiB and processed serially per selected batch. Public media deliberately avoids long-lived caching for revocation; this trades CDN efficiency for immediate authorization checks. No automatic video transcoding is implemented.

Static GitHub Pages supplies the initial shared social metadata. Per-entry text is rendered client-side; a crawler that does not execute JavaScript sees the site-level title/description. No replacement artwork or fictional preview images were generated. A future pre-render service would be needed for guaranteed dynamic per-entry social cards.
