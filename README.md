# Chris Portfolio

A complete editable portfolio website using only HTML, CSS, and JavaScript.

## Files

- `index.html` - Main page markup and inline SVG logo/favicon setup.
- `styles.css` - Dark tech styling, responsive layout, glass cards, and animations.
- `app.js` - Rendering, filters, modals, local editor, localStorage, import/export, and copy JSON.
- `data.js` - Editable profile, projects, maps, skills, and `ENABLE_LOCAL_ADMIN`.

## Edit Content

Open `data.js` and edit:

- `profile`
- `projects`
- `maps`
- `skills`

## Add Images

Put your images beside the site files or inside an `images` folder, then set `previewImage` in `data.js`.

Example:

```js
previewImage: "images/my-project.png",
previewGradient: ""
```

Use square-ish or wide images for best results. The cards use `object-fit: cover`, so images stay neat instead of stretching weirdly.

The site includes exactly two starter examples:

- First Website
- Game Server Map

## Local Editor

The local editor is disabled by default:

```js
const ENABLE_LOCAL_ADMIN = false;
```

To edit locally, set it to `true`, open:

```text
index.html#admin
```

You can add, edit, delete, save, export JSON, import JSON, copy JSON, and reset demo data.

This editor is for local/offline use only. Do not enable it on the public live website.

Before uploading live, set:

```js
const ENABLE_LOCAL_ADMIN = false;
```

## Run Locally

You can open `index.html` directly in a browser.

For local hosting, run this inside the folder:

```text
python -m http.server 8080
```

Then open:

```text
http://localhost:8080
```

## Future Security

Static HTML is not real security. The code includes comments showing where Google Auth, a backend API, and database saving could be added later.

