import { useEffect, useRef, useState } from "react";
import {
  LayoutDashboard,
  Layers,
  Package,
  Image,
  Tags,
  Settings as SettingsIcon,
  Plus,
  LogOut,
  ArrowUpRight,
  Search,
  Download,
  Upload,
} from "lucide-react";
import {
  db,
  configured,
  defaults,
  query,
  saveEntry,
  setSettings,
  removeAsset,
  upload,
  privateMedia,
} from "./api";
import {
  Cover,
  AssetImage,
  Empty,
  Field,
  Modal,
  EntryDetail,
  LinksEditor,
} from "./ui";
import Editor, { blank } from "./editor";
import { move, safeUrl } from "./validation.js";
import type { Asset, Entry, Row, Settings } from "./types";
const sections = [
  ["Overview", LayoutDashboard],
  ["Projects", Layers],
  ["Plugins", Package],
  ["Media", Image],
  ["Categories", Tags],
  ["Site Settings", SettingsIcon],
] as const;
function download(data: Blob, name: string) {
  const u = URL.createObjectURL(data),
    a = document.createElement("a");
  a.href = u;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(u), 1000);
}
export default function Admin() {
  const [owner, setOwner] = useState(false),
    [checking, setChecking] = useState(true),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [error, setError] = useState(""),
    [section, setSection] = useState("Overview"),
    [rows, setRows] = useState<Row[]>([]),
    [published, setPublished] = useState<string[]>([]),
    [assets, setAssets] = useState<Asset[]>([]),
    [settings, setSite] = useState<Settings>(defaults),
    [editing, setEditing] = useState<Entry | null>(null),
    [preview, setPreview] = useState<Entry | null>(null),
    [search, setSearch] = useState(""),
    [toast, setToast] = useState(""),
    [busy, setBusy] = useState(false),
    [dirty, setDirty] = useState(false),
    [confirmDelete, setConfirmDelete] = useState<{
      kind: "entry" | "media";
      id: string;
      title: string;
    } | null>(null),
    [mediaJobs, setMediaJobs] = useState<
      { file: File; progress: number; error: string; done: boolean }[]
    >([]);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const changed = (e: Event) => setDirty((e as CustomEvent).detail);
    window.addEventListener("stash-dirty", changed);
    return () => window.removeEventListener("stash-dirty", changed);
  }, []);
  useEffect(() => {
    const leave = (e: Event) => {
      if (dirty && !confirm("Leave without saving your changes?"))
        e.preventDefault();
    };
    window.addEventListener("stash-leave", leave);
    return () => window.removeEventListener("stash-leave", leave);
  }, [dirty]);
  const notify = (text: string) => setToast(text);
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(""), 7000);
    return () => clearTimeout(id);
  }, [toast]);
  async function load() {
    if (!db) return;
    const [entries, live, media, site] = await Promise.all([
      query(
        db
          .from("entries")
          .select("*")
          .order("updated_at", { ascending: false }),
      ),
      query(db.from("published_entries").select("id")),
      query(
        db.from("media").select("*").order("created_at", { ascending: false }),
      ),
      query(db.from("site_settings").select("content").eq("id", 1).single()),
    ]);
    setRows(entries);
    setPublished(live.map((r) => r.id));
    setAssets(media);
    if (site) setSite(site.content);
  }
  async function check() {
    try {
      if (!db) return;
      const {
        data: { session },
      } = await db.auth.getSession();
      if (!session) return;
      const allowed = await query(db.rpc("is_owner"));
      if (!allowed) {
        await db.auth.signOut();
        throw new Error("This account does not have owner access.");
      }
      setOwner(true);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load dashboard");
    } finally {
      setChecking(false);
    }
  }
  useEffect(() => {
    check();
    const sub = db?.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        setOwner(false);
        setRows([]);
        setAssets([]);
        setEditing(null);
      }
    });
    return () => sub?.data.subscription.unsubscribe();
  }, []);
  async function login(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await query(db!.auth.signInWithPassword({ email, password }));
      setPassword("");
      await check();
    } catch {
      setError(
        "Could not sign in. Check your email and password, then try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function action(fn: () => Promise<unknown>, success: string) {
    setError("");
    setBusy(true);
    try {
      await fn();
      await load();
      notify(success);
      return true;
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Something went wrong. Please retry.",
      );
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function libraryUpload(file: File) {
    setMediaJobs((js) =>
      js.map((j) => (j.file === file ? { ...j, error: "", progress: 0 } : j)),
    );
    try {
      const asset = await upload(file, file.name, (p) =>
        setMediaJobs((js) =>
          js.map((j) => (j.file === file ? { ...j, progress: p } : j)),
        ),
      );
      setAssets((a) => [asset, ...a]);
      setMediaJobs((js) =>
        js.map((j) => (j.file === file ? { ...j, done: true } : j)),
      );
      notify(
        "Media uploaded privately. Choose it from the library in an entry.",
      );
    } catch (e) {
      setMediaJobs((js) =>
        js.map((j) =>
          j.file === file
            ? { ...j, error: e instanceof Error ? e.message : "Upload failed" }
            : j,
        ),
      );
    }
  }
  function libraryFiles(files: FileList | null) {
    if (!files) return;
    const selected = Array.from(files);
    setMediaJobs((js) => [
      ...js,
      ...selected.map((file) => ({
        file,
        progress: 0,
        error: "",
        done: false,
      })),
    ]);
    void (async () => {
      for (const file of selected) await libraryUpload(file);
    })();
  }
  const exportData = async () => {
    const live = await query(db!.from("published_entries").select("*"));
    download(
      new Blob(
        [
          JSON.stringify(
            {
              exportedAt: new Date().toISOString(),
              settings,
              entries: rows,
              published: live,
              media: assets,
            },
            null,
            2,
          ),
        ],
        { type: "application/json" },
      ),
      "the-stash-content-backup.json",
    );
    notify(
      "Content exported. Download originals from Media to complete your backup.",
    );
  };
  if (!configured)
    return (
      <main className="login">
        <a className="brand" href="#/">
          S· / The Stash
        </a>
        <div className="panel">
          <span className="eyebrow">Owner dashboard</span>
          <h1>
            One connection
            <br />
            left to make.
          </h1>
          <p>
            The secure content service has not been connected yet. Sign-in and
            publishing are unavailable until setup and security checks are
            complete.
          </p>
          <p className="muted">
            The existing live portfolio remains unchanged.
          </p>
          <a className="button" href="#/">
            View the redesign
          </a>
        </div>
      </main>
    );
  if (checking)
    return (
      <main className="login" role="status">
        Checking your session…
      </main>
    );
  if (!owner)
    return (
      <main className="login">
        <a className="brand" href="#/">
          S· / The Stash
        </a>
        <form className="panel" onSubmit={login}>
          <span className="eyebrow">Your creative workspace</span>
          <h1>Welcome back.</h1>
          <p className="muted">Sign in with your owner account.</p>
          <Field label="Email">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="username"
            />
          </Field>
          <Field label="Password">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </Field>
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          <button className="primary" disabled={busy}>
            {busy ? "Signing in…" : "Sign in"}
          </button>
          <p className="help">
            Only the authorized owner can access this workspace. Sessions stay
            in memory and end when this page is closed or reloaded.
          </p>
          <a href="#/">← Back to the portfolio</a>
        </form>
      </main>
    );
  const list = (items: Row[], recent = false) => (
    <>
      {!recent && (
        <label className="search">
          <Search size={18} />
          <input
            aria-label={"Search " + section.toLowerCase()}
            placeholder={"Search " + section.toLowerCase() + "…"}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
      )}
      <div className="entry-list">
        {items
          .filter(
            (r) =>
              recent ||
              r.content.title.toLowerCase().includes(search.toLowerCase()),
          )
          .map((r) => (
            <div className="entry-row" key={r.id}>
              <div className="entry-thumb">
                <Cover entry={r.content} assets={assets} />
              </div>
              <div className="entry-info">
                <strong>{r.content.title}</strong>
                <span>
                  {r.content.category || r.content.kind} · Edited{" "}
                  {new Date(r.updated_at).toLocaleDateString()}
                </span>
              </div>
              <span
                className={"status " + (published.includes(r.id) ? "live" : "")}
              >
                {published.includes(r.id) ? "Published" : "Draft"}
              </span>
              <div className="actions">
                <button onClick={() => setEditing(r.content)}>Edit</button>
                <button onClick={() => setPreview(r.content)}>Preview</button>
                <button
                  disabled={busy}
                  onClick={() =>
                    action(
                      () =>
                        published.includes(r.id)
                          ? query(
                              db!.rpc("unpublish_entry", { entry_id: r.id }),
                            )
                          : saveEntry(r.content, true),
                      published.includes(r.id)
                        ? "Unpublished. New public media requests are denied."
                        : "Published. Visitors will see it within 30 seconds.",
                    )
                  }
                >
                  {published.includes(r.id) ? "Unpublish" : "Publish"}
                </button>
                <button
                  className="danger subtle"
                  onClick={() =>
                    setConfirmDelete({
                      kind: "entry",
                      id: r.id,
                      title: r.content.title,
                    })
                  }
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
      </div>
      {!items.length && (
        <Empty title={`Your ${section.toLowerCase()} start here.`}>
          <p>Add a title, drop in your media, and make it yours.</p>
        </Empty>
      )}
    </>
  );
  return (
    <div className="admin-layout">
      <aside className="sidebar">
        <a className="brand" href="#/">
          S·{" "}
          <span>
            The Stash<small>OWNER WORKSPACE</small>
          </span>
        </a>
        <nav aria-label="Dashboard navigation">
          {sections.map(([name, Icon]) => (
            <button
              disabled={!!editing}
              key={name}
              aria-current={section === name ? "page" : undefined}
              onClick={() => {
                if (dirty && !confirm("Leave without saving your changes?"))
                  return;
                setDirty(false);
                setSection(name);
                setSearch("");
              }}
            >
              <Icon size={18} />
              {name}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <a
            href="#/"
            onClick={(e) => {
              if (editing) {
                e.preventDefault();
                notify(
                  "Use Back in the editor to save or discard changes first.",
                );
              }
            }}
          >
            View portfolio <ArrowUpRight size={16} />
          </a>
          <button disabled={!!editing} onClick={() => db!.auth.signOut()}>
            <LogOut size={16} />
            Sign out
          </button>
        </div>
      </aside>
      <main className="admin-main">
        <div className="admin-bar">
          <span>THE STASH / {editing ? "EDITOR" : section.toUpperCase()}</span>
          <span className="status live">Owner access</span>
        </div>
        {error && (
          <div className="notice error" role="alert">
            {error}
            <button onClick={() => action(load, "Dashboard refreshed.")}>
              Retry
            </button>
          </div>
        )}
        {editing ? (
          <Editor
            key={editing.id}
            initial={editing}
            published={published.includes(editing.id)}
            assets={assets}
            setAssets={setAssets}
            settings={settings}
            onBack={() => {
              setEditing(null);
              load().catch((e) => setError(e.message));
            }}
            onSaved={() => {
              load().catch((e) => setError(e.message));
            }}
            notify={notify}
          />
        ) : (
          <>
            <div className="admin-title">
              <div>
                <span className="eyebrow">
                  {section === "Overview"
                    ? "Make something worth sharing."
                    : "Your workspace"}
                </span>
                <h1>
                  {section === "Overview" ? "Welcome back, Chris." : section}
                </h1>
              </div>
              {["Projects", "Plugins"].includes(section) && (
                <button
                  className="primary"
                  onClick={() =>
                    setEditing(
                      blank(section === "Plugins" ? "plugin" : "project"),
                    )
                  }
                >
                  <Plus size={18} />
                  Add {section === "Plugins" ? "plugin" : "project"}
                </button>
              )}
            </div>
            {section === "Overview" && (
              <>
                <div className="quick-actions">
                  <button onClick={() => setEditing(blank("project"))}>
                    <Layers />
                    <strong>Add project</strong>
                    <span>
                      Share a map or a new creation <Plus size={16} />
                    </span>
                  </button>
                  <button onClick={() => setEditing(blank("plugin"))}>
                    <Package />
                    <strong>Add plugin</strong>
                    <span>
                      Give your plugin a home <Plus size={16} />
                    </span>
                  </button>
                  <button
                    onClick={() => {
                      setSection("Media");
                      input.current?.click();
                    }}
                  >
                    <Upload />
                    <strong>Upload media</strong>
                    <span>
                      Bring your work into the library <Plus size={16} />
                    </span>
                  </button>
                </div>
                <div className="stats">
                  <div>
                    <strong>
                      {rows.filter((r) => r.content.kind === "project").length}
                    </strong>
                    <span>Projects</span>
                  </div>
                  <div>
                    <strong>
                      {rows.filter((r) => r.content.kind === "plugin").length}
                    </strong>
                    <span>Plugins</span>
                  </div>
                  <div>
                    <strong>{published.length}</strong>
                    <span>Published entries</span>
                  </div>
                  <div>
                    <strong>{assets.length}</strong>
                    <span>Media files</span>
                  </div>
                </div>
                <section className="panel">
                  <div className="section-heading">
                    <h2>Recently edited</h2>
                    <span className="muted">
                      Your latest work, all in one place.
                    </span>
                  </div>
                  {list(rows.slice(0, 5), true)}
                </section>
              </>
            )}
            {["Projects", "Plugins"].includes(section) &&
              list(
                rows.filter(
                  (r) =>
                    r.content.kind ===
                    (section === "Plugins" ? "plugin" : "project"),
                ),
              )}
            {section === "Media" && (
              <>
                <p className="muted">
                  Files are private until used in a published entry. Removing a
                  file from an entry keeps the original here.
                </p>
                <div
                  className="dropzone"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    libraryFiles(e.dataTransfer.files);
                  }}
                >
                  <Upload />
                  <strong>Drop images or videos into your library</strong>
                  <span>JPEG / PNG / WebP: 12 MB · MP4 / WebM: 40 MB</span>
                  <button onClick={() => input.current?.click()}>
                    Upload media
                  </button>
                </div>
                {mediaJobs
                  .filter((j) => !j.done)
                  .map((j, i) => (
                    <div className="panel" key={i}>
                      <strong>{j.file.name}</strong>
                      <progress value={j.progress} max={100} />
                      {j.error && (
                        <>
                          <p role="alert">{j.error}</p>
                          <button onClick={() => libraryUpload(j.file)}>
                            Retry
                          </button>
                          <button
                            onClick={() =>
                              setMediaJobs((js) => js.filter((x) => x !== j))
                            }
                          >
                            Dismiss
                          </button>
                        </>
                      )}
                    </div>
                  ))}
                <div className="library-grid">
                  {assets.map((a) => (
                    <div className="panel" key={a.id}>
                      {a.mime.startsWith("image") ? (
                        <AssetImage id={a.id} assets={assets} alt={a.name} />
                      ) : (
                        <div className="image-placeholder">
                          Video · {a.mime}
                        </div>
                      )}
                      <strong>{a.name}</strong>
                      <p className="muted">
                        {(a.size / 1024 / 1024).toFixed(1)} MB · Original
                        retained
                      </p>
                      <div className="actions">
                        <button
                          onClick={() =>
                            action(async () => {
                              const u = await privateMedia(a, "original");
                              const r = await fetch(u);
                              download(await r.blob(), a.name);
                              URL.revokeObjectURL(u);
                            }, "Original downloaded.")
                          }
                        >
                          Download original
                        </button>
                        <button
                          className="danger"
                          onClick={() =>
                            setConfirmDelete({
                              kind: "media",
                              id: a.id,
                              title: a.name,
                            })
                          }
                        >
                          Permanently delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                {!assets.length && (
                  <Empty title="Room for your creations.">
                    <p>Upload your first image or video above.</p>
                  </Empty>
                )}
              </>
            )}
            {section === "Categories" && (
              <CategorySettings
                settings={settings}
                onSave={(categories) =>
                  action(
                    () => query(db!.rpc("save_categories", { categories })),
                    "Categories saved.",
                  )
                }
                busy={busy}
              />
            )}
            {section === "Site Settings" && (
              <SiteSettings
                settings={settings}
                rows={rows}
                onSave={(s) =>
                  action(() => setSettings(s), "Site settings published.")
                }
                busy={busy}
                onExport={() =>
                  action(exportData, "Content backup downloaded.")
                }
              />
            )}
          </>
        )}
        <input
          ref={input}
          hidden
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp,video/mp4,video/webm"
          onChange={(e) => {
            libraryFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </main>
      {toast && (
        <div className="toast" role="status">
          {toast}
          <button onClick={() => setToast("")} aria-label="Dismiss message">
            ×
          </button>
        </div>
      )}
      {preview && (
        <Modal
          title="Private draft preview"
          wide
          onClose={() => setPreview(null)}
        >
          <EntryDetail entry={preview} assets={assets} preview />
        </Modal>
      )}
      {confirmDelete && (
        <Modal
          title={
            confirmDelete.kind === "media"
              ? "Permanently delete media?"
              : "Delete entry?"
          }
          onClose={() => setConfirmDelete(null)}
        >
          <div className="confirm">
            <h2>{confirmDelete.title}</h2>
            <p>
              {confirmDelete.kind === "media"
                ? "This permanently removes the original and its previews. Files used in any saved draft or published entry cannot be deleted. Download a backup first."
                : "This removes the draft and published page. Its media stays in the library. Export a backup first if you may need this entry again."}
            </p>
            <div className="actions">
              <button onClick={() => setConfirmDelete(null)}>Cancel</button>
              <button
                className="danger"
                disabled={busy}
                onClick={() => {
                  const d = confirmDelete;
                  void action(
                    () =>
                      d.kind === "media"
                        ? removeAsset(d.id)
                        : query(db!.rpc("delete_entry", { entry_id: d.id })),
                    "Deleted.",
                  ).then(() => setConfirmDelete(null));
                }}
              >
                Delete{" "}
                {confirmDelete.kind === "media" ? "permanently" : "entry"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
function useUnsaved(dirty: boolean) {
  useEffect(() => {
    window.dispatchEvent(new CustomEvent("stash-dirty", { detail: dirty }));
    return () => {
      window.dispatchEvent(new CustomEvent("stash-dirty", { detail: false }));
    };
  }, [dirty]);
  useEffect(() => {
    const f = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", f);
    return () => window.removeEventListener("beforeunload", f);
  }, [dirty]);
}
function CategorySettings({
  settings,
  onSave,
  busy,
}: {
  settings: Settings;
  onSave: (
    categories: { original: string; name: string }[],
  ) => Promise<boolean>;
  busy: boolean;
}) {
  const [categories, setCategories] = useState(
      settings.categories.map((name) => ({ original: name, name })),
    ),
    [dirty, setDirty] = useState(false),
    [error, setError] = useState("");
  useUnsaved(dirty);
  const change = (v: typeof categories) => {
    setCategories(v);
    setDirty(true);
  };
  return (
    <section className="panel">
      <h2>Arrange your categories</h2>
      <p className="muted">
        Renaming updates the label on all entries. Removing a category leaves
        those entries uncategorized. Changes appear publicly when saved.
      </p>
      <div className="stack">
        {categories.map((c, i) => (
          <div className="category-row" key={i}>
            <input
              aria-label={"Category " + (i + 1)}
              value={c.name}
              maxLength={80}
              onChange={(e) =>
                change(
                  categories.map((x, n) =>
                    n === i ? { ...x, name: e.target.value } : x,
                  ),
                )
              }
            />
            <button
              disabled={i === 0}
              onClick={() => change(move(categories, i, i - 1))}
              aria-label={"Move category " + (i + 1) + " up"}
            >
              ↑
            </button>
            <button
              disabled={i === categories.length - 1}
              onClick={() => change(move(categories, i, i + 1))}
              aria-label={"Move category " + (i + 1) + " down"}
            >
              ↓
            </button>
            <button
              onClick={() => change(categories.filter((_, n) => n !== i))}
            >
              Remove
            </button>
          </div>
        ))}
      </div>
      {error && <p role="alert">{error}</p>}
      <div className="actions">
        <button
          onClick={() => change([...categories, { original: "", name: "" }])}
        >
          + Add category
        </button>
        <button
          className="primary"
          disabled={busy}
          onClick={async () => {
            const cleaned = categories.map((c) => ({
              ...c,
              name: c.name.trim(),
            }));
            if (
              cleaned.some((c) => !c.name) ||
              new Set(cleaned.map((c) => c.name)).size !== cleaned.length
            ) {
              setError("Use a unique, non-empty name for each category.");
              return;
            }
            if (await onSave(cleaned)) {
              setCategories(
                cleaned.map((c) => ({ original: c.name, name: c.name })),
              );
              setDirty(false);
              setError("");
            }
          }}
        >
          Save categories
        </button>
      </div>
    </section>
  );
}
function SiteSettings({
  settings,
  rows,
  onSave,
  busy,
  onExport,
}: {
  settings: Settings;
  rows: Row[];
  onSave: (s: Settings) => Promise<boolean>;
  busy: boolean;
  onExport: () => void;
}) {
  const [value, setValue] = useState(settings),
    [dirty, setDirty] = useState(false),
    [error, setError] = useState("");
  useUnsaved(dirty);
  const update = (p: Partial<Settings>) => {
    setValue((v) => ({ ...v, ...p }));
    setDirty(true);
  };
  return (
    <>
      <section className="panel">
        <h2>Make it yours</h2>
        <Field label="Site title">
          <input
            value={value.title}
            maxLength={60}
            onChange={(e) => update({ title: e.target.value })}
          />
        </Field>
        <Field label="Introduction">
          <textarea
            value={value.intro}
            maxLength={400}
            onChange={(e) => update({ intro: e.target.value })}
          />
        </Field>
        <Field label="About you">
          <textarea
            value={value.about}
            maxLength={4000}
            onChange={(e) => update({ about: e.target.value })}
          />
        </Field>
        <Field label="Contact introduction">
          <textarea
            value={value.contactIntro}
            maxLength={400}
            onChange={(e) => update({ contactIntro: e.target.value })}
          />
        </Field>
        <Field label="Discord username">
          <input
            value={value.discord}
            onChange={(e) => update({ discord: e.target.value })}
          />
        </Field>
        <LinksEditor
          value={value.links}
          onChange={(links) => update({ links })}
        />
        <details>
          <summary>Search and sharing description</summary>
          <Field label="Site description">
            <textarea
              value={value.description}
              maxLength={200}
              onChange={(e) => update({ description: e.target.value })}
            />
          </Field>
        </details>
      </section>
      <section className="panel">
        <h2>Featured work</h2>
        <p className="muted">
          Choose the entries shown on the homepage. Unpublished entries stay
          hidden.
        </p>
        {value.featured.map((id, i) => (
          <div className="category-row" key={id}>
            <strong>
              {rows.find((r) => r.id === id)?.content.title || "Deleted entry"}
            </strong>
            <button
              disabled={i === 0}
              onClick={() =>
                update({ featured: move(value.featured, i, i - 1) })
              }
              aria-label={`Move featured entry ${i + 1} up`}
            >
              ↑
            </button>
            <button
              disabled={i === value.featured.length - 1}
              onClick={() =>
                update({ featured: move(value.featured, i, i + 1) })
              }
              aria-label={`Move featured entry ${i + 1} down`}
            >
              ↓
            </button>
            <button
              onClick={() =>
                update({ featured: value.featured.filter((x) => x !== id) })
              }
            >
              Remove
            </button>
          </div>
        ))}
        <Field label="Add featured entry">
          <select
            value=""
            onChange={(e) => {
              if (e.target.value)
                update({ featured: [...value.featured, e.target.value] });
            }}
          >
            <option value="">Choose a project or plugin</option>
            {rows
              .filter((r) => !value.featured.includes(r.id))
              .map((r) => (
                <option key={r.id} value={r.id}>
                  {r.content.title}
                </option>
              ))}
          </select>
        </Field>
      </section>
      {error && <p role="alert">{error}</p>}
      <button
        className="primary"
        disabled={busy}
        onClick={async () => {
          if (
            !value.title.trim() ||
            value.links.some((l) => !l.label.trim() || !safeUrl(l.url))
          ) {
            setError("Enter a site title and check your contact links.");
            return;
          }
          if (await onSave(value)) setDirty(false);
        }}
      >
        Save site settings
      </button>
      <section className="panel backup">
        <h2>Back up your work</h2>
        <p>
          Export all entry drafts, published versions, categories and settings.
          Download original files from Media to complete the backup. Keep these
          files somewhere private.
        </p>
        <button onClick={onExport}>
          <Download size={16} />
          Export content backup
        </button>
      </section>
    </>
  );
}
