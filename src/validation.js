export function safeUrl(value, contact = true) {
  try {
    const u = new URL(value);
    return !u.username &&
      !u.password &&
      (u.protocol === "https:" || (contact && u.protocol === "mailto:"))
      ? u.href
      : null;
  } catch {
    return null;
  }
}
export function videoLink(value) {
  try {
    const u = new URL(value);
    if (u.protocol !== "https:" || u.username || u.password) return null;
    let id;
    if (
      ["youtube.com", "www.youtube.com", "m.youtube.com"].includes(u.hostname)
    )
      id =
        u.pathname === "/watch"
          ? u.searchParams.get("v")
          : u.pathname.match(/^\/(?:shorts|embed)\/([\w-]+)$/)?.[1];
    if (u.hostname === "youtu.be") id = u.pathname.slice(1);
    if (id && /^[\w-]{11}$/.test(id))
      return {
        provider: "YouTube",
        embed: `https://www.youtube-nocookie.com/embed/${id}`,
        url: `https://www.youtube.com/watch?v=${id}`,
      };
    if (
      ["vimeo.com", "www.vimeo.com", "player.vimeo.com"].includes(u.hostname)
    ) {
      const match = u.pathname.match(
        /^\/(?:video\/)?(\d+)(?:\/([a-zA-Z0-9]+))?$/,
      );
      if (match) {
        const hash = match[2] || u.searchParams.get("h");
        return {
          provider: "Vimeo",
          embed: `https://player.vimeo.com/video/${match[1]}${hash ? "?h=" + encodeURIComponent(hash) : ""}`,
          url: u.href,
        };
      }
    }
  } catch {}
  return null;
}
export const limits = { image: 12 * 1024 * 1024, video: 40 * 1024 * 1024 };
export function sniff(bytes) {
  const b = bytes;
  const ascii = (a, z) => String.fromCharCode(...b.slice(a, z));
  if (b[0] === 255 && b[1] === 216 && b[2] === 255) return "image/jpeg";
  if (
    b[0] === 137 &&
    ascii(1, 4) === "PNG" &&
    b[4] === 13 &&
    b[5] === 10 &&
    b[6] === 26 &&
    b[7] === 10
  )
    return "image/png";
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "image/webp";
  if (
    ascii(4, 8) === "ftyp" &&
    /^(isom|iso2|mp41|mp42|avc1|M4V )$/.test(ascii(8, 12))
  )
    return "video/mp4";
  if (
    b[0] === 26 &&
    b[1] === 69 &&
    b[2] === 223 &&
    b[3] === 163 &&
    ascii(0, 128).includes("webm")
  )
    return "video/webm";
  return null;
}
export function move(items, from, to) {
  const copy = [...items];
  if (from < 0 || to < 0 || from >= copy.length || to >= copy.length)
    return copy;
  copy.splice(to, 0, copy.splice(from, 1)[0]);
  return copy;
}
