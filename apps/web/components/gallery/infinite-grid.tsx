"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

// Port of the Framer "InfiniteGrid" component: a fixed pool of cells drifts
// toward the pointer, wraps around a shuffled tile of photos, and magnifies
// the cells nearest the cursor. Cells are never remounted while moving; only
// their image source changes when the grid crosses a cell boundary.

const OVERSCAN = 2;
const DRAG_THRESHOLD = 6;
const MAX_SPEED = 260;
const DAMPING = 0.7;
const MAGNIFY = 0.45;
const RADIUS = 220;

type Cell = {
  button: HTMLButtonElement;
  img: HTMLImageElement;
  row: number;
  col: number;
  gx: number;
  gy: number;
  src: string;
};

type Layout = {
  width: number;
  height: number;
  itemSize: number;
  gap: number;
};

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));
const lerp = (from: number, to: number, t: number) => from + (to - from) * t;
const mod = (n: number, m: number) => ((n % m) + m) % m;

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Builds a repeating tile that avoids placing the same photo next to itself.
function buildTile(count: number, size: number, seed: number) {
  const tile = new Int32Array(size * size);
  if (count <= 0) return tile;
  const random = mulberry32(seed);
  const bag = Array.from({ length: count }, (_, i) => i);
  const shuffle = () => {
    for (let i = bag.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [bag[i], bag[j]] = [bag[j] as number, bag[i] as number];
    }
  };
  shuffle();
  let pointer = 0;
  const next = () => {
    const value = bag[pointer++ % bag.length] as number;
    if (pointer % bag.length === 0) shuffle();
    return value;
  };
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const neighbors = [
        x > 0 ? tile[y * size + x - 1] : -1,
        y > 0 ? tile[(y - 1) * size + x] : -1,
        x > 0 && y > 0 ? tile[(y - 1) * size + x - 1] : -1,
        x < size - 1 && y > 0 ? tile[(y - 1) * size + x + 1] : -1,
      ];
      let index = next();
      for (let tries = 0; tries < 80 && neighbors.includes(index); tries++) {
        index = next();
      }
      tile[y * size + x] = index;
    }
  }
  return tile;
}

function layoutFor(width: number, height: number): Layout {
  if (width < 640) return { width, height, itemSize: 150, gap: 16 };
  return { width, height, itemSize: 240, gap: 36 };
}

