import { useEffect, useRef, useState } from "react";
import { Upload, Plus, GripVertical, Check, ArrowLeft } from "lucide-react";
import type { Asset, Entry, MediaItem, Settings } from "./types";
import { upload, saveEntry } from "./api";
import { sniff, limits, move, safeUrl, videoLink } from "./validation.js";
import { AssetImage, Field, LinksEditor, Modal, EntryDetail } from "./ui";
export function blank(kind: "project" | "plugin"): Entry {
  return {
    id: crypto.randomUUID(),
    kind,
    title: "",
    summary: "",
    description: "",
    features: [],
    tags: [],
    category: kind === "plugin" ? "Unturned Plugins" : "Unturned Maps",
    media: [],
    cover: "",
    links: [],
    version: "",
    compatibility: "",
    comingSoon: false,
  };
}
type Job = {
  id: string;
  file: File;
  preview: string;
  progress: number;
  error: string;
  done: boolean;
  target?: string;
  poster?: string;
};
export default function Editor({
  initial,
  published,
  assets,
  setAssets,
  settings,
  onBack,
  onSaved,
  notify,
}: {
  initial: Entry;
  published: boolean;
  assets: Asset[];
  setAssets: (v: Asset[] | ((a: Asset[]) => Asset[])) => void;
  settings: Settings;
  onBack: () => void;
  onSaved: (e: Entry) => void;
  notify: (m: string) => void;
}) {
  const [entry, setEntry] = useState<Entry>(structuredClone(initial)),
    [dirty, setDirty] = useState(false),
    [jobs, setJobs] = useState<Job[]>([]),
    [saving, setSaving] = useState(false),
    [preview, setPreview] = useState(false),
    [error, setError] = useState(""),
    [video, setVideo] = useState(""),
    [drag, setDrag] = useState<number | null>(null),
    [library, setLibrary] = useState(false);
  const picker = useRef<HTMLInputElement>(null),
    replace = useRef<HTMLInputElement>(null),
    poster = useRef<HTMLInputElement>(null),
    replaceId = useRef(""),
    posterId = useRef("");
  const jobsRef = useRef<Job[]>([]);
  jobsRef.current = jobs;
  const update = (patch: Partial<Entry>) => {
    setEntry((e) => ({ ...e, ...patch }));
    setDirty(true);
  };
  const updateMedia = (id: string, patch: Partial<MediaItem>) => {
    setEntry((e) => ({
      ...e,
      media: e.media.map((m) => (m.id === id ? { ...m, ...patch } : m)),
    }));
    setDirty(true);
  };
  const pending = jobs.some((j) => !j.done);
  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent("stash-dirty", { detail: dirty || pending }),
    );
    return () => {
      window.dispatchEvent(new CustomEvent("stash-dirty", { detail: false }));
    };
  }, [dirty, pending]);
  useEffect(() => {
    const f = (e: BeforeUnloadEvent) => {
      if (dirty || pending) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", f);
    return () => window.removeEventListener("beforeunload", f);
  }, [dirty, pending]);
  useEffect(
    () => () => {
      jobsRef.current.forEach((j) => URL.revokeObjectURL(j.preview));
    },
    [],
  );
  const leave = () => {
    if (
      (dirty || pending) &&
      !confirm(
        "Leave this editor? Unsaved changes and pending uploads will be lost.",
      )
    )
      return;
    onBack();
  };
  async function run(job: Job) {
    const patch = (p: Partial<Job>) =>
      setJobs((js) => js.map((j) => (j.id === job.id ? { ...j, ...p } : j)));
    patch({ error: "", progress: 0 });
    try {
      const mime = sniff(
        new Uint8Array(await job.file.slice(0, 256).arrayBuffer()),
      );
      if (!mime || mime !== job.file.type)
        throw new Error(
          "Use a JPEG, PNG, WebP, MP4 or WebM file. Renaming a file does not convert it.",
        );
      if (job.poster && !mime.startsWith("image"))
        throw new Error("Choose an image for the video poster.");
      if (
        job.file.size > (mime.startsWith("image") ? limits.image : limits.video)
      )
        throw new Error(
          "This file is too large. Images can be up to 12 MB; videos up to 40 MB. For larger videos, use Add video link.",
        );
      if (mime.startsWith("video")) {
        await new Promise<void>((resolve, reject) => {
          const v = document.createElement("video");
          const u = URL.createObjectURL(job.file);
          const timer = setTimeout(() => {
            URL.revokeObjectURL(u);
            reject(
              new Error(
                "Could not read this video. Convert to MP4 (H.264/AAC) or WebM (VP8/VP9/Opus), or use a video link.",
              ),
            );
          }, 12000);
          v.preload = "metadata";
          v.onloadedmetadata = () => {
            clearTimeout(timer);
            URL.revokeObjectURL(u);
            resolve();
          };
          v.onerror = () => {
            clearTimeout(timer);
            URL.revokeObjectURL(u);
            reject(
              new Error(
                "Your browser cannot read this video. Convert to MP4 (H.264/AAC) or WebM, or add a video link.",
              ),
            );
          };
          v.src = u;
        });
      }
      const asset = await upload(job.file, job.file.name, (p) =>
        patch({ progress: p }),
      );
      setAssets((a) => [asset, ...a]);
      setEntry((e) => {
        if (job.poster)
          return {
            ...e,
            media: e.media.map((m) =>
              m.id === job.poster ? { ...m, poster: asset.id } : m,
            ),
          };
        const m: MediaItem = {
          id: job.target || job.id,
          asset: asset.id,
          poster: mime.startsWith("video") ? asset.id : undefined,
          kind: mime.startsWith("image") ? "image" : "video",
          title: job.file.name.replace(/\.[^.]+$/, ""),
          alt: "",
          caption: "",
          focalX: 50,
          focalY: 50,
        };
        return {
          ...e,
          media: job.target
            ? e.media.map((old) =>
                old.id === job.target
                  ? { ...old, asset: asset.id, kind: m.kind, poster: m.poster }
                  : old,
              )
            : [...e.media, m],
          cover: e.cover || m.id,
        };
      });
      setDirty(true);
      patch({ done: true, progress: 100 });
    } catch (e) {
      patch({
        error: e instanceof Error ? e.message : "Upload failed. Please retry.",
      });
    }
  }
  function addFiles(
    files: FileList | File[] | null,
    target?: string,
    poster?: string,
  ) {
    if (!files) return;
    const newJobs = Array.from(files).map((file) => ({
      id: crypto.randomUUID(),
      file,
      preview: URL.createObjectURL(file),
      progress: 0,
      error: "",
      done: false,
      target,
      poster,
    }));
    setJobs((j) => [...j, ...newJobs]);
    setDirty(true);
    void (async () => {
      for (const j of newJobs) await run(j);
    })();
  }
  async function save(publish: boolean) {
    setError("");
    try {
      if (!entry.title.trim()) throw new Error("Give your entry a title.");
      if (pending)
        throw new Error(
          "Finish or dismiss failed uploads before saving. Your text is still here.",
        );
      const clean = {
        ...entry,
        title: entry.title.trim(),
        links: entry.links.filter((l) => l.label.trim() || l.url.trim()),
      };
      if (clean.links.some((l) => !l.label.trim() || !safeUrl(l.url)))
        throw new Error(
          "Each link needs a label and a valid HTTPS or email address.",
        );
      if (clean.media.some((m) => m.kind === "link" && !videoLink(m.url || "")))
        throw new Error("Check your video links.");
      setSaving(true);
      await saveEntry(clean, publish);
      setDirty(false);
      onSaved(clean);
      notify(
        publish
          ? "Published. Visitors will see changes within 30 seconds."
          : "Draft saved. The public website is unchanged.",
      );
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Could not save. Your changes are still here.",
      );
    } finally {
      setSaving(false);
    }
  }
  const reorder = (from: number, to: number) =>
    update({ media: move(entry.media, from, to) });
  return (
    <>
      <div className="editor-top">
        <button onClick={leave}>
          <ArrowLeft size={16} />
          Back
        </button>
        <span className="muted">
          {dirty
            ? "Unsaved changes"
            : published
              ? "Published · editing draft"
              : "Draft"}{" "}
          · {entry.kind}
        </span>
        <button onClick={() => setPreview(true)}>Preview</button>
      </div>
      <h1>{initial.title ? "Edit " + entry.kind : "Add " + entry.kind}</h1>
      <p className="muted">
        Start with a title. Add your work, preview it, then publish when you’re
        ready.
      </p>
      <div className="editor-grid">
        <div>
          <section className="panel">
            <h2>Basic information</h2>
            <Field label="Title">
              <input
                autoFocus
                value={entry.title}
                maxLength={160}
                onChange={(e) => update({ title: e.target.value })}
                placeholder={
                  entry.kind === "plugin"
                    ? "Name your plugin"
                    : "Name your project"
                }
              />
            </Field>
            <Field
              label="Short description"
              hint="A sentence or two for the card."
            >
              <textarea
                rows={2}
                maxLength={400}
                value={entry.summary}
                onChange={(e) => update({ summary: e.target.value })}
              />
            </Field>
            <Field label="Full description">
              <textarea
                rows={6}
                value={entry.description}
                maxLength={20000}
                onChange={(e) => update({ description: e.target.value })}
              />
            </Field>
            <div className="two-col">
              <Field label="Category">
                <select
                  value={entry.category}
                  onChange={(e) => update({ category: e.target.value })}
                >
                  <option value="">No category</option>
                  {settings.categories.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </Field>
              <Field label="Tags" hint="Separate tags with commas.">
                <input
                  value={entry.tags.join(",")}
                  onChange={(e) => update({ tags: e.target.value.split(",") })}
                  onBlur={() =>
                    update({
                      tags: entry.tags.map((t) => t.trim()).filter(Boolean),
                    })
                  }
                />
              </Field>
            </div>
            <details>
              <summary>More details</summary>
              <Field label="Features" hint="One feature per line.">
                <textarea
                  value={entry.features.join("\n")}
                  onChange={(e) =>
                    update({ features: e.target.value.split("\n") })
                  }
                  onBlur={() =>
                    update({ features: entry.features.filter((f) => f.trim()) })
                  }
                />
              </Field>
              <div className="two-col">
                <Field label="Version (optional)">
                  <input
                    value={entry.version}
                    onChange={(e) => update({ version: e.target.value })}
                  />
                </Field>
                <Field label="Compatibility (optional)">
                  <input
                    value={entry.compatibility}
                    onChange={(e) => update({ compatibility: e.target.value })}
                  />
                </Field>
              </div>
            </details>
          </section>
          <section className="panel">
            <h2>Images and videos</h2>
            <p className="muted">
              JPEG, PNG or WebP up to 12 MB. MP4 or WebM up to 40 MB each.
              Originals are kept. Images are resized without stretching or
              upscaling.
            </p>
            <div
              className="dropzone"
              onDragOver={(e) => {
                e.preventDefault();
                e.currentTarget.classList.add("dragging");
              }}
              onDragLeave={(e) => e.currentTarget.classList.remove("dragging")}
              onDrop={(e) => {
                e.preventDefault();
                e.currentTarget.classList.remove("dragging");
                addFiles(e.dataTransfer.files);
              }}
            >
              <Upload size={28} />
              <strong>Drop your images and videos here</strong>
              <span>or</span>
              <button onClick={() => picker.current?.click()}>
                Choose files
              </button>
              <input
                ref={picker}
                type="file"
                hidden
                multiple
                accept="image/jpeg,image/png,image/webp,video/mp4,video/webm"
                onChange={(e) => {
                  addFiles(e.target.files);
                  e.target.value = "";
                }}
              />
            </div>
            <p className="help">
              For widest playback support, use MP4 with H.264 video and AAC
              audio. No automatic video conversion is performed. Larger or
              unsupported videos can be hosted on YouTube or Vimeo and added
              below.
            </p>
            {jobs
              .filter((j) => !j.done)
              .map((j) => (
                <div className="upload-job" key={j.id}>
                  {j.file.type.startsWith("image") ? (
                    <img src={j.preview} alt="Upload preview" />
                  ) : (
                    <video src={j.preview} muted preload="metadata" />
                  )}
                  <div>
                    <strong>{j.file.name}</strong>
                    <progress
                      value={j.progress}
                      max={100}
                      aria-label={"Uploading " + j.file.name}
                    />
                    <span>
                      {j.progress}% {j.progress === 90 ? "· Processing…" : ""}
                    </span>
                    {j.error && <p role="alert">{j.error}</p>}
                  </div>
                  {j.error && (
                    <div>
                      <button onClick={() => run(j)}>Retry</button>
                      <button
                        onClick={() => {
                          URL.revokeObjectURL(j.preview);
                          setJobs((js) => js.filter((x) => x.id !== j.id));
                        }}
                      >
                        Dismiss upload
                      </button>
                    </div>
                  )}
                </div>
              ))}
            <div className="video-link-form">
              <Field label="Video URL">
                <input
                  value={video}
                  onChange={(e) => setVideo(e.target.value)}
                  placeholder="Paste a YouTube or Vimeo link"
                />
              </Field>
              <button
                onClick={() => {
                  const v = videoLink(video);
                  if (!v) {
                    setError(
                      "Paste a supported HTTPS YouTube or Vimeo video URL.",
                    );
                    return;
                  }
                  update({
                    media: [
                      ...entry.media,
                      {
                        id: crypto.randomUUID(),
                        kind: "link",
                        url: v.url,
                        title: v.provider + " video",
                        alt: "",
                        caption: "",
                        focalX: 50,
                        focalY: 50,
                      },
                    ],
                  });
                  setVideo("");
                  setError("");
                }}
              >
                <Plus size={16} />
                Add video link
              </button>
              <button onClick={() => setLibrary(true)}>
                Choose from library
              </button>
            </div>
            <div className="stack">
              {entry.media.map((m, i) => (
                <div
                  className="media-editor"
                  key={m.id}
                  onDragOver={(e) => {
                    if (drag !== null) e.preventDefault();
                  }}
                  onDrop={(e) => {
                    if (drag !== null) {
                      e.preventDefault();
                      reorder(drag, i);
                      setDrag(null);
                    }
                  }}
                >
                  <div className="media-editor-head">
                    <span
                      draggable
                      onDragStart={() => setDrag(i)}
                      onDragEnd={() => setDrag(null)}
                      title="Drag to reorder"
                    >
                      <GripVertical size={20} />
                    </span>
                    <strong>
                      {i + 1}. {m.title || m.kind}
                    </strong>
                    <div className="actions">
                      <button
                        disabled={i === 0}
                        onClick={() => reorder(i, i - 1)}
                        aria-label={`Move media ${i + 1} up`}
                      >
                        ↑
                      </button>
                      <button
                        disabled={i === entry.media.length - 1}
                        onClick={() => reorder(i, i + 1)}
                        aria-label={`Move media ${i + 1} down`}
                      >
                        ↓
                      </button>
                    </div>
                  </div>
                  <div className="media-editor-body">
                    <div>
                      <AssetImage
                        id={m.kind === "image" ? m.asset : m.poster}
                        assets={assets}
                        alt={m.alt}
                        focalX={m.focalX}
                        focalY={m.focalY}
                      />
                      {(m.kind === "image" || m.poster) && (
                        <button
                          className={entry.cover === m.id ? "selected" : ""}
                          onClick={() => update({ cover: m.id })}
                        >
                          {entry.cover === m.id ? (
                            <>
                              <Check size={15} />
                              Cover
                            </>
                          ) : (
                            "Use as cover"
                          )}
                        </button>
                      )}
                      {m.kind !== "image" && (
                        <button
                          onClick={() => {
                            posterId.current = m.id;
                            poster.current?.click();
                          }}
                        >
                          {m.poster ? "Replace poster" : "Choose video poster"}
                        </button>
                      )}
                    </div>
                    <div>
                      <Field label="Title">
                        <input
                          value={m.title}
                          onChange={(e) =>
                            updateMedia(m.id, { title: e.target.value })
                          }
                        />
                      </Field>
                      {m.kind === "link" && (
                        <Field label="Video URL">
                          <input
                            value={m.url || ""}
                            onChange={(e) =>
                              updateMedia(m.id, { url: e.target.value })
                            }
                            onBlur={() => {
                              const v = videoLink(m.url || "");
                              if (v) updateMedia(m.id, { url: v.url });
                            }}
                            aria-invalid={!videoLink(m.url || "")}
                          />
                        </Field>
                      )}
                      <Field label="Caption">
                        <input
                          value={m.caption}
                          onChange={(e) =>
                            updateMedia(m.id, { caption: e.target.value })
                          }
                        />
                      </Field>
                      {m.kind === "image" && (
                        <Field
                          label="Alt text"
                          hint="Describe the image for someone who cannot see it."
                        >
                          <input
                            value={m.alt}
                            onChange={(e) =>
                              updateMedia(m.id, { alt: e.target.value })
                            }
                          />
                        </Field>
                      )}
                      <details>
                        <summary>Thumbnail focal point</summary>
                        <Field label="Horizontal">
                          <input
                            type="range"
                            min="0"
                            max="100"
                            value={m.focalX}
                            onChange={(e) =>
                              updateMedia(m.id, {
                                focalX: Number(e.target.value),
                              })
                            }
                          />
                        </Field>
                        <Field label="Vertical">
                          <input
                            type="range"
                            min="0"
                            max="100"
                            value={m.focalY}
                            onChange={(e) =>
                              updateMedia(m.id, {
                                focalY: Number(e.target.value),
                              })
                            }
                          />
                        </Field>
                      </details>
                      <div className="actions">
                        {m.kind !== "link" && (
                          <button
                            onClick={() => {
                              replaceId.current = m.id;
                              replace.current?.click();
                            }}
                          >
                            Replace file
                          </button>
                        )}
                        <button
                          onClick={() =>
                            update({
                              media: entry.media.filter((x) => x.id !== m.id),
                              cover: entry.cover === m.id ? "" : entry.cover,
                            })
                          }
                        >
                          Remove from this entry
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <input
              type="file"
              hidden
              ref={replace}
              accept="image/jpeg,image/png,image/webp,video/mp4,video/webm"
              onChange={(e) => {
                addFiles(e.target.files, replaceId.current);
                e.target.value = "";
              }}
            />
            <input
              type="file"
              hidden
              ref={poster}
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => {
                addFiles(e.target.files, undefined, posterId.current);
                e.target.value = "";
              }}
            />
            <label className="check">
              <input
                type="checkbox"
                checked={entry.comingSoon}
                onChange={(e) => update({ comingSoon: e.target.checked })}
              />
              Show “Video preview coming soon” when there are no videos
            </label>
          </section>
          <section className="panel">
            <h2>Links</h2>
            <p className="muted">
              Add downloads, source code, documentation or contact links.
            </p>
            <LinksEditor
              value={entry.links}
              onChange={(links) => update({ links })}
            />
          </section>
        </div>
        <aside>
          <section className="panel publishing">
            <span className="eyebrow">Ready when you are</span>
            <h2>Publishing</h2>
            <p>
              Save Draft keeps your changes private. Publish updates the public
              website.
            </p>
            <button
              className="primary"
              disabled={saving || pending}
              onClick={() => save(true)}
            >
              {saving
                ? "Saving…"
                : published
                  ? "Save and Publish Changes"
                  : "Publish"}
            </button>
            <button disabled={saving || pending} onClick={() => save(false)}>
              Save Draft
            </button>
            <button onClick={() => setPreview(true)}>Preview</button>
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            <small>
              No manual commit or deployment needed for content changes.
            </small>
          </section>
        </aside>
      </div>
      {preview && (
        <Modal
          title="Private preview — not published"
          wide
          onClose={() => setPreview(false)}
        >
          <EntryDetail entry={entry} assets={assets} preview />
        </Modal>
      )}
      {library && (
        <Modal title="Choose media" wide onClose={() => setLibrary(false)}>
          <div className="library-picker">
            {assets.map((a) => (
              <button
                key={a.id}
                onClick={() => {
                  const m: MediaItem = {
                    id: crypto.randomUUID(),
                    asset: a.id,
                    poster: a.mime.startsWith("video") ? a.id : undefined,
                    kind: a.mime.startsWith("image") ? "image" : "video",
                    title: a.name,
                    alt: "",
                    caption: "",
                    focalX: 50,
                    focalY: 50,
                  };
                  update({
                    media: [...entry.media, m],
                    cover: entry.cover || m.id,
                  });
                  setLibrary(false);
                }}
              >
                {a.mime.startsWith("image") && (
                  <AssetImage id={a.id} assets={assets} />
                )}
                <span>{a.name}</span>
              </button>
            ))}
            {!assets.length && <p>No uploads yet.</p>}
          </div>
        </Modal>
      )}
    </>
  );
}
