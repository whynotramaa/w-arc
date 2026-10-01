"use client";

import { useEffect, useMemo, useRef, useState, type PointerEvent as RPointerEvent } from "react";
import rough from "roughjs";
import QRCode from "qrcode";
import {
  BringToFront, Check, Circle, Copy, Diamond, Eraser, ImagePlus, Minus, MousePointer2, MoveUpRight, PanelRightClose, PanelRightOpen, Pencil, Plus,
  Redo2, Search, SendToBack, Shapes, Smartphone, Square, Trash2, Type, Undo2, Video, VideoOff, X,
} from "lucide-react";
import { ASSETS, ASSET_GROUPS } from "@/lib/assets";
import { LOGOS, LOGO_MAP, isDark } from "@/lib/logos";
import { FONT_GROUPS } from "@/lib/fonts";
import {
  BOARDS, BH, BW, FULL, drawBoard, drawElement, hitTest, measureText, norm, paintAvatar,
  type BoardId, type El, type ElType, type P, type Page, type Rect, type Style,
} from "@/lib/scene";

type Tool = "select" | "pen" | "rect" | "diamond" | "ellipse" | "arrow" | "line" | "text" | "eraser";
type Layout = "off" | "bubble" | "pip" | "side" | "overlay";
type Source = "none" | "webcam" | "phone";
type Drag =
  | { kind: "create" }
  | { kind: "erase" }
  | { kind: "move"; start: P; orig: El; handle: number }
  | { kind: "resize"; start: P; orig: El; handle: number };
type Item = { id: string; label: string; group: string };

const TOOLS: { id: Tool; icon: typeof Square; key: string; label: string }[] = [
  { id: "select", icon: MousePointer2, key: "v", label: "Select" },
  { id: "pen", icon: Pencil, key: "p", label: "Pen" },
  { id: "rect", icon: Square, key: "r", label: "Rectangle" },
  { id: "diamond", icon: Diamond, key: "d", label: "Diamond" },
  { id: "ellipse", icon: Circle, key: "o", label: "Ellipse" },
  { id: "arrow", icon: MoveUpRight, key: "a", label: "Arrow" },
  { id: "line", icon: Minus, key: "l", label: "Line" },
  { id: "text", icon: Type, key: "t", label: "Text" },
  { id: "eraser", icon: Eraser, key: "e", label: "Eraser" },
];

const LAYOUTS: { id: Layout; label: string }[] = [
  { id: "off", label: "Board" },
  { id: "bubble", label: "Bubble" },
  { id: "pip", label: "PiP" },
  { id: "side", label: "Side" },
  { id: "overlay", label: "Overlay" },
];

type Frame = { board: Rect; cam: Rect; radius: number; camAlpha: number; bgAlpha: number };
const BUBBLE: Rect = { x: 1520, y: 680, w: 360, h: 360 };
const FRAMES: Record<Layout, Frame> = {
  off: { board: FULL, cam: BUBBLE, radius: 180, camAlpha: 0, bgAlpha: 1 },
  bubble: { board: FULL, cam: BUBBLE, radius: 180, camAlpha: 1, bgAlpha: 1 },
  pip: { board: FULL, cam: { x: 1420, y: 758, w: 460, h: 259 }, radius: 22, camAlpha: 1, bgAlpha: 1 },
  side: { board: { x: 0, y: 180, w: 1280, h: 720 }, cam: { x: 1300, y: 40, w: 580, h: 1000 }, radius: 24, camAlpha: 1, bgAlpha: 1 },
  overlay: { board: FULL, cam: FULL, radius: 0, camAlpha: 1, bgAlpha: 0 },
};

const STROKES = ["ink", "#e03131", "#f08c00", "#2f9e44", "#1971c2", "#7048e8", "#c2255c", "#ffffff"];
const FILLS = ["#ff8787", "#ffa94d", "#ffd43b", "#69db7c", "#4dabf7", "#9775fa", "#f783ac", "#868e96"];
const WIDTHS: [number, string][] = [[2, "Thin"], [4, "Bold"], [7, "Heavy"]];
const ROUGHNESS: [number, string][] = [[0, "Clean"], [1.5, "Sketchy"], [2.8, "Wild"]];
const FILL_STYLES: [Style["fillStyle"], string][] = [["none", "None"], ["hachure", "Hatch"], ["cross-hatch", "Cross"], ["zigzag", "Zigzag"], ["solid", "Solid"]];
const SIZES: [number, string][] = [[28, "S"], [40, "M"], [64, "L"], [96, "XL"]];
const AVATAR_BGS = ["#ffe3e3", "#fff3bf", "#d3f9d8", "#d0ebff", "#e5dbff", "#f1f3f5"];
const STORAGE = "flacko:v1";
const AVATAR_KEY = "flacko:avatar";
const HANDLE = 14;
const SKETCHES: Item[] = ASSETS;
const CATALOG: Item[] = [...ASSETS, ...LOGOS];
const LOGO_GROUPS = [...new Set(LOGOS.map(l => l.group))];

