import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  X,
  ArrowLeft,
  ArrowRight,
  Play,
  Image as ImageIcon,
  ExternalLink,
} from "lucide-react";
import { privateMedia, publicMedia } from "./api";
import { recordActivity } from "./activity";
import { safeUrl, videoLink, move } from "./validation.js";
import type { Asset, Entry, Link, MediaItem } from "./types";
export const IconImage = ImageIcon;
export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}
export function Empty({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty">
      <span className="empty-mark">[ &nbsp; ]</span>
      <h3>{title}</h3>
      {children}
    </div>
  );
}
export function Modal({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    ref.current?.showModal();
    const old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = old;
      previous?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={wide ? "wide" : ""}
      onCancel={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      aria-label={title}
    >
      <div className="modal-head">
        <span>{title}</span>
        <button onClick={onClose} aria-label="Close">
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
export function AssetImage({
  id,
  assets,
  alt = "",
  className = "",
  focalX = 50,
  focalY = 50,
  variant = "thumb",
}: {
  id?: string;
  assets?: Asset[];
  alt?: string;
  className?: string;
  focalX?: number;
  focalY?: number;
  variant?: string;
}) {
  const [src, setSrc] = useState(""),
    [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true,
      blob = "";
    setFailed(false);
    setSrc("");
    if (!id) return;
    const asset = assets?.find((a) => a.id === id);
    if (assets) {
      if (asset)
        privateMedia(asset, variant)
          .then((u) => {
            blob = u;
            if (active) setSrc(u);
            else URL.revokeObjectURL(u);
          })
          .catch(() => setFailed(true));
    } else setSrc(publicMedia(id, variant));
    return () => {
      active = false;
      if (blob) URL.revokeObjectURL(blob);
    };
  }, [id, variant, assets]);
  return src && !failed ? (
    <img
      className={className}
      src={src}
      srcSet={
        !assets && id && variant === "thumb"
          ? `${publicMedia(id, "thumb")} 640w, ${publicMedia(id, "display")} 1920w`
          : undefined
      }
      sizes={
        !assets && variant === "thumb"
          ? "(max-width: 540px) 100vw, 50vw"
          : undefined
      }
      alt={alt}
      loading="lazy"
      style={{ objectPosition: `${focalX}% ${focalY}%` }}
      onError={() => setFailed(true)}
    />
  ) : (
    <div className={`image-placeholder ${className}`}>
      <ImageIcon size={28} />
      {failed && <span>Image unavailable</span>}
    </div>
  );
}
export function Cover({ entry, assets }: { entry: Entry; assets?: Asset[] }) {
  const m =
    entry.media.find((m) => m.id === entry.cover) ||
    entry.media.find((m) => m.kind === "image" || m.poster);
  return (
    <AssetImage
      id={m?.kind === "image" ? m.asset : m?.poster}
      assets={assets}
      alt={m?.alt || entry.title}
      focalX={m?.focalX}
      focalY={m?.focalY}
    />
  );
}
function Video({ item, assets }: { item: MediaItem; assets?: Asset[] }) {
  const [play, setPlay] = useState(false),
    [src, setSrc] = useState(""),
    [error, setError] = useState("");
  const link = videoLink(item.url || "");
  useEffect(() => {
    let blob = "",
      active = true;
    if (play && item.kind === "video") {
      const a = assets?.find((a) => a.id === item.asset);
      if (assets && a)
        privateMedia(a, "original")
          .then((u) => {
            blob = u;
            if (active) setSrc(u);
            else URL.revokeObjectURL(u);
          })
          .catch(() => setError("Video unavailable. Please try again."));
      else setSrc(publicMedia(item.asset!, "original"));
    }
    return () => {
      active = false;
      if (blob) URL.revokeObjectURL(blob);
    };
  }, [play, item.asset, assets, item.kind]);
  return (
    <div className="video-wrap">
      {!play ? (
        <button className="video-preview" onClick={() => setPlay(true)}>
          <AssetImage id={item.poster} assets={assets} alt="" />
          <span>
            <Play size={22} /> Play {item.title || "video"}
          </span>
        </button>
      ) : item.kind === "link" && link ? (
        <iframe
          src={link.embed}
          title={item.title || link.provider + " video"}
          allow="fullscreen; picture-in-picture"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
        />
      ) : src ? (
        <video
          controls
          playsInline
          preload="metadata"
          src={src}
          onError={() =>
            setError(
              "This browser cannot play the video. Download it or try another browser.",
            )
          }
        />
      ) : (
        <p role="status">Loading video…</p>
      )}
      {error && <p role="alert">{error}</p>}
      {link && (
        <p className="muted">
          Player unavailable?{" "}
          <a href={link.url} target="_blank" rel="noopener noreferrer">
            Watch on {link.provider} ↗
          </a>
        </p>
      )}
      {src && (
        <a href={src} target="_blank" rel="noopener noreferrer">
          Open original video ↗
        </a>
      )}
    </div>
  );
}
export function EntryDetail({
  entry,
  assets,
  preview = false,
}: {
  entry: Entry;
  assets?: Asset[];
  preview?: boolean;
}) {
  const [lightbox, setLightbox] = useState<number | null>(null);
  const images = entry.media.filter((m) => m.kind === "image");
  const change = (offset: number) =>
    setLightbox((i) =>
      i === null ? null : (i + offset + images.length) % images.length,
    );
  useEffect(() => {
    if (lightbox === null) return;
    const key = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") change(-1);
      if (e.key === "ArrowRight") change(1);
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [lightbox, images.length]);
  return (
    <article className="detail">
      <div className="eyebrow">
        {preview ? "Private preview · " : ""}
        {entry.category ||
          (entry.kind === "plugin" ? "Unturned plugin" : "Project")}
      </div>
      <h1>{entry.title}</h1>
      {entry.summary && <p className="lead">{entry.summary}</p>}
      <div className="tags">
        {entry.tags.map((t, i) => (
          <span key={i}>{t}</span>
        ))}
        {entry.version && <span>Version {entry.version}</span>}
        {entry.compatibility && <span>{entry.compatibility}</span>}
      </div>
      {entry.description && <p className="prose">{entry.description}</p>}
      {entry.features.length > 0 && (
        <section>
          <h2>Features</h2>
          <ul>
            {entry.features.map((f, i) => (
              <li key={i}>{f}</li>
            ))}
          </ul>
        </section>
      )}
      {entry.media.length > 0 && (
        <section className="gallery">
          {entry.media.map((m) => (
            <figure key={m.id}>
              {m.kind === "image" ? (
                <button
                  className="gallery-image"
                  aria-label={"Enlarge " + (m.alt || m.title || entry.title)}
                  onClick={() =>
                    setLightbox(images.findIndex((i) => i.id === m.id))
                  }
                >
                  <AssetImage
                    id={m.asset}
                    assets={assets}
                    alt={m.alt}
                    variant="display"
                  />
                </button>
              ) : (
                <Video item={m} assets={assets} />
              )}{" "}
              {m.caption && <figcaption>{m.caption}</figcaption>}
            </figure>
          ))}
        </section>
      )}
      {entry.comingSoon && !entry.media.some((m) => m.kind !== "image") && (
        <p className="notice">Video preview coming soon</p>
      )}
      {preview && entry.media.some((m) => m.kind === "link") && (
        <p className="notice">
          This entry is private. Linked videos follow the privacy settings on
          YouTube or Vimeo. Playing a video connects to that provider.
        </p>
      )}
      <div className="actions">
        {entry.links
          .filter((l) => l.label && safeUrl(l.url))
          .map((l, i) => (
            <a
              className="button"
              key={i}
              href={safeUrl(l.url)!}
              onClick={() => { if (!preview && l.type === 'Download') void recordActivity('download', entry.id); }}
              target={l.url.startsWith("https:") ? "_blank" : undefined}
              rel="noopener noreferrer"
            >
              {l.label}
              <ExternalLink size={15} />
            </a>
          ))}
      </div>
      {lightbox !== null && (
        <Modal
          title={`${lightbox + 1} / ${images.length}`}
          wide
          onClose={() => setLightbox(null)}
        >
          <div className="lightbox">
            <AssetImage
              id={images[lightbox].asset}
              assets={assets}
              alt={images[lightbox].alt}
              variant="display"
            />
            <p>{images[lightbox].caption}</p>
            <div className="actions">
              <button onClick={() => change(-1)} aria-label="Previous image">
                <ArrowLeft />
                Previous
              </button>
              <button onClick={() => change(1)} aria-label="Next image">
                Next
                <ArrowRight />
              </button>
            </div>
          </div>
        </Modal>
      )}
    </article>
  );
}
export function LinksEditor({
  value,
  onChange,
}: {
  value: Link[];
  onChange: (links: Link[]) => void;
}) {
  const update = (i: number, k: keyof Link, v: string) =>
    onChange(value.map((l, n) => (n === i ? { ...l, [k]: v } : l)));
  return (
    <div className="stack">
      {value.map((l, i) => (
        <div className="link-row" key={i}>
          <Field label="Button label">
            <input
              value={l.label}
              onChange={(e) => update(i, "label", e.target.value)}
              maxLength={80}
            />
          </Field>
          <Field label="URL">
            <input
              value={l.url}
              onChange={(e) => update(i, "url", e.target.value)}
              placeholder="https://…"
              aria-invalid={!!l.url && !safeUrl(l.url)}
            />
          </Field>
          <Field label="Link type">
            <select
              value={l.type || ""}
              onChange={(e) => update(i, "type", e.target.value)}
            >
              <option value="">Other</option>
              {["GitHub", "Download", "Documentation", "Contact"].map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </Field>
          <div className="actions">
            <button
              type="button"
              disabled={i === 0}
              onClick={() => onChange(move(value, i, i - 1))}
              aria-label={`Move link ${i + 1} up`}
            >
              ↑
            </button>
            <button
              type="button"
              disabled={i === value.length - 1}
              onClick={() => onChange(move(value, i, i + 1))}
              aria-label={`Move link ${i + 1} down`}
            >
              ↓
            </button>
            <button
              type="button"
              onClick={() => onChange(value.filter((_, n) => n !== i))}
            >
              Remove
            </button>
          </div>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...value, { label: "", url: "" }])}
      >
        + Add link
      </button>
    </div>
  );
}
