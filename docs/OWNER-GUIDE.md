# Your Stash workspace

**Status:** implementation and local tests are complete enough for backend integration. The production backend and deployment are not connected yet. The URLs below describe the intended deployed system, not a verified live dashboard.

Portfolio: https://chrisde7.github.io/The-stash/

Dashboard after deployment: https://chrisde7.github.io/The-stash/#/admin

## Add a plugin

1. Sign in with your owner email and password. Choose **Add plugin** on Overview.
2. Enter its title. A short description helps visitors understand it; other fields are optional.
3. Drop images or videos into **Images and videos**, or choose files. Each file has its own progress indicator. A failed upload has **Retry**; the text you entered stays in place.
4. Choose a cover. Drag gallery items using their handle, or use the up/down buttons. Add captions and alt text. **Thumbnail focal point** adjusts cropping on cards without changing the original artwork.
5. Click **Preview**. When satisfied, click **Publish**.

**Save Draft** saves privately. On an existing published entry, visitors continue seeing its previous published version. **Save and Publish Changes** replaces that version. **Unpublish** hides it. Deleting an entry asks for confirmation and keeps its files in Media.

Use the same steps for projects. Search the Projects or Plugins list to find an entry later.

## Images, video and links

- Images: JPEG, PNG or WebP, maximum 12 MiB each. The original is retained; smaller WebP previews are generated in your browser without increasing dimensions.
- Video: MP4 or WebM, maximum 40 MiB each. MP4 with H.264 video and AAC audio offers broad compatibility; WebM with VP8/VP9 and Opus is another option. A preview poster is captured by your browser and can be replaced. This is **not** video transcoding. If the browser cannot decode your video, convert it using your preferred video editor or use a video link.
- **Add video link** accepts individual HTTPS YouTube or Vimeo links. You can edit the URL and title or move/remove it like any gallery item. Players load only when clicked. A provider link remains available if embedding is restricted. A private portfolio draft does not change a linked video's privacy on its provider.
- In **Links**, add a button label and URL. Use the arrow buttons to change their order. Blank rows are omitted when saving an entry. No checkout or payment integration exists.
- **Remove from this entry** detaches a file; it does not delete the original. **Permanently delete** in Media is different: it removes the stored file. Saved draft or published references prevent deletion.

Keep the tab open until uploads and saving finish. Sessions are held in memory, so reloading or closing the tab requires signing in again. Never share your password or backend secret keys.

## Site settings

Change intro/about/contact text, contact buttons, Discord username, site title and description in **Site Settings**. Choose and reorder featured entries there. The layout stays controlled by the design. Empty featured sections are omitted. **Categories** lets you rename, reorder and remove labels; saving updates those labels on existing draft and published entries.

## When do changes appear?

Content comes directly from the backend. New page loads fetch current published content; an already open public page refreshes every 30 seconds and on window focus. Unpublishing denies new public media requests immediately at the access service. Public media responses use `Cache-Control: no-store`. A file already downloaded, buffered or captured cannot be recalled. Previously loaded content may remain visible until the next refresh.

If the backend is unavailable, the public site shows a retry message and keeps the contact area available. It does not expose drafts or pretend an update succeeded.

## Backup and rollback

1. Open **Site Settings → Export content backup**. Store the downloaded backup privately.
2. In **Media**, download originals. The content export records IDs and paths; it does not contain the media bytes. Keep the original files as well as the export.
3. For a full disaster recovery backup, a maintainer should export the Supabase database and private storage bucket together. Database backups alone do not restore Storage file bytes. A maintainer can restore the matching database and bucket paths to recover draft/published versions and references. Do not import private backups into this public GitHub repository.

The original website is preserved at Git tag `rollback-before-redesign-20260922` (original commit `db99096`) and in the separate local Git bundle `The-stash-before-redesign.bundle`. Before the first deployment, push that tag to GitHub. To restore the old website, a maintainer can create a branch from this tag and deploy its original static files through GitHub Pages, or restore the former branch-based Pages source. This rolls back the frontend only; it does not erase the backend or uploaded originals.

## Service limits checked September 2026

Supabase's current Free plan lists 500 MB database storage, 1 GB file storage, 5 GB egress, 5 GB cached egress and 500,000 Edge Function invocations. Free projects may pause after one week of inactivity; automatic database backups are not included. Image transformations are not included, so this app generates its previews in the browser. Its own 12/40 MiB limits are below the Free plan's 50 MB per-file maximum. Derivatives also use storage. Public media uses an access-checking proxy rather than a public CDN bucket; video range requests and image loads consume function invocations and transfer allowance. Prefer video links for large or heavily watched videos.

Pro currently starts at US$25/month; usage or additional services can add charges. No paid plan or billing has been enabled by this task. Plans and limits can change; this is not a promise of permanent free hosting.

Sources: [Supabase pricing](https://supabase.com/pricing), [file limits](https://supabase.com/docs/guides/storage/uploads/file-limits), [Edge Function limits](https://supabase.com/docs/guides/functions/limits).
