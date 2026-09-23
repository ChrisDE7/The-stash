import { createClient } from "@supabase/supabase-js";
import { sniff, limits } from "./validation.js";
import type { Entry, Settings, Asset } from "./types";
export const url = import.meta.env.VITE_SUPABASE_URL || "";
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "";
export const configured = !!(url && key);
export const db = configured
  ? createClient(url, key, {
      auth: {
        persistSession: false,
        detectSessionInUrl: false,
        autoRefreshToken: true,
      },
    })
  : null;
export const defaults: Settings = {
  title: "The Stash",
  intro: "Unturned maps, plugins & creative work by Chris.",
  about: "Websites, game maps, experiments, and creative tech work.",
  contactIntro: "Reach out for project and server work.",
  discord: "_7bush7",
  links: [
    { label: "Email Chris", url: "mailto:chrisdesigningenterprises@gmail.com" },
    { label: "GitHub", url: "https://github.com/ChrisDE7" },
  ],
  categories: ["Unturned", "Websites"],
  featured: [],
  description: "The Stash — Unturned maps, plugins and creative work by Chris.",
};
export async function query<R extends { data: unknown; error: any }>(
  p: PromiseLike<R>,
): Promise<NonNullable<R["data"]>> {
  const { data, error } = await p;
  if (error) throw new Error(error.message);
  return data as NonNullable<R["data"]>;
}
export function publicMedia(id: string, variant = "display") {
  return `${url}/functions/v1/media?id=${encodeURIComponent(id)}&variant=${encodeURIComponent(variant)}`;
}
export async function privateMedia(asset: Asset, variant = "thumb") {
  const path = asset.variants[variant] || asset.variants.original;
  const b = await query(db!.storage.from("portfolio").download(path));
  return URL.createObjectURL(b);
}
export async function saveEntry(entry: Entry, publish = false) {
  await query(db!.rpc("save_entry", { entry, publish_now: publish }));
}
export async function setSettings(settings: Settings) {
  await query(db!.from("site_settings").upsert({ id: 1, content: settings }));
}
export async function upload(
  file: Blob,
  name: string,
  onProgress: (n: number) => void,
) {
  const session = (await db!.auth.getSession()).data.session;
  if (!session) throw new Error("Please sign in again.");
  const form = new FormData();
  form.append("file", file, name);

  const mime = sniff(new Uint8Array(await file.slice(0, 256).arrayBuffer()));
  if (!mime || mime !== file.type)
    throw new Error(
      "Use a JPEG, PNG, WebP, MP4 or WebM file with matching contents.",
    );
  if (file.size > (mime.startsWith("image") ? limits.image : limits.video))
    throw new Error(
      "Images can be up to 12 MB; videos up to 40 MB. Use a YouTube or Vimeo link for larger videos.",
    );
  let source: CanvasImageSource,
    width: number,
    height: number,
    cleanup: () => void;
  if (mime.startsWith("image/")) {
    const bitmap = await createImageBitmap(file);
    source = bitmap;
    width = bitmap.width;
    height = bitmap.height;
    cleanup = () => bitmap.close();
  } else {
    const video = document.createElement("video"),
      local = URL.createObjectURL(file);
    video.muted = true;
    video.preload = "auto";
    video.playsInline = true;
    try {
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(
          () =>
            reject(
              new Error(
                "Video preview could not be read. Convert to MP4 with H.264/AAC or WebM, or use a video link.",
              ),
            ),
          15000,
        );
        video.onloadeddata = () => {
          clearTimeout(timer);
          resolve();
        };
        video.onerror = () => {
          clearTimeout(timer);
          reject(
            new Error(
              "This browser cannot decode the video. Convert to MP4 with H.264/AAC or WebM, or use a video link.",
            ),
          );
        };
        video.src = local;
      });
    } catch (e) {
      URL.revokeObjectURL(local);
      throw e;
    }
    source = video;
    width = video.videoWidth;
    height = video.videoHeight;
    cleanup = () => {
      video.removeAttribute("src");
      video.load();
      URL.revokeObjectURL(local);
    };
  }
  try {
    for (const [variant, max] of [
      ["display", 1920],
      ["thumb", 640],
    ] as const) {
      const scale = Math.min(1, max / width, max / height),
        canvas = document.createElement("canvas");
      canvas.width = Math.round(width * scale);
      canvas.height = Math.round(height * scale);
      canvas
        .getContext("2d")!
        .drawImage(source, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(
          (b) =>
            b
              ? resolve(b)
              : reject(new Error("Could not create image preview")),
          "image/webp",
          0.88,
        ),
      );
      form.append(variant, blob, variant + ".webp");
    }
  } finally {
    cleanup();
  }
  return new Promise<Asset>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${url}/functions/v1/upload`);
    xhr.timeout = 180000;
    xhr.setRequestHeader("Authorization", `Bearer ${session.access_token}`);
    xhr.setRequestHeader("apikey", key);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 90));
    };
    xhr.onerror = () =>
      reject(
        new Error(
          "Connection lost. Your information is still here. Retry the upload.",
        ),
      );
    xhr.ontimeout = () =>
      reject(new Error("Upload timed out. Retry on a stable connection."));
    xhr.onload = () => {
      try {
        const r = JSON.parse(xhr.responseText);
        if (xhr.status >= 400) throw new Error(r.error || "Upload failed");
        onProgress(100);
        resolve(r);
      } catch (e) {
        reject(e);
      }
    };
    xhr.send(form);
  });
}
export async function removeAsset(id: string) {
  const session = (await db!.auth.getSession()).data.session;
  const r = await fetch(`${url}/functions/v1/upload?id=${id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${session?.access_token}`, apikey: key },
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error);
}
