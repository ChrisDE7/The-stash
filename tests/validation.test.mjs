import test from "node:test";
import assert from "node:assert/strict";
import { safeUrl, videoLink, sniff, move } from "../src/validation.js";
test("links reject active content, relative links and embedded credentials", () => {
  for (const value of [
    "javascript:alert(1)",
    "data:text/html,hello",
    "#",
    "http://example.com",
    "https://user:pass@example.com",
  ])
    assert.equal(safeUrl(value), null);
  assert.equal(
    safeUrl("https://github.com/ChrisDE7"),
    "https://github.com/ChrisDE7",
  );
  assert.equal(
    safeUrl("mailto:chrisdesigningenterprises@gmail.com"),
    "mailto:chrisdesigningenterprises@gmail.com",
  );
});
test("video providers use exact hostnames and fixed embed origins", () => {
  assert.equal(
    videoLink("https://youtu.be/abcdefghijk").embed,
    "https://www.youtube-nocookie.com/embed/abcdefghijk",
  );
  assert.equal(
    videoLink("https://www.youtube.com/watch?v=abcdefghijk&t=20").url,
    "https://www.youtube.com/watch?v=abcdefghijk",
  );
  assert.equal(
    videoLink("https://vimeo.com/123456/secret").embed,
    "https://player.vimeo.com/video/123456?h=secret",
  );
  for (const value of [
    "https://youtube.com.evil.com/watch?v=abcdefghijk",
    "https://evil.com",
    "javascript:alert(1)",
    "https://youtube.com/watch?v=short",
    "<iframe>",
    "https://vimeo.com/abc",
  ])
    assert.equal(videoLink(value), null);
});
test("media signatures reject renamed HTML and SVG", () => {
  const bytes = (s) => new TextEncoder().encode(s);
  assert.equal(sniff(bytes('<svg onload="alert(1)">')), null);
  assert.equal(sniff(bytes("<html>fake.png</html>")), null);
  assert.equal(sniff(new Uint8Array([255, 216, 255, 0])), "image/jpeg");
  assert.equal(
    sniff(new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])),
    "image/png",
  );
  assert.equal(sniff(bytes("RIFFxxxxWEBP")), "image/webp");
  assert.equal(sniff(bytes("xxxxftypisom")), "video/mp4");
  assert.equal(sniff(bytes("xxxxftypheic")), null);
});
test("mixed media reorder preserves every item without mutating source", () => {
  const items = [{ kind: "image" }, { kind: "link" }, { kind: "video" }];
  assert.deepEqual(move(items, 2, 0), [items[2], items[0], items[1]]);
  assert.equal(items[0].kind, "image");
  assert.deepEqual(move(items, 0, -1), items);
});