export function InfiniteGrid({
  sources,
  labels,
  onOpen,
}: {
  readonly sources: readonly string[];
  readonly labels: readonly string[];
  readonly onOpen: (index: number) => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<HTMLDivElement>(null);
  const cellsRef = useRef<Cell[]>([]);
  const [layout, setLayout] = useState<Layout | null>(null);

  const pointer = useRef({ x: 0, y: 0, inside: false });
  const target = useRef({ x: 0, y: 0 });
  const smooth = useRef({ x: 0, y: 0 });
  const offset = useRef({ x: 0, y: 0 });
  const velocity = useRef({ x: 0, y: 0 });
  const baseCell = useRef({ bx: 0, by: 0 });
  const drag = useRef({
    id: -1,
    startX: 0,
    startY: 0,
    lastX: 0,
    lastY: 0,
    lastTime: 0,
    moved: false,
    flingX: 0,
    flingY: 0,
  });
  const suppressClick = useRef(false);

  const itemSize = layout?.itemSize ?? 0;
  const step = layout ? layout.itemSize + layout.gap : 1;
  const cols = layout ? Math.ceil(layout.width / step) + 2 * OVERSCAN : 0;
  const rows = layout ? Math.ceil(layout.height / step) + 2 * OVERSCAN : 0;
  const tileSize = clamp(
    Math.ceil(Math.sqrt(clamp(sources.length * 3, 81, 256))),
    9,
    18,
  );
  const tile = useMemo(
    () => buildTile(sources.length, tileSize, sources.length * 2654435761),
    [sources.length, tileSize],
  );

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const observer = new ResizeObserver(([entry]) => {
      const rect = entry?.contentRect;
      if (!rect || rect.width < 10 || rect.height < 10) return;
      setLayout(layoutFor(rect.width, rect.height));
    });
    observer.observe(root);
    return () => observer.disconnect();
  }, []);

  const assign = useCallback(() => {
    const { bx, by } = baseCell.current;
    for (const cell of cellsRef.current) {
      const gx = bx + cell.col - OVERSCAN;
      const gy = by + cell.row - OVERSCAN;
      if (gx === cell.gx && gy === cell.gy) continue;
      cell.gx = gx;
      cell.gy = gy;
      const index =
        (tile[mod(gy, tileSize) * tileSize + mod(gx, tileSize)] ?? 0) %
        sources.length;
      const src = sources[index] ?? "";
      cell.button.dataset.index = String(index);
      cell.button.setAttribute("aria-label", labels[index] ?? "");
      if (cell.src !== src) {
        cell.src = src;
        cell.img.src = src;
      }
    }
  }, [labels, sources, tile, tileSize]);

  // Rebuild the cell pool and reassign photos whenever the grid changes shape.
  useLayoutEffect(() => {
    const world = worldRef.current;
    if (!world || !rows || !cols || !step) return;
    offset.current = { x: 0, y: 0 };
    velocity.current = { x: 0, y: 0 };
    baseCell.current = { bx: 0, by: 0 };
    const cells: Cell[] = [];
    for (const button of world.querySelectorAll<HTMLButtonElement>(
      "button[data-row]",
    )) {
      const img = button.querySelector("img");
      if (!img) continue;
      cells.push({
        button,
        img,
        row: Number(button.dataset.row),
        col: Number(button.dataset.col),
        gx: Number.NaN,
        gy: Number.NaN,
        src: img.getAttribute("src") ?? "",
      });
    }
    cellsRef.current = cells;
    assign();
  }, [rows, cols, step, assign]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const onMove = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return;
      const rect = root.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      const inside = x >= 0 && y >= 0 && x <= rect.width && y <= rect.height;
      pointer.current = { x, y, inside };
      target.current = inside
        ? {
            x: clamp(x / rect.width - 0.5, -0.5, 0.5),
            y: clamp(y / rect.height - 0.5, -0.5, 0.5),
          }
        : { x: 0, y: 0 };
    };
    const onLeave = () => {
      pointer.current.inside = false;
      target.current = { x: 0, y: 0 };
    };
    window.addEventListener("pointermove", onMove, { capture: true });
    window.addEventListener("blur", onLeave);
    document.documentElement.addEventListener("pointerleave", onLeave);
    return () => {
      window.removeEventListener("pointermove", onMove, { capture: true });
      window.removeEventListener("blur", onLeave);
      document.documentElement.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  useEffect(() => {
    if (!rows || !cols || !worldRef.current) return;
    const world = worldRef.current;
    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const maxSpeed = reducedMotion ? 0 : MAX_SPEED;
    const magnify = reducedMotion ? 0 : MAGNIFY;
    const sigma2 = 2 * (RADIUS * 0.55) ** 2;
    let frame = 0;
    let last = performance.now();

    const tick = () => {
      const now = performance.now();
      const dt = Math.min(0.033, (now - last) / 1000);
      last = now;
      const dragging = drag.current.id !== -1;
      const k = clamp(1 - DAMPING, 0.03, 0.35);

      if (dragging) {
        velocity.current = { x: 0, y: 0 };
      } else if (drag.current.flingX || drag.current.flingY) {
        const decay = Math.exp(-dt * 4);
        drag.current.flingX *= decay;
        drag.current.flingY *= decay;
        if (Math.hypot(drag.current.flingX, drag.current.flingY) < 5) {
          drag.current.flingX = 0;
          drag.current.flingY = 0;
        }
        offset.current.x += drag.current.flingX * dt;
        offset.current.y += drag.current.flingY * dt;
      } else {
        smooth.current.x = lerp(smooth.current.x, target.current.x, k);
        smooth.current.y = lerp(smooth.current.y, target.current.y, k);
        const inside = pointer.current.inside;
        const cx = inside ? smooth.current.x / 0.5 : 0;
        const cy = inside ? smooth.current.y / 0.5 : 0;
        velocity.current.x = lerp(velocity.current.x, cx * maxSpeed, k);
        velocity.current.y = lerp(velocity.current.y, cy * maxSpeed, k);
        offset.current.x += velocity.current.x * dt;
        offset.current.y += velocity.current.y * dt;
      }

      const bx = Math.floor(offset.current.x / step);
      const by = Math.floor(offset.current.y / step);
      const lx = offset.current.x - bx * step;
      const ly = offset.current.y - by * step;
      if (bx !== baseCell.current.bx || by !== baseCell.current.by) {
        baseCell.current = { bx, by };
        assign();
      }
      world.style.transform = `translate3d(${-lx}px, ${-ly}px, 0)`;

      const focused = pointer.current.inside && !dragging && magnify > 0;
      for (const cell of cellsRef.current) {
        let scale = 1;
        if (focused) {
          const dx = cell.col * step - lx + itemSize / 2 - pointer.current.x;
          const dy = cell.row * step - ly + itemSize / 2 - pointer.current.y;
          scale = 1 + magnify * Math.exp(-(dx * dx + dy * dy) / sigma2);
        }
        cell.button.style.setProperty("--s", scale.toFixed(4));
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [rows, cols, step, itemSize, assign]);

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    drag.current = {
      id: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      lastX: event.clientX,
      lastY: event.clientY,
      lastTime: performance.now(),
      moved: false,
      flingX: 0,
      flingY: 0,
    };
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const state = drag.current;
    if (state.id !== event.pointerId) return;
    if (
      !state.moved &&
      Math.hypot(event.clientX - state.startX, event.clientY - state.startY) <
        DRAG_THRESHOLD
    ) {
      return;
    }
    if (!state.moved) {
      state.moved = true;
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    const now = performance.now();
    const dx = event.clientX - state.lastX;
    const dy = event.clientY - state.lastY;
    const dt = Math.max(1, now - state.lastTime) / 1000;
    offset.current.x -= dx;
    offset.current.y -= dy;
    state.flingX = lerp(state.flingX, -dx / dt, 0.5);
    state.flingY = lerp(state.flingY, -dy / dt, 0.5);
    state.lastX = event.clientX;
    state.lastY = event.clientY;
    state.lastTime = now;
  };

  const endDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    const state = drag.current;
    if (state.id !== event.pointerId) return;
    suppressClick.current = state.moved;
    if (performance.now() - state.lastTime > 80) {
      state.flingX = 0;
      state.flingY = 0;
    }
    state.id = -1;
  };

  const onClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (suppressClick.current) {
      suppressClick.current = false;
      return;
    }
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>(
      "button[data-index]",
    );
    if (button) onOpen(Number(button.dataset.index));
  };

  const cells = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const key = `${row}:${col}`;
      cells.push(
        <button
          className="absolute block cursor-zoom-in overflow-hidden bg-muted outline-none [transform:scale(var(--s,1))] focus-visible:ring-2 focus-visible:ring-primary"
          key={key}
          data-col={col}
          data-row={row}
          style={{
            left: col * step,
            top: row * step,
            width: itemSize,
            height: itemSize,
            willChange: "transform",
          }}
          type="button"
        >
          {/* biome-ignore lint/performance/noImgElement: cells swap src imperatively while the grid moves */}
          <img
            alt=""
            className="pointer-events-none size-full object-cover"
            decoding="async"
            draggable={false}
          />
        </button>,
      );
    }
  }

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: drag surface; each photo is its own button
    // biome-ignore lint/a11y/useKeyWithClickEvents: clicks are delegated to the photo buttons
    <div
      className="relative size-full touch-none overflow-hidden select-none"
      onClick={onClick}
      onPointerCancel={endDrag}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      ref={rootRef}
    >
      <div
        className="absolute top-0 left-0 will-change-transform"
        ref={worldRef}
        style={{ width: cols * step, height: rows * step }}
      >
        {cells}
      </div>
    </div>
  );
}