const uid = () => crypto.randomUUID();
const newPage = (board: BoardId = "paper"): Page => ({ id: uid(), board, elements: [] });
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const lerpRect = (a: Rect, b: Rect, k: number): Rect => ({ x: lerp(a.x, b.x, k), y: lerp(a.y, b.y, k), w: lerp(a.w, b.w, k), h: lerp(a.h, b.h, k) });
const corners = (r: Rect): P[] => [[r.x, r.y], [r.x + r.w, r.y], [r.x + r.w, r.y + r.h], [r.x, r.y + r.h]];
const isLine = (e: El) => e.type === "line" || e.type === "arrow";
const handlesOf = (e: El): P[] => (isLine(e) ? [[e.x, e.y], [e.x + e.w, e.y + e.h]] : corners(norm(e)));
const preferAv1 = (sdp: string) => {
  const av1 = [...sdp.matchAll(/a=rtpmap:(\d+) AV1\//g)].map(m => m[1]);
  return sdp.replace(/^(m=video \S+ \S+) ([^\r\n]+)$/m, (_, head: string, pts: string) => [head, ...av1, ...pts.split(" ").filter(pt => !av1.includes(pt))].join(" "));
};
const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
const pct = (r: Rect) => ({ left: `${(r.x / BW) * 100}%`, top: `${(r.y / BH) * 100}%`, width: `${(r.w / BW) * 100}%`, height: `${(r.h / BH) * 100}%` });
const matches = (q: string) => (a: Item) => !q || `${a.label} ${a.group}`.toLowerCase().includes(q);

export default function Studio() {
  const doc = useRef<{ pages: Page[]; current: number }>({ pages: [newPage()], current: 0 });
  const version = useRef(0);
  const past = useRef<string[]>([]);
  const future = useRef<string[]>([]);
  const drag = useRef<Drag | null>(null);
  const frame = useRef<Frame>({ ...FRAMES.off });
  const outRef = useRef<HTMLCanvasElement>(null);
  const uiRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const avatarRef = useRef<HTMLCanvasElement | null>(null);
  const measureCtx = useRef<CanvasRenderingContext2D | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const peer = useRef<import("peerjs").Peer | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);

  const [, setTick] = useState(0);
  const [tool, setTool] = useState<Tool>("select");
  const [selected, setSelected] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [layout, setLayout] = useState<Layout>("off");
  const [style, setStyle] = useState<Style>({ stroke: "ink", fill: FILLS[4], fillStyle: "none", strokeWidth: 4, roughness: 1.5, font: "Virgil", fontSize: 40 });
  const [assetsOpen, setAssetsOpen] = useState(false);
  const [assetTab, setAssetTab] = useState<"sketches" | "logos">("sketches");
  const [assetQuery, setAssetQuery] = useState("");
  const [palette, setPalette] = useState<{ q: string; i: number } | null>(null);
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const [boardThumbs, setBoardThumbs] = useState<Record<string, string>>({});
  const [source, setSource] = useState<Source>("none");
  const [camError, setCamError] = useState("");
  const [phoneOpen, setPhoneOpen] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(true);
  const [qr, setQr] = useState("");
  const [recording, setRecording] = useState<number | null>(null);
  const [stageWidth, setStageWidth] = useState(1);
  const [avatar, setAvatar] = useState<{ bg: string; photo: string }>({ bg: AVATAR_BGS[3], photo: "" });
  const [avatarUrl, setAvatarUrl] = useState("");

  const live = useRef({ selected, layout, tool, source });
  live.current = { selected, layout, tool, source };

  const page = () => doc.current.pages[doc.current.current];
  const ink = () => BOARDS[page().board].ink;
  const find = (id: string | null) => page().elements.find(e => e.id === id);
  const sel = find(selected);
  const current: Style = sel ?? style;
  const selLogo = sel?.type === "asset" ? LOGO_MAP[sel.asset ?? ""] : undefined;

  const invalidate = () => version.current++;
  const changed = () => {
    invalidate();
    setTick(t => t + 1);
    try { localStorage.setItem(STORAGE, JSON.stringify(doc.current)); } catch {}
  };
  const checkpoint = () => {
    past.current.push(JSON.stringify(doc.current));
    if (past.current.length > 100) past.current.shift();
    future.current = [];
  };
  const restore = (from: string[], to: string[]) => {
    const s = from.pop();
    if (!s) return;
    to.push(JSON.stringify(doc.current));
    doc.current = JSON.parse(s);
    setSelected(null);
    setEditing(null);
    changed();
  };
  const undo = () => restore(past.current, future.current);
  const redo = () => restore(future.current, past.current);

  const remeasure = (e: El) => {
    if (e.type !== "text" || !measureCtx.current) return;
    Object.assign(e, measureText(measureCtx.current, e));
  };
  const loadFont = (f: string) => document.fonts.load(`40px "${f}"`).then(() => {
    page().elements.filter(e => e.font === f).forEach(remeasure);
    invalidate();
  });

  const make = (type: ElType, at: P, extra: Partial<El> = {}): El => ({
    ...style,
    stroke: style.stroke === "ink" ? ink() : style.stroke,
    id: uid(), type, x: at[0], y: at[1], w: 0, h: 0, seed: Math.floor(Math.random() * 2 ** 31),
    ...extra,
  });

  const remove = (id: string) => {
    page().elements = page().elements.filter(e => e.id !== id);
  };

  const applyStyle = (patch: Partial<Style>) => {
    setStyle(s => ({ ...s, ...patch }));
    if (patch.font) loadFont(patch.font);
    if (!sel) return;
    checkpoint();
    Object.assign(sel, patch.stroke === "ink" ? { ...patch, stroke: ink() } : patch);
    remeasure(sel);
    changed();
  };

  const setBoard = (id: BoardId) => {
    checkpoint();
    const from = ink(), to = BOARDS[id].ink;
    page().elements.forEach(e => { if (e.stroke === from) e.stroke = to; });
    page().board = id;
    changed();
  };

  const addAsset = (id: string) => {
    checkpoint();
    const n = page().elements.filter(e => e.type === "asset").length % 6;
    const logo = LOGO_MAP[id];
    const size = logo ? 150 : 180;
    const e = make("asset", [BW / 2 - size / 2 + n * 30, BH / 2 - size / 2 + n * 30], { asset: id, w: size, h: size });
    if (logo) e.stroke = isDark(logo.hex) ? ink() : logo.hex;
    page().elements.push(e);
    setSelected(e.id);
    setTool("select");
    changed();
  };

  const duplicate = () => {
    if (!sel) return;
    checkpoint();
    const copy: El = { ...structuredClone(sel), id: uid(), x: sel.x + 24, y: sel.y + 24 };
    page().elements.push(copy);
    setSelected(copy.id);
    changed();
  };

  const reorder = (front: boolean) => {
    if (!sel) return;
    checkpoint();
    remove(sel.id);
    page().elements[front ? "push" : "unshift"](sel);
    changed();
  };

  const deleteSelected = () => {
    if (!sel) return;
    checkpoint();
    remove(sel.id);
    setSelected(null);
    changed();
  };

  const goto = (i: number) => {
    doc.current.current = i;
    setSelected(null);
    setEditing(null);
    changed();
  };
  const addPage = () => {
    checkpoint();
    doc.current.pages.push(newPage(page().board));
    goto(doc.current.pages.length - 1);
  };
  const deletePage = (i: number) => {
    if (doc.current.pages.length < 2) return;
    checkpoint();
    doc.current.pages.splice(i, 1);
    goto(Math.min(doc.current.current, doc.current.pages.length - 1));
  };
  const renamePage = (p: Page, name: string) => {
    setRenaming(null);
    if (name.trim() === (p.name ?? "")) return;
    checkpoint();
    p.name = name.trim() || undefined;
    changed();
  };
  const clearPage = () => {
    checkpoint();
    page().elements = [];
    setSelected(null);
    changed();
  };

  const attachStream = (s: MediaStream, kind: Source) => {
    if (stream.current !== s) stream.current?.getTracks().forEach(t => t.stop());
    stream.current = s;
    videoRef.current!.srcObject = s;
    videoRef.current!.play().catch(() => {});
    setSource(kind);
    setCamError("");
    setLayout(l => (l === "off" ? "bubble" : l));
  };
  const stopCamera = () => {
    stream.current?.getTracks().forEach(t => t.stop());
    stream.current = null;
    videoRef.current!.srcObject = null;
    setSource("none");
    setPhoneOpen(false);
  };
  const startWebcam = () => {
    setPhoneOpen(false);
    navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: true })
      .then(s => attachStream(s, "webcam"))
      .catch(e => setCamError((e as Error).message));
  };

  const openPhone = async () => {
    setPhoneOpen(true);
    if (peer.current) return;
    setQr("");
    const { Peer } = await import("peerjs");
    const room = "flacko-" + uid().slice(0, 8);
    const p = new Peer(room);
    peer.current = p;
    const host = location.hostname === "localhost" ? `${process.env.NEXT_PUBLIC_LAN}:${location.port}` : location.host;
    const fail = (msg: string) => {
      clearTimeout(slow);
      setQr(`error:${msg}`);
      p.destroy();
      if (peer.current === p) peer.current = null;
    };
    const slow = setTimeout(() => fail("Can't reach the pairing server. Turn on Secure DNS in your browser, then click Phone again."), 10000);
    p.on("open", () => {
      clearTimeout(slow);
      QRCode.toDataURL(`${location.protocol}//${host}/cam?room=${room}`, { width: 400, margin: 1 }).then(setQr);
    });
    p.on("disconnected", () => !p.destroyed && p.reconnect());
    p.on("error", e => {
      if (e.type !== "peer-unavailable" && e.type !== "network") fail(e.message);
    });
    p.on("call", call => {
      call.answer(undefined, { sdpTransform: preferAv1 });
      call.on("stream", s => {
        attachStream(s, "phone");
        setPhoneOpen(false);
      });
    });
  };

  const toggleRecording = async () => {
    if (recorder.current) return recorder.current.stop();
    let audio = stream.current?.getAudioTracks() ?? [];
    const extra: MediaStreamTrack[] = [];
    if (!audio.length) {
      audio = await navigator.mediaDevices.getUserMedia({ audio: true }).then(s => s.getAudioTracks()).catch(() => []);
      extra.push(...audio);
    }
    const type = ["video/mp4;codecs=avc1,mp4a", "video/mp4", "video/webm;codecs=vp9,opus", "video/webm"].find(m => MediaRecorder.isTypeSupported(m))!;
    const chunks: Blob[] = [];
    const rec = new MediaRecorder(new MediaStream([...outRef.current!.captureStream(30).getVideoTracks(), ...audio]), { mimeType: type, videoBitsPerSecond: 12e6 });
    const started = Date.now();
    const timer = setInterval(() => setRecording(Math.floor((Date.now() - started) / 1000)), 500);
    rec.ondataavailable = e => chunks.push(e.data);
    rec.onstop = () => {
      clearInterval(timer);
      extra.forEach(t => t.stop());
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob(chunks, { type }));
      a.download = `flacko-${new Date().toISOString().slice(0, 19).replace(/:/g, "-")}.${type.startsWith("video/mp4") ? "mp4" : "webm"}`;
      a.click();
      recorder.current = null;
      setRecording(null);
    };
    rec.start(1000);
    recorder.current = rec;
    setRecording(0);
  };

  const finishSession = () => {
    recorder.current?.stop();
    stopCamera();
    peer.current?.destroy();
    peer.current = null;
    setQr("");
    setLayout("off");
    setSelected(null);
  };

  const pickPhoto = (file: File | undefined) => {
    if (!file) return;
    const r = new FileReader();
    r.onload = () => setAvatar(a => ({ ...a, photo: r.result as string }));
    r.readAsDataURL(file);
  };

  const toBoard = (ev: { clientX: number; clientY: number }): P => {
    const r = uiRef.current!.getBoundingClientRect();
    const b = frame.current.board;
    const ox = ((ev.clientX - r.left) / r.width) * BW, oy = ((ev.clientY - r.top) / r.height) * BH;
    return [((ox - b.x) / b.w) * BW, ((oy - b.y) / b.h) * BH];
  };
  const handleTolerance = () => (HANDLE * 1.2 * BW) / frame.current.board.w;

  const startEditing = (e: El) => {
    setSelected(e.id);
    setEditing(e.id);
  };

  const onPointerDown = (ev: RPointerEvent<HTMLCanvasElement>) => {
    if (editing) return;
    const p = toBoard(ev);
    ev.currentTarget.setPointerCapture(ev.pointerId);
    const els = page().elements;
    if (tool === "select") {
      if (sel) {
        const tol = handleTolerance();
        const h = handlesOf(sel).findIndex(([x, y]) => Math.hypot(x - p[0], y - p[1]) < tol);
        if (h >= 0) {
          checkpoint();
          drag.current = { kind: "resize", start: p, orig: structuredClone(sel), handle: h };
          return;
        }
      }
      const hit = hitTest(els, p);
      setSelected(hit?.id ?? null);
      if (hit) {
        checkpoint();
        drag.current = { kind: "move", start: p, orig: structuredClone(hit), handle: -1 };
      }
      return;
    }
    checkpoint();
    if (tool === "eraser") {
      drag.current = { kind: "erase" };
      const hit = hitTest(els, p);
      if (hit) remove(hit.id), invalidate();
      return;
    }
    if (tool === "text") {
      const hit = hitTest(els, p);
      if (hit?.type === "text") return startEditing(hit);
      const e = make("text", [p[0], p[1] - style.fontSize * 0.6], { text: "" });
      remeasure(e);
      els.push(e);
      setTool("select");
      startEditing(e);
      changed();
      return;
    }
    const e = make(tool, p, tool === "pen" ? { points: [[0, 0]] } : {});
    els.push(e);
    setSelected(e.id);
    drag.current = { kind: "create" };
  };

  const onPointerMove = (ev: RPointerEvent<HTMLCanvasElement>) => {
    const d = drag.current;
    const p = toBoard(ev);
    const ui = ev.currentTarget;
    if (!d) {
      ui.style.cursor = tool === "select" ? (hitTest(page().elements, p) ? "move" : "default") : tool === "text" ? "text" : "crosshair";
      return;
    }
    if (d.kind === "erase") {
      const hit = hitTest(page().elements, p);
      if (hit) remove(hit.id), invalidate();
      return;
    }
    const e = find(live.current.selected);
    if (!e) return;
    if (d.kind === "create") {
      if (e.type === "pen") {
        const last = e.points!.at(-1)!;
        const q: P = [p[0] - e.x, p[1] - e.y];
        if (Math.hypot(q[0] - last[0], q[1] - last[1]) > 1.5) e.points!.push(q);
      } else {
        e.w = p[0] - e.x;
        e.h = p[1] - e.y;
        if (ev.shiftKey && !isLine(e)) e.h = Math.sign(e.h || 1) * Math.abs(e.w);
      }
      return invalidate();
    }
    const dx = p[0] - d.start[0], dy = p[1] - d.start[1];
    const o = d.orig;
    if (d.kind === "move") {
      e.x = o.x + dx;
      e.y = o.y + dy;
      return invalidate();
    }
    if (isLine(o)) {
      if (d.handle === 0) Object.assign(e, { x: o.x + dx, y: o.y + dy, w: o.w - dx, h: o.h - dy });
      else Object.assign(e, { w: o.w + dx, h: o.h + dy });
      return invalidate();
    }
    const r = norm(o);
    const [fx, fy] = corners(r)[(d.handle + 2) % 4];
    let w = Math.max(8, Math.abs(p[0] - fx)), h = Math.max(8, Math.abs(p[1] - fy));
    if (o.type === "asset" || o.type === "text") {
      const s = Math.max(w / r.w, h / r.h);
      w = r.w * s;
      h = r.h * s;
    }
    const nx = p[0] < fx ? fx - w : fx, ny = p[1] < fy ? fy - h : fy;
    Object.assign(e, { x: nx, y: ny, w, h });
    if (o.type === "pen") e.points = o.points!.map(([px, py]) => [(px * w) / (r.w || 1), (py * h) / (r.h || 1)]);
    if (o.type === "text") {
      e.fontSize = (o.fontSize * h) / r.h;
      remeasure(e);
    }
    invalidate();
  };

  const onPointerUp = () => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    const e = find(live.current.selected);
    if (d.kind === "create" && e) {
      if (e.type === "pen") {
        const xs = e.points!.map(q => q[0]), ys = e.points!.map(q => q[1]);
        const mx = Math.min(...xs), my = Math.min(...ys);
        e.points = e.points!.map(([x, y]) => [x - mx, y - my]);
        Object.assign(e, { x: e.x + mx, y: e.y + my, w: Math.max(...xs) - mx, h: Math.max(...ys) - my });
        setSelected(null);
      } else if (Math.hypot(e.w, e.h) < 6) {
        remove(e.id);
        setSelected(null);
      } else {
        if (!isLine(e)) Object.assign(e, norm(e));
        setTool("select");
      }
    }
    changed();
  };

  const onDoubleClick = (ev: React.MouseEvent<HTMLCanvasElement>) => {
    const hit = hitTest(page().elements, toBoard(ev));
    if (hit?.type === "text") startEditing(hit);
  };

  const editingEl = find(editing);
  const finishEditing = () => {
    if (editingEl && !editingEl.text?.trim()) remove(editingEl.id), setSelected(null);
    setEditing(null);
    changed();
  };

  const paletteResults = useMemo(() => (palette ? CATALOG.filter(matches(palette.q.trim().toLowerCase())).slice(0, 60) : []), [palette]);
  const insertFromPalette = (id: string | undefined) => {
    if (id) addAsset(id);
    setPalette(null);
  };

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE);
      if (saved) doc.current = JSON.parse(saved);
      doc.current.pages.forEach(p => { if (!(p.board in BOARDS)) p.board = "paper"; });
      const a = localStorage.getItem(AVATAR_KEY);
      if (a) setAvatar(JSON.parse(a));
    } catch {}
    measureCtx.current = document.createElement("canvas").getContext("2d");
    new Set(doc.current.pages.flatMap(p => p.elements.map(e => e.font))).forEach(f => loadFont(f));
    document.fonts.ready.then(invalidate);
    setTick(t => t + 1);

    const thumbsOut: Record<string, string> = {};
    const c = document.createElement("canvas");
    c.width = c.height = 88;
    const cx = c.getContext("2d")!;
    const rc = rough.canvas(c);
    CATALOG.forEach(a => {
      cx.clearRect(0, 0, 88, 88);
      const logo = LOGO_MAP[a.id];
      const stroke = logo ? (isDark(logo.hex) ? "#1f1f1f" : logo.hex) : "#2b2b2b";
      drawElement(cx, rc, { stroke, fill: "", fillStyle: "none", strokeWidth: 2.4, roughness: 1, font: "", fontSize: 0, id: a.id, type: "asset", asset: a.id, x: logo ? 14 : 4, y: logo ? 14 : 4, w: logo ? 60 : 80, h: logo ? 60 : 80, seed: 7 });
      thumbsOut[a.id] = c.toDataURL();
    });
    setThumbs(thumbsOut);

    const full = Object.assign(document.createElement("canvas"), { width: BW, height: BH });
    const small = Object.assign(document.createElement("canvas"), { width: 240, height: 135 });
    const fullCtx = full.getContext("2d")!, smallCtx = small.getContext("2d")!;
    const boardsOut: Record<string, string> = {};
    (Object.keys(BOARDS) as BoardId[]).forEach(id => {
      drawBoard(fullCtx, id);
      smallCtx.drawImage(full, 0, 0, 240, 135);
      boardsOut[id] = small.toDataURL();
    });
    setBoardThumbs(boardsOut);

    const ro = new ResizeObserver(([entry]) => setStageWidth(entry.contentRect.width));
    ro.observe(stageRef.current!);

    const mk = () => Object.assign(document.createElement("canvas"), { width: BW, height: BH });
    const bg = mk(), inkC = mk();
    const bgCtx = bg.getContext("2d")!, inkCtx = inkC.getContext("2d")!;
    const inkRc = rough.canvas(inkC);
    const out = outRef.current!.getContext("2d")!;
    const ui = uiRef.current!.getContext("2d")!;
    const video = videoRef.current!;
    let cachedVersion = -1, cachedBoard = "", last = performance.now(), raf = 0;

    const drawCam = (f: Frame, src: CanvasImageSource, vw: number, vh: number, mirror: boolean) => {
      const r = f.cam;
      const s = Math.max(r.w / vw, r.h / vh);
      out.save();
      out.globalAlpha = f.camAlpha;
      out.beginPath();
      out.roundRect(r.x, r.y, r.w, r.h, Math.min(f.radius, r.w / 2, r.h / 2));
      out.clip();
      if (mirror) {
        out.translate(2 * r.x + r.w, 0);
        out.scale(-1, 1);
      }
      out.drawImage(src, r.x + (r.w - vw * s) / 2, r.y + (r.h - vh * s) / 2, vw * s, vh * s);
      out.restore();
    };

    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const dt = now - last;
      last = now;
      const pg = doc.current.pages[doc.current.current];
      if (cachedBoard !== pg.board) {
        drawBoard(bgCtx, pg.board);
        cachedBoard = pg.board;
      }
      if (cachedVersion !== version.current) {
        inkCtx.clearRect(0, 0, BW, BH);
        pg.elements.forEach(e => drawElement(inkCtx, inkRc, e));
        cachedVersion = version.current;
      }

      const camLive = live.current.source !== "none" && video.readyState >= 2;
      const lay = live.current.layout;
      const f = frame.current, target = lay === "overlay" && !camLive ? FRAMES.off : FRAMES[lay];
      const k = 1 - Math.exp(-dt / 90);
      f.board = lerpRect(f.board, target.board, k);
      f.cam = lerpRect(f.cam, target.cam, k);
      f.radius = lerp(f.radius, target.radius, k);
      f.camAlpha = lerp(f.camAlpha, target.camAlpha, k);
      f.bgAlpha = lerp(f.bgAlpha, target.bgAlpha, k);

      const showCam = f.camAlpha > 0.01;
      const av = avatarRef.current;
      const paintCam = () => {
        if (camLive) drawCam(f, video, video.videoWidth, video.videoHeight, true);
        else if (av) drawCam(f, av, av.width, av.height, false);
      };
      const behind = lay === "overlay";
      out.globalAlpha = 1;
      out.fillStyle = "#000";
      out.fillRect(0, 0, BW, BH);
      out.globalAlpha = f.bgAlpha;
      out.fillStyle = BOARDS[pg.board].bg;
      out.fillRect(0, 0, BW, BH);
      out.globalAlpha = 1;
      if (behind && showCam) paintCam();
      out.globalAlpha = f.bgAlpha;
      out.drawImage(bg, f.board.x, f.board.y, f.board.w, f.board.h);
      out.globalAlpha = 1;
      out.drawImage(inkC, f.board.x, f.board.y, f.board.w, f.board.h);
      if (!behind && showCam) paintCam();

      ui.setTransform(1, 0, 0, 1, 0, 0);
      ui.clearRect(0, 0, BW, BH);
      const e = pg.elements.find(el => el.id === live.current.selected);
      if (!e || drag.current?.kind === "create") return;
      const sx = f.board.w / BW;
      ui.setTransform(sx, 0, 0, f.board.h / BH, f.board.x, f.board.y);
      ui.strokeStyle = "#2f6fed";
      ui.lineWidth = 2 / sx;
      if (!isLine(e)) {
        const r = norm(e), pad = 8 / sx;
        ui.setLineDash([6 / sx, 4 / sx]);
        ui.strokeRect(r.x - pad, r.y - pad, r.w + pad * 2, r.h + pad * 2);
        ui.setLineDash([]);
      }
      ui.fillStyle = "#fff";
      const hs = HANDLE / sx;
      handlesOf(e).forEach(([x, y]) => {
        ui.beginPath();
        if (isLine(e)) ui.arc(x, y, hs / 2, 0, Math.PI * 2);
        else ui.roundRect(x - hs / 2, y - hs / 2, hs, hs, 3 / sx);
        ui.fill();
        ui.stroke();
      });
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  useEffect(() => {
    try { localStorage.setItem(AVATAR_KEY, JSON.stringify(avatar)); } catch {}
    const c = avatarRef.current ?? Object.assign(document.createElement("canvas"), { width: 600, height: 600 });
    avatarRef.current = c;
    const done = (img: HTMLImageElement | null) => {
      paintAvatar(c, avatar.bg, img);
      setAvatarUrl(c.toDataURL());
    };
    if (!avatar.photo) return done(null);
    const img = new Image();
    img.onload = () => done(img);
    img.src = avatar.photo;
  }, [avatar]);

  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      const mod = ev.metaKey || ev.ctrlKey;
      if (mod && ev.key === "\\") return ev.preventDefault(), setPalette(p => (p ? null : { q: "", i: 0 }));
      if ((ev.target as HTMLElement).closest("input, textarea, select")) return;
      const k = ev.key.toLowerCase();
      if (mod && k === "z") return ev.preventDefault(), ev.shiftKey ? redo() : undo();
      if (mod && k === "y") return ev.preventDefault(), redo();
      if (mod && k === "d") return ev.preventDefault(), duplicate();
      if (mod) return;
      if (k === "delete" || k === "backspace") return deleteSelected();
      if (k === "escape") return setSelected(null), setAssetsOpen(false), setPalette(null);
      if (k === "enter" && sel?.type === "text") return ev.preventDefault(), startEditing(sel);
      if (k === "k") return setAssetsOpen(o => !o);
      const t = TOOLS.find(t => t.key === k);
      if (t) setTool(t.id);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const pages = doc.current.pages;
  const boardInk = ink();
  const f = frame.current;
  const k = (stageWidth / BW) * (f.board.w / BW);
  const query = assetQuery.trim().toLowerCase();
  const groups = assetTab === "sketches" ? ASSET_GROUPS : LOGO_GROUPS;
  const pool = assetTab === "sketches" ? SKETCHES : LOGOS;
  const strokes = selLogo ? [selLogo.hex, ...STROKES] : STROKES;
  const camLabel = source === "phone" ? "Phone camera" : source === "webcam" ? "Webcam" : "Avatar";

  return (
    <div className={`studio${inspectorOpen ? "" : " collapsed"}`}>
      <header className="topbar">
        <div className="brand"><span className="brand-mark" />Flacko</div>
        <nav className="tabs" role="tablist" aria-label="Boards">
          {pages.map((p, i) => (
            renaming === p.id ? (
              <input
                key={p.id}
                className="tab-input"
                autoFocus
                defaultValue={p.name ?? `Board ${i + 1}`}
                onFocus={ev => ev.currentTarget.select()}
                onBlur={ev => renamePage(p, ev.currentTarget.value)}
                onKeyDown={ev => {
                  if (ev.key === "Enter") ev.currentTarget.blur();
                  if (ev.key === "Escape") setRenaming(null);
                }}
              />
            ) : (
              <button
                key={p.id}
                className="tab"
                role="tab"
                aria-selected={i === doc.current.current}
                onClick={() => goto(i)}
                onDoubleClick={() => setRenaming(p.id)}
                title="Double-click to rename"
              >
                {p.name ?? `Board ${i + 1}`}
                {pages.length > 1 && (
                  <span className="x" onClick={ev => (ev.stopPropagation(), deletePage(i))} aria-label="Delete board"><X size={12} /></span>
                )}
              </button>
            )
          ))}
          <button className="tab add" onClick={addPage} aria-label="New board"><Plus size={14} /></button>
        </nav>
        <div className="spacer" />
        <div className="icon-group">
          <button className="icon-btn" onClick={undo} title="Undo (Ctrl+Z)"><Undo2 size={16} /></button>
          <button className="icon-btn" onClick={redo} title="Redo (Ctrl+Shift+Z)"><Redo2 size={16} /></button>
        </div>
        <span className={`chip ${source === "none" ? "neutral" : source === "phone" ? "green" : "cyan"}`}>
          {source === "none" ? <VideoOff size={15} /> : source === "phone" ? <Smartphone size={15} /> : <Video size={15} />}
          {camLabel}
        </span>
        <button className={`chip ${recording !== null ? "red" : "neutral"} action`} onClick={toggleRecording}>
          <span className="rec-dot" />
          {recording !== null ? <span className="mono">Stop · {clock(recording)}</span> : "Record"}
        </button>
        <button className="btn" onClick={finishSession} title="Stop recording, turn off the camera and end the session">
          <Check size={15} />Finish session
        </button>
        <button className="icon-btn" onClick={() => setInspectorOpen(o => !o)} title={inspectorOpen ? "Hide sidebar" : "Show sidebar"} aria-pressed={!inspectorOpen}>
          {inspectorOpen ? <PanelRightClose size={16} /> : <PanelRightOpen size={16} />}
        </button>
      </header>

      <main className="canvas-area">
        <nav className="rail" aria-label="Tools">
          {TOOLS.map(t => (
            <button key={t.id} className="icon-btn tool" aria-pressed={tool === t.id} title={`${t.label} (${t.key.toUpperCase()})`} onClick={() => setTool(t.id)}>
              <t.icon size={18} strokeWidth={1.75} />
              <span className="key">{t.key.toUpperCase()}</span>
            </button>
          ))}
          <hr />
          <button className="icon-btn tool" aria-pressed={assetsOpen} title="Assets (K)" onClick={() => setAssetsOpen(o => !o)}>
            <Shapes size={18} strokeWidth={1.75} />
            <span className="key">K</span>
          </button>
          <button className="icon-btn tool" title="Quick insert (Ctrl+\)" onClick={() => setPalette({ q: "", i: 0 })}>
            <Search size={18} strokeWidth={1.75} />
          </button>
        </nav>

        {assetsOpen && (
          <aside className="flyout">
            <header>
              <span className="title">Assets</span>
              <button className="icon-btn" onClick={() => setAssetsOpen(false)} aria-label="Close"><X size={15} /></button>
            </header>
            <div className="seg">
              <button aria-pressed={assetTab === "sketches"} onClick={() => setAssetTab("sketches")}>Sketches</button>
              <button aria-pressed={assetTab === "logos"} onClick={() => setAssetTab("logos")}>Logos</button>
            </div>
            <label className="search">
              <Search size={15} />
              <input placeholder="Search" value={assetQuery} onChange={ev => setAssetQuery(ev.target.value)} />
            </label>
            <div className="scroll">
              {groups.map(g => {
                const items = pool.filter(a => a.group === g).filter(matches(query));
                if (!items.length) return null;
                return (
                  <div key={g}>
                    <div className="label">{g}</div>
                    <div className="asset-grid">
                      {items.map(a => (
                        <button key={a.id} className="asset" onClick={() => addAsset(a.id)} title={a.label}>
                          {thumbs[a.id] && <img src={thumbs[a.id]} alt="" />}
                          <span>{a.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </aside>
        )}

        <div className="stage" ref={stageRef}>
          <canvas ref={outRef} width={BW} height={BH} />
          <canvas
            ref={uiRef}
            width={BW}
            height={BH}
            onMouseDown={ev => ev.preventDefault()}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onDoubleClick={onDoubleClick}
          />
          {editingEl && (
            <textarea
              className="text-editor"
              autoFocus
              value={editingEl.text}
              spellCheck={false}
              style={{
                left: (f.board.x * stageWidth) / BW + editingEl.x * k,
                top: (f.board.y * stageWidth) / BW + editingEl.y * k,
                width: (editingEl.w + editingEl.fontSize) * k,
                height: editingEl.h * k,
                fontSize: editingEl.fontSize * k,
                lineHeight: 1.25,
                fontFamily: `"${editingEl.font}"`,
              }}
              onChange={ev => {
                editingEl.text = ev.target.value;
                remeasure(editingEl);
                invalidate();
                setTick(t => t + 1);
              }}
              onBlur={finishEditing}
              onKeyDown={ev => ev.key === "Escape" && ev.currentTarget.blur()}
            />
          )}
        </div>
        <video ref={videoRef} muted playsInline hidden />
      </main>

      <aside className="inspector">
        <section className="section">
          <div className="label">Camera</div>
          <div className="seg">
            <button aria-pressed={source === "none" && !phoneOpen} onClick={stopCamera}><VideoOff size={14} />Off</button>
            <button aria-pressed={source === "webcam"} onClick={startWebcam}><Video size={14} />Webcam</button>
            <button aria-pressed={source === "phone" || phoneOpen} onClick={openPhone}><Smartphone size={14} />Phone</button>
          </div>
          {camError && <div className="chip red small">{camError}</div>}
          {phoneOpen && (
            <div className="qr">
              {qr.startsWith("data:") ? <img src={qr} alt="Pairing QR code" /> : <div className="hint">{qr.slice(6) || "Connecting…"}</div>}
              <p className="hint">Scan with your phone, then hold it sideways. Same Wi-Fi works best.</p>
            </div>
          )}
          <div className="layouts">
            {LAYOUTS.map(l => {
              const fr = FRAMES[l.id];
              return (
                <button key={l.id} className="layout" aria-pressed={layout === l.id} onClick={() => setLayout(l.id)}>
                  <i>
                    <b className="lt-board" style={pct(fr.board)} />
                    {l.id !== "off" && <b className="lt-cam" style={{ ...pct(fr.cam), borderRadius: l.id === "bubble" ? "50%" : l.id === "overlay" ? 0 : 3, zIndex: l.id === "overlay" ? 0 : 1 }} />}
                  </i>
                  {l.label}
                </button>
              );
            })}
          </div>
          <div className="avatar-row">
            {avatarUrl && <img className="avatar" src={avatarUrl} alt="Avatar" />}
            <div className="field">
              <span>Avatar when the camera is off</span>
              <div className="swatches">
                {AVATAR_BGS.map(c => (
                  <button key={c} className="swatch" style={{ background: c }} aria-pressed={avatar.bg === c} onClick={() => setAvatar(a => ({ ...a, bg: c }))} />
                ))}
              </div>
              <div className="row">
                <label className="btn small">
                  <ImagePlus size={14} />Photo
                  <input type="file" accept="image/*" hidden onChange={ev => pickPhoto(ev.target.files?.[0])} />
                </label>
                {avatar.photo && <button className="btn small" onClick={() => setAvatar(a => ({ ...a, photo: "" }))}>Use doodle</button>}
              </div>
            </div>
          </div>
        </section>

        <section className="section">
          <div className="label">Board</div>
          <div className="boards">
            {(Object.keys(BOARDS) as BoardId[]).map(id => (
              <button key={id} className="board-chip" aria-pressed={page().board === id} onClick={() => setBoard(id)} title={BOARDS[id].name}>
                <i style={{ background: boardThumbs[id] ? `center / cover url(${boardThumbs[id]})` : BOARDS[id].bg }} />
                <span>{BOARDS[id].name}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="section">
          <div className="label">{sel ? `Selected ${selLogo ? "logo" : sel.type}` : "Style"}</div>
          <div className="field">
            <span>{selLogo ? "Color" : "Stroke"}</span>
            <div className="swatches">
              {strokes.map(c => (
                <button
                  key={c}
                  className="swatch"
                  title={c === "ink" ? "Board ink" : c === selLogo?.hex ? "Brand color" : c}
                  style={{ background: c === "ink" ? boardInk : c }}
                  aria-pressed={c === "ink" ? current.stroke === "ink" || current.stroke === boardInk : current.stroke === c && c !== boardInk}
                  onClick={() => applyStyle({ stroke: c })}
                />
              ))}
            </div>
          </div>
          {!selLogo && (
            <>
              <div className="field">
                <span>Fill</span>
                <div className="seg wrap">
                  {FILL_STYLES.map(([v, l]) => (
                    <button key={v} aria-pressed={current.fillStyle === v} onClick={() => applyStyle({ fillStyle: v })}>{l}</button>
                  ))}
                </div>
                {current.fillStyle !== "none" && (
                  <div className="swatches">
                    {FILLS.map(c => (
                      <button key={c} className="swatch" style={{ background: c }} aria-pressed={current.fill === c} onClick={() => applyStyle({ fill: c })} />
                    ))}
                  </div>
                )}
              </div>
              <div className="field">
                <span>Stroke width</span>
                <div className="seg">
                  {WIDTHS.map(([v, l]) => (
                    <button key={v} aria-pressed={current.strokeWidth === v} onClick={() => applyStyle({ strokeWidth: v })}>{l}</button>
                  ))}
                </div>
              </div>
              <div className="field">
                <span>Sloppiness</span>
                <div className="seg">
                  {ROUGHNESS.map(([v, l]) => (
                    <button key={v} aria-pressed={current.roughness === v} onClick={() => applyStyle({ roughness: v })}>{l}</button>
                  ))}
                </div>
              </div>
            </>
          )}
        </section>

        {(!sel || sel.type === "text") && (
          <section className="section">
            <div className="label">Text</div>
            <label className="field">
              <span>Font</span>
              <select className="select" value={current.font} onChange={ev => applyStyle({ font: ev.target.value })} style={{ fontFamily: `"${current.font}"` }}>
                {FONT_GROUPS.map(g => (
                  <optgroup key={g.label} label={g.label}>
                    {g.fonts.map(fn => <option key={fn} value={fn} style={{ fontFamily: `"${fn}"` }}>{fn}</option>)}
                  </optgroup>
                ))}
              </select>
            </label>
            <div className="field">
              <span>Size</span>
              <div className="seg">
                {SIZES.map(([v, l]) => (
                  <button key={v} aria-pressed={Math.round(current.fontSize) === v} onClick={() => applyStyle({ fontSize: v })}>{l}</button>
                ))}
              </div>
            </div>
          </section>
        )}

        {sel && (
          <section className="section">
            <div className="label">Arrange</div>
            <div className="row">
              <button className="btn" onClick={() => reorder(true)} title="Bring to front"><BringToFront size={15} /></button>
              <button className="btn" onClick={() => reorder(false)} title="Send to back"><SendToBack size={15} /></button>
              <button className="btn" onClick={duplicate} title="Duplicate (Ctrl+D)"><Copy size={15} /></button>
              <button className="btn danger" onClick={deleteSelected} title="Delete"><Trash2 size={15} /></button>
            </div>
          </section>
        )}

        <section className="section">
          <button className="btn danger" onClick={clearPage}><Trash2 size={15} />Clear board</button>
          <p className="hint">
            <kbd>Ctrl</kbd> <kbd>\</kbd> quick insert · <kbd>K</kbd> assets · double-click text or a board tab to edit it
          </p>
        </section>
      </aside>

      {palette && (
        <div className="scrim" onMouseDown={() => setPalette(null)}>
          <div className="palette" onMouseDown={ev => ev.stopPropagation()} role="dialog" aria-label="Insert asset">
            <label className="search big">
              <Search size={18} />
              <input
                autoFocus
                placeholder="Search sketches and logos"
                value={palette.q}
                onChange={ev => setPalette({ q: ev.target.value, i: 0 })}
                onKeyDown={ev => {
                  const n = paletteResults.length;
                  if (ev.key === "Escape") setPalette(null);
                  else if (ev.key === "Enter") insertFromPalette(paletteResults[palette.i]?.id);
                  else if (ev.key === "ArrowDown" || ev.key === "ArrowUp") {
                    ev.preventDefault();
                    if (n) setPalette({ ...palette, i: (palette.i + (ev.key === "ArrowDown" ? 1 : -1) + n) % n });
                  }
                }}
              />
              <kbd>Esc</kbd>
            </label>
            <div className="palette-list">
              {paletteResults.map((a, i) => (
                <button
                  key={a.id}
                  className="palette-item"
                  aria-selected={i === palette.i}
                  ref={el => { if (i === palette.i) el?.scrollIntoView({ block: "nearest" }); }}
                  onMouseEnter={() => setPalette({ ...palette, i })}
                  onClick={() => insertFromPalette(a.id)}
                >
                  {thumbs[a.id] && <img src={thumbs[a.id]} alt="" />}
                  <span>{a.label}</span>
                  <em>{a.group}</em>
                </button>
              ))}
              {!paletteResults.length && <p className="hint">Nothing matches.</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
