# Your owner workspace: login and adding images

## Log in later

1. Open [your owner workspace](https://chrisde7.github.io/The-stash/#/admin).
2. Bookmark that exact address, including `#/admin`. The public navigation intentionally has no owner link.
3. Enter **chrisdesigningenterprises@gmail.com** and your existing portfolio owner password.
4. Click **Sign in**. You should see **Welcome back, Chris.** and **Owner access**.
5. Choose **Unturned Maps**, **Unturned Plugins**, **Media**, **Categories**, or **Site Settings** in the sidebar.

Use the portfolio account password you already created. Your password is not saved in this README or the repository. The Supabase dashboard login and database password are separate credentials.

## Add your images whenever you are ready

1. Open **Unturned Maps → Add map**, **Unturned Plugins → Add plugin**, or **Edit** an existing draft.
2. Fill in the title, summary and description. You can save these now and add images later.
3. Upload screenshots in the editor, or upload them under **Media** and use **Choose from library** in the editor.
4. Add image descriptions and captions. Choose a cover and use the gallery ordering controls.
5. Click **Save Draft**. Drafts and their images remain private.
6. Use **Preview** to check the entry.
7. Click **Publish** when ready. For an existing published entry, use **Save and Publish Changes**.
8. Open [the public portfolio](https://chrisde7.github.io/The-stash/) to check it. Existing visitor pages refresh content about every 30 seconds.

Images: JPEG, PNG or WebP, up to **12 MB each**. Videos: MP4 or WebM, up to **40 MB each**. Use a YouTube/Vimeo link for larger videos. The editor creates image previews automatically.

**Save Draft does not update an already published page.** **Unpublish** hides the page and blocks new requests for media no longer used by other published entries. Uploading to Media alone does not publish a file.

## Everyday settings and backups

- **Site Settings** edits the introduction, about text, contact links and search description. Saving makes those settings public immediately.
- **Featured work** moves chosen entries to the front of their respective homepage collections.
- **Categories** manages your labels; renaming a category does not hide a map.
- **Export content backup** saves text/settings/entry data. Also download original files from **Media** for a complete backup.
- **Sign out** when finished. Reloading or closing the page ends the in-memory session; sign in again when prompted.
- Forgotten password: open your project in Supabase, go to **Authentication → Users**, and use the supported account recovery/admin flow for your existing user. Retain the same user UUID so owner permission remains attached. There is no self-service reset form on this site.

## Setup record and maintenance reference

This guide connects The Stash to your own Supabase project so you can sign in, add Unturned maps and plugins, upload media, and publish content.

**Backend verified September 24, 2026:** your owner account is authorized, both media functions are deployed, private storage is protected, and the live upload/draft/publish/unpublish workflow passes. The remaining sections document the setup for maintenance; do not repeat account creation or migrations for this existing project. See [verification record](docs/TEST-REPORT.md) for deployment status.

## What you need

- Your Supabase account and access to the GitHub repository `ChrisDE7/The-stash`.
- Node.js 22 or newer and a PowerShell terminal.
- An email and password for your portfolio owner account. This is a separate login from your Supabase dashboard account.

Keep passwords, database credentials, Supabase access tokens, and secret/service-role keys out of this repository and out of chat.

## 1. Create the Supabase project

1. Open [Supabase Dashboard](https://supabase.com/dashboard).
2. Create a project, or select the project you want to use for this portfolio. A new, dedicated project is easiest for first-time setup.
3. Choose your plan and region, create a database password, and save that password in your password manager.
4. Wait for the project to finish provisioning.
5. Record its **project reference**, **project URL**, and **publishable API key**. The project reference is the identifier in the dashboard URL. The URL looks like `https://YOUR_PROJECT_REF.supabase.co`.

The publishable key is intended for browser apps. Never substitute a secret key or `service_role` key. See [Supabase API keys](https://supabase.com/docs/guides/getting-started/api-keys).

## 2. Create the database and private media bucket

In your selected project's **SQL Editor**, run the full contents of these files **one at a time, in this order**:

1. [202609220001_portfolio.sql](supabase/migrations/202609220001_portfolio.sql)
2. [202609220002_preserve_starter_drafts.sql](supabase/migrations/202609220002_preserve_starter_drafts.sql)
3. [202609230001_categories.sql](supabase/migrations/202609230001_categories.sql)

Wait for success after each file. These create the content tables, permission rules, private `portfolio` storage bucket, and starter drafts. The starter drafts are not published.

**Run each migration only once.** If you already applied them, do not rerun them. If a query fails, stop and resolve that error before continuing; do not delete tables to get past it. This guide uses the SQL Editor for migrations—do not also run `supabase db push` against the same setup without reconciling migration history.

## 3. Create your owner login

1. In **Authentication → Users**, use the dashboard's option to add/create a user.
2. Enter the email and password you want to use for the portfolio workspace. Confirm the email through the dashboard's supported confirmation flow; for your own manually created account, use its auto-confirm option if offered.
3. Open that user's record and copy its **User UID/UUID**. Confirm that the email belongs to you.
4. In **SQL Editor**, replace the placeholder below with that UUID, then run:

```sql
insert into private.owners (user_id)
values ('REPLACE_WITH_YOUR_AUTH_USER_UUID'::uuid)
on conflict (user_id) do nothing;
```

5. Verify which accounts have owner access:

```sql
select u.id, u.email
from private.owners o
join auth.users u on u.id = o.user_id;
```

For a workspace only you control, this result should contain only your intended account. Do not add other UUIDs. If an unexpected account appears, resolve that before connecting the site.

The app checks `is_owner()` after sign-in, and database rules also enforce access. Knowing the admin URL does not grant access. The sign-in page itself is publicly reachable; the private dashboard and drafts require your authorized account.

## 4. Configure authentication

In the hosted project's Authentication settings:

- Keep email/password sign-in enabled.
- Turn off **Allow new users to sign up**.
- Turn off anonymous sign-ins.
- Set **Site URL** to `https://chrisde7.github.io/The-stash/`.

Dashboard labels can change. The local `supabase/config.toml` documents the intended settings, but running the SQL does not apply those hosted Authentication settings.

## 5. Deploy the two media functions

Open PowerShell and run commands from the project folder:

```powershell
Set-Location 'C:\Users\User\Documents\ChatGPT\THAT UNTURNED PORTFOLIO\portfolio'
npx supabase login
```

Complete Supabase's login flow. Then replace `YOUR_PROJECT_REF` below with your actual project reference:

```powershell
npx supabase functions deploy media --project-ref YOUR_PROJECT_REF
npx supabase functions deploy upload --project-ref YOUR_PROJECT_REF
```

Check that both functions appear in your project's **Edge Functions** section. Run the commands from the folder above so the CLI reads the included configuration.

This project's functions intentionally use `verify_jwt = false` in `supabase/config.toml`: `media` checks whether each requested file is published; `upload` validates the signed-in user and checks owner access itself. Do not make the storage bucket public. Hosted Supabase supplies the server-side environment used by these functions; do not copy its privileged credentials into the website.

Reference: [Deploy Edge Functions](https://supabase.com/docs/guides/functions/deploy).

## 6. Connect the local website

In the `portfolio` folder, create a file named **`.env.local`**. Ensure Windows does not save it as `.env.local.txt`.

```dotenv
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
```

Use the actual URL and publishable key from the same project. This file is ignored by Git. It must never contain your owner password or a privileged key.

In PowerShell:

```powershell
npm ci
npm run dev
```

If the preview server is already running, stop it with Ctrl+C and restart it after changing `.env.local`.

Open the address printed by Vite, then add `#/admin`. Usually:

[Local owner workspace](http://127.0.0.1:5173/The-stash/#/admin)

If Vite chooses another port, use that port. Sign in with the owner email/password from step 3. The “One connection left to make” screen should be replaced by sign-in and then your workspace.

## 7. Set up your content

Start with **Site Settings**. The database seeds older copy, which overrides the local preview defaults when connected. Update it to match your portfolio:

- Intro: `Unturned maps & plugins by Chris.`
- About: `I create Unturned maps and plugins — places to explore and tools that bring servers to life.`
- Check your email link, GitHub link, and Discord username.
- In **Categories**, use `Unturned Maps` and `Unturned Plugins`. Review the starter drafts before publishing anything.

Your workspace sections:

| Section | What to do there |
| --- | --- |
| Overview | Start a map/plugin and find recently edited work. |
| Unturned Maps | Create, edit, preview, publish, or unpublish maps. |
| Unturned Plugins | Manage plugin descriptions, features, media, and links. |
| Media | Upload and manage images/videos; files remain private until referenced by published content. |
| Categories | Manage the category labels used by entries. |
| Site Settings | Edit the public introduction, contact details, and export a content backup. |

To add your first entry:

1. Choose **Add map** or **Add plugin**. New entries receive the matching category automatically.
2. Enter a title, short summary, and description.
3. Upload screenshots/video and choose a cover. Add captions and image descriptions, then arrange your gallery.
4. For plugins, add features, version/compatibility information, and relevant download/documentation links.
5. **Save Draft** to keep it private, then use **Preview**.
6. **Publish** only when ready. For an already published entry, saving a draft keeps the old public version; **Save and Publish Changes** releases your revision.

The homepage shows the two map/plugin collections. Featured entries appear first within their matching collection, in the order you choose.

More editing and backup details: [Owner guide](docs/OWNER-GUIDE.md).

## 8. Verify before putting it online

Use a temporary test entry with non-sensitive media:

- Sign in, save a draft, and confirm a signed-out browser cannot see it.
- Verify direct anonymous/non-owner requests cannot read drafts or private Storage files; merely hiding cards is not enough.
- Publish the entry and check it in a signed-out browser.
- Update its draft and confirm the public version stays unchanged until publishing again.
- Test uploads, gallery order, cover selection, and video playback.
- Unpublish it and confirm it disappears after refresh; new requests to its media URL should be denied.
- Sign out and verify the dashboard no longer shows private content.

Run the local checks:

```powershell
npm run check
npm test
npm run build
```

The full real-service release checks are in [Setup and security](docs/SETUP-AND-SECURITY.md). Local tests alone do not verify your hosted permissions.

## 9. Publish the connected website

This step is separate from making the local workspace work.

1. Ensure the reviewed website changes and `.github/workflows/pages.yml` are in the GitHub repository. The contents of this local `portfolio` folder belong at the repository root.
2. Preserve the existing rollback tag before replacing the live website; see the owner guide.
3. In repository **Settings → Secrets and variables → Actions → Variables**, add repository variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`
4. Check the existing Pages configuration, then set **Settings → Pages → Source** to **GitHub Actions** for the new workflow.
5. After real-service verification, open **Actions → Publish verified portfolio → Run workflow**, selecting the branch containing the reviewed changes. If the manual workflow is not listed, ensure its file is on the repository's default branch.
6. Wait for both build and deploy to succeed. The workflow checks the backend and refuses missing configuration.
7. Verify the public website and bookmark your owner address:

[Owner workspace after deployment](https://chrisde7.github.io/The-stash/#/admin)

There is no owner-sign-in link in the public navigation/footer. Bookmarking this URL is the intended way to return. It is not a secret URL: account authorization protects the content.

After deployment, normal content edits happen inside the owner workspace without another code deployment. An already open public page refreshes content about every 30 seconds.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| “One connection left to make” | `.env.local` is in `portfolio`, both values are filled in, and Vite was restarted. On the live site, set repository variables and rebuild. |
| Sign-in fails | Use the portfolio Auth user's password, not the database password or Supabase dashboard password. Confirm the Auth user's email and project. |
| Account has no owner access | Verify the Auth UUID is in `private.owners`; matching an email string alone is insufficient. |
| Upload fails | Confirm `upload` was deployed to the same project, your session is signed in, and the file type/size is supported. Check function logs. |
| Published images fail | Confirm `media` was deployed and the entry was published. Keep Storage private. |
| Older website copy appears | Update Site Settings; connected database content overrides local defaults. |
| Changes are not public | Save Draft is private. Publish the changes, then refresh the public page. |
| Reload asks you to sign in again | Expected: owner sessions are held in memory, not browser storage. |
| Forgotten password | This build has no self-service password-reset screen. Recover/update your Auth account through Supabase's supported administration flow; retain its UUID. |

## Setup checklist

- [x] Project created and all three migrations applied once.
- [x] Your Auth user created, confirmed, and assigned owner access.
- [x] Owner authorization checked; public signups and anonymous sign-in disabled during initial setup.
- [x] Both Edge Functions deployed; Storage remains private.
- [x] `.env.local` configured and local owner login works.
- [x] Site copy/categories updated; starter drafts preserved privately for your review.
- [x] Real permission, upload, draft, publish, and unpublish checks completed.
- [x] GitHub variables configured and verified release deployed.
- [ ] Owner URL bookmarked and backup process understood.
