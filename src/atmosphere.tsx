import { useEffect, useRef } from "react";

// Contours of one continuous elevation field avoid gaps between isolated islands.
const contours: number[][][] = [];
const step = 16;
const elevation = (x: number, y: number) =>
  Math.sin(x * .009 + Math.sin(y * .006) * 1.7) +
  Math.cos(y * .011 + Math.sin(x * .005) * 1.3) +
  .45 * Math.sin((x + y) * .017);
for (let level = -2.3; level <= 2.3; level += .16) {
  const nodes = new Map<string, { point: number[]; neighbors: string[] }>();
  const key = (p: number[]) => p.map(v => v.toFixed(3)).join(",");
  const connect = (a: number[], b: number[]) => {
    const ka = key(a), kb = key(b);
    if (!nodes.has(ka)) nodes.set(ka, { point: a, neighbors: [] });
    if (!nodes.has(kb)) nodes.set(kb, { point: b, neighbors: [] });
    nodes.get(ka)!.neighbors.push(kb); nodes.get(kb)!.neighbors.push(ka);
  };
  for (let y = -160; y < 1160; y += step) {
    for (let x = -160; x < 1760; x += step) {
      const corners = [[x,y], [x+step,y], [x+step,y+step], [x,y+step]];
      const values = corners.map(([px,py]) => elevation(px,py));
      const crossings: number[][] = [];
      for (let i = 0; i < 4; i++) {
        const j = (i+1)%4;
        if ((values[i] >= level) === (values[j] >= level)) continue;
        const t = (level-values[i])/(values[j]-values[i]);
        crossings.push([corners[i][0]+t*(corners[j][0]-corners[i][0]), corners[i][1]+t*(corners[j][1]-corners[i][1])]);
      }
      for (let i = 0; i+1 < crossings.length; i += 2) connect(crossings[i],crossings[i+1]);
    }
  }
  const visited = new Set<string>();
  // Trace boundary lines first, then closed contours.
  const starts = [...nodes.keys()].sort((a,b) => nodes.get(a)!.neighbors.length - nodes.get(b)!.neighbors.length);
  for (const start of starts) {
    if (visited.has(start)) continue;
    const points: number[][] = [];
    let current: string | undefined = start;
    while (current && !visited.has(current)) {
      visited.add(current);
      const node: { point: number[]; neighbors: string[] } = nodes.get(current)!;
      points.push(node.point);
      const next: string | undefined = node.neighbors.find(n => !visited.has(n));
      if (!next && node.neighbors.includes(start)) points.push(nodes.get(start)!.point);
      current = next;
    }
    if (points.length > 3) contours.push(points);
  }
}
const path = (points: number[][]) => points.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");

export default function Atmosphere() {
  const pointer = useRef<HTMLDivElement>(null);
  const terrain = useRef<SVGSVGElement>(null);
  useEffect(() => {
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    const fine = matchMedia("(pointer: fine)");
    const paths = terrain.current?.querySelectorAll("path");
    let frame = 0, last = 0, active = false, strength = 0;
    let x = innerWidth / 2, y = innerHeight / 2, targetX = x, targetY = y;
    let width = innerWidth, height = innerHeight;
    const hide = () => { active = false; if (pointer.current) pointer.current.style.opacity = "0"; };
    const resize = () => { width = innerWidth; height = innerHeight; };
    const move = (event: PointerEvent) => {
      if (reduced.matches || !fine.matches || event.pointerType === "touch") return;
      targetX = event.clientX; targetY = event.clientY;
      if (!active) { x = targetX; y = targetY; }
      active = true;
      if (pointer.current) {
        pointer.current.style.opacity = "1";
        pointer.current.classList.toggle("over-control", !!(event.target as Element).closest("a, button"));
      }
    };
    const draw = (now: number) => {
      if (document.hidden || reduced.matches) return;
      frame = requestAnimationFrame(draw);
      const delta = Math.min(now - last, 60);
      if (delta < 30) return;
      last = now;
      const easing = 1 - Math.exp(-delta / 85);
      x += (targetX - x) * easing; y += (targetY - y) * easing;
      strength += ((active ? 1 : 0) - strength) * easing;
      if (pointer.current) pointer.current.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      const scale = Math.max(width / 1600, height / 1000);
      const px = (x - (width - 1600 * scale) / 2) / scale;
      const py = (y - (height - 1000 * scale) / 2) / scale;
      const time = now * .00032;
      paths?.forEach((element, ring) => {
        const points = contours[ring].map(([baseX, baseY]) => {
          let cx = baseX + 72 * Math.sin(time + baseY * .004) + 34 * Math.cos(time * .7 + baseX * .003);
          let cy = baseY + 58 * Math.cos(time * .8 + baseX * .004);
          const dx = cx - px, dy = cy - py;
          const distance = Math.hypot(dx, dy);
          const radius = 210 / scale;
          const force = 85 / scale * Math.exp(-distance * distance / (radius * radius)) * strength;
          // Smooth radial displacement: nearby contours part and settle behind the cursor.
          cx += dx / Math.max(distance, 35 / scale) * force;
          cy += dy / Math.max(distance, 35 / scale) * force;
          return [cx, cy];
        });
        element.setAttribute("d", path(points));
      });
    };
    const restart = () => {
      cancelAnimationFrame(frame); hide();
      if (reduced.matches) paths?.forEach((element, i) => element.setAttribute("d", path(contours[i])));
      else if (!document.hidden) { last = 0; frame = requestAnimationFrame(draw); }
    };
    window.addEventListener("pointermove", move, { passive: true });
    window.addEventListener("resize", resize);
    document.documentElement.addEventListener("pointerleave", hide);
    window.addEventListener("blur", hide);
    document.addEventListener("visibilitychange", restart);
    reduced.addEventListener("change", restart);
    fine.addEventListener("change", hide);
    restart();
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("resize", resize);
      document.documentElement.removeEventListener("pointerleave", hide);
      window.removeEventListener("blur", hide);
      document.removeEventListener("visibilitychange", restart);
      reduced.removeEventListener("change", restart);
      fine.removeEventListener("change", hide);
    };
  }, []);
  return <>
    <div className="terrain-background" aria-hidden="true">
      <div className="terrain-colors" />
      <svg ref={terrain} className="terrain-lines" viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice">
        {contours.map((points, i) => <path key={i} d={path(points)} className={i % 4 === 0 ? "major-contour" : undefined} />)}
      </svg>
    </div>
    <div ref={pointer} className="terrain-pointer" aria-hidden="true"><span className="crosshair" /></div>
  </>;
}

