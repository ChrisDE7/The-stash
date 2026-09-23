# Verification record — September 23, 2026

**Release status: not deployed. Real Supabase integration and GitHub authentication remain required.**

## Passed locally

- TypeScript check, Vite production build, `git diff --check`, production dependency audit (zero reported vulnerabilities), and Deno type checking of both Edge Functions.
- Five Node test groups cover URL/provider validation, file signatures, stable mixed-media ordering, and real PostgreSQL RLS/function behavior through PGlite. Database checks include anonymous/non-owner draft denial, owner-only changes, draft-vs-published isolation, unpublish, referenced-file deletion protection, and invalid title/link rejection.
- Browser inspection of the original live site and new desktop design. New public phone (390px), tablet (768px) and desktop views were exercised without observed horizontal overflow. Mobile menu, Plugins route and refreshed hash detail route worked.
- The dashboard was exercised through the real Supabase client library against a **disposable loopback API fixture backed by the migration SQL**. This adapter simulates Auth/Storage HTTP and is not a hosted Supabase verification.
- Local fixture owner sign-in, non-owner rejection, logout, entry editor and private preview.
- Two image uploads, immediate previews/progress, an intentionally injected failed upload, and Retry preserving title/description.
- MP4 and WebM fixture uploads, original retention and automatic WebP poster previews. The MP4 preview decoded at 960×540, with native controls, no playback error and `autoplay=false`.
- Mixed uploaded-image/video-link ordering through accessible move buttons, image cover selection, captions/alt text, adding a video URL and a source link.
- Private draft save, publish, public entry in a separate signed-out tab, unpublished draft revisions retaining the previous public version, and Save and Publish Changes releasing the revision.
- Lightbox next/previous, Escape, focus restoration to the originating image, and no external video iframe before a click. A nested-dialog Escape bug was found and fixed.
- Unpublish removed the entry from the signed-out view; a direct request to the previously accessible local public media URL then returned HTTP 404.
- Delete confirmation, entry deletion, category rename propagation to existing entries, and logout.

Test images were artificial color blocks. Video fixtures were MDN's CC0 flower clips, downloaded only into ignored `test-results/fixtures`; they are not portfolio content and are not shipped. Temporary entries were deleted, and stopping the in-memory test service discards remaining fixture assets and category changes.

## Still required against the real project

The hosted Auth configuration, Storage policies, function deployment, production byte-range streaming, direct anonymous/non-owner requests, all owner upload and editing actions, and live Pages deployment must be verified after the owner supplies access. Do not present this report as a production security certification.

Additional browser checks to complete during real integration include pointer drag-and-drop/reordering (the accessible buttons were exercised locally), file replacement and shared-asset permanent-deletion errors, oversized-file error UI, provider-restricted embed fallback, category/featured/site-setting persistence, admin phone/tablet layouts, and production console/network checks.

## Reproduce automated checks

```text
npm ci
npm run check
npm test
npm run build
npm audit --omit=dev
npx deno check supabase/functions/upload/index.ts supabase/functions/media/index.ts
```

`tests/local-api.mjs` binds only `127.0.0.1:54331` and stores everything in memory. Its fake credentials are explicitly test-only. Never deploy that adapter or point a production build to it. The Pages workflow's backend verifier rejects localhost configuration.
