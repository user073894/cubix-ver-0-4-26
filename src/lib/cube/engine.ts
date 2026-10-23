import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { moveToTurn, remapMove, turnToMove, type Axis, type Move } from "./moves";
import { nearestCubeView, rigidRotationEnabled } from "./rotation";

export interface EngineSettings {
  speed: number; // 0.5 .. 3
  sensitivity: number; // 0.5 .. 2
  easy: boolean;
  rigidRotation: boolean;
}

export interface EngineCallbacks {
  onUserMove: (m: Move) => void;
  onQueueChange?: (pending: number) => void;
  getSettings: () => EngineSettings;
}

const STICKER_TOKENS = {
  R: "--cube-right",
  L: "--cube-left",
  U: "--cube-up",
  D: "--cube-down",
  F: "--cube-front",
  B: "--cube-back",
};

const DEFAULT_VIEW = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.52, -0.68, 0, "XYZ"));

interface QueueItem {
  move: Move;
  resolve: () => void;
}

interface Anim {
  pivot: THREE.Group;
  axis: THREE.Vector3;
  target: number;
  elapsed: number;
  duration: number;
  members: THREE.Object3D[];
  done: () => void;
}

type Gesture =
  | { kind: "orbit"; x: number; y: number; t: number }
  | {
      kind: "face";
      x: number;
      y: number;
      normal: THREE.Vector3;
      point: THREE.Vector3;
      cubie: THREE.Object3D;
    }
  | { kind: "spent" };

export class CubeEngine {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
  private root = new THREE.Group();
  private cubies: THREE.Object3D[] = [];
  private pickables: THREE.Object3D[] = [];
  private queue: QueueItem[] = [];
  private anim: Anim | null = null;
  private gesture: Gesture | null = null;
  private velocity = { x: 0, y: 0 };
  private recenterFrom: THREE.Quaternion | null = null;
  private recenterTo = DEFAULT_VIEW.clone();
  private recenterT = 0;
  private dirty = true;
  private clock = new THREE.Timer();
  private ro: ResizeObserver;
  private raycaster = new THREE.Raycaster();
  private disposed = false;

  constructor(
    private container: HTMLElement,
    private cb: EngineCallbacks,
  ) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    this.renderer.toneMappingExposure = 0.95;
    const canvas = this.renderer.domElement;
    canvas.style.touchAction = "none";
    canvas.style.display = "block";
    container.appendChild(canvas);

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x222233, 0.6));
    const key = new THREE.DirectionalLight(0xffffff, 1.6);
    key.position.set(4, 8, 6);
    this.scene.add(key);

    this.camera.position.set(0, 0, 10);
    this.root.quaternion.copy(DEFAULT_VIEW);
    this.scene.add(this.root);
    this.build();

    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(container);
    this.resize();

    canvas.addEventListener("pointerdown", this.onDown);
    canvas.addEventListener("pointermove", this.onMove);
    canvas.addEventListener("pointerup", this.onUp);
    canvas.addEventListener("pointercancel", this.onUp);
    this.renderer.setAnimationLoop(this.tick);
  }

  private build() {
    const palette = getComputedStyle(document.documentElement);
    const body = new RoundedBoxGeometry(0.985, 0.985, 0.985, 4, 0.065);
    const sticker = new RoundedBoxGeometry(0.905, 0.905, 0.018, 4, 0.045);
    const bodyMat = new THREE.MeshStandardMaterial({ color: palette.getPropertyValue("--cube-body").trim(), roughness: 0.42, metalness: 0 });
    const stickerMats: Record<string, THREE.MeshPhysicalMaterial> = {};
    for (const [k, token] of Object.entries(STICKER_TOKENS)) {
      stickerMats[k] = new THREE.MeshPhysicalMaterial({
        color: palette.getPropertyValue(token).trim(),
        roughness: 0.34,
        clearcoat: 0.28,
        clearcoatRoughness: 0.32,
        emissive: 0x000000,
      });
    }
    // Inner core
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.65, 20, 16), bodyMat);
    this.root.add(core);

    for (let x = -1; x <= 1; x++)
      for (let y = -1; y <= 1; y++)
        for (let z = -1; z <= 1; z++) {
          if (!x && !y && !z) continue;
          const g = new THREE.Group();
          g.position.set(x, y, z);
          g.userData["home"] = new THREE.Vector3(x, y, z);
          const b = new THREE.Mesh(body, bodyMat);
          b.userData["cubie"] = g;
          g.add(b);
          this.pickables.push(b);
          const faces: [string, number, THREE.Vector3][] = [
            ["R", x, new THREE.Vector3(1, 0, 0)],
            ["L", -x, new THREE.Vector3(-1, 0, 0)],
            ["U", y, new THREE.Vector3(0, 1, 0)],
            ["D", -y, new THREE.Vector3(0, -1, 0)],
            ["F", z, new THREE.Vector3(0, 0, 1)],
            ["B", -z, new THREE.Vector3(0, 0, -1)],
          ];
          for (const [name, v, n] of faces) {
            if (v !== 1) continue;
            const material = stickerMats[name];
            if (!material) continue;
            const s = new THREE.Mesh(sticker, material.clone());
            s.position.copy(n).multiplyScalar(0.497);
            s.lookAt(n.clone().multiplyScalar(2));
            s.userData["cubie"] = g;
            g.add(s);
            this.pickables.push(s);
          }
          this.root.add(g);
          this.cubies.push(g);
        }
  }

  private resize() {
    const w = this.container.clientWidth || 1;
    const h = this.container.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    this.renderer.domElement.style.width = w + "px";
    this.renderer.domElement.style.height = h + "px";
    this.camera.aspect = w / h;
    const vHalf = THREE.MathUtils.degToRad(this.camera.fov / 2);
    const hHalf = Math.atan(Math.tan(vHalf) * this.camera.aspect);
    const half = Math.min(vHalf, hHalf);
    this.camera.position.z = 2.75 / Math.sin(half);
    this.camera.updateProjectionMatrix();
    this.dirty = true;
  }

  // ---------- public API ----------
  enqueue(moves: Move[]): Promise<void> {
    if (!moves.length) return Promise.resolve();
    const ps = moves.map((move) => new Promise<void>((resolve) => this.queue.push({ move, resolve })));
    this.cb.onQueueChange?.(this.pendingCount());
    return Promise.all(ps).then(() => undefined);
  }

  pendingCount() {
    return this.queue.length + (this.anim ? 1 : 0);
  }

  /** Stop animations and restore every cubie to its solved home position. */
  reset() {
    const q = this.queue.splice(0);
    if (this.anim) {
      for (const m of this.anim.members) this.root.attach(m);
      this.root.remove(this.anim.pivot);
      const done = this.anim.done;
      this.anim = null;
      done();
    }
    q.forEach((i) => i.resolve());
    for (const c of this.cubies) {
      c.position.copy(c.userData["home"]);
      c.quaternion.identity();
    }
    this.cb.onQueueChange?.(0);
    this.dirty = true;
  }

  /** Translate a screen-relative move (R = the face on the viewer's right) into the cube's real face. */
  viewMove(m: Move): Move {
    const inv = nearestCubeView(this.root.quaternion).invert();
    return remapMove(m, (axis) => {
      const v = new THREE.Vector3();
      v.setComponent(axis, 1);
      v.applyQuaternion(inv);
      const a = [Math.abs(v.x), Math.abs(v.y), Math.abs(v.z)];
      const i = a.indexOf(Math.max(...a)) as Axis;
      return { axis: i, sign: v.getComponent(i) >= 0 ? 1 : -1 };
    });
  }

  recenter() {
    this.velocity = { x: 0, y: 0 };
    this.recenterFrom = this.root.quaternion.clone();
    this.recenterTo.copy(DEFAULT_VIEW);
    this.recenterT = 0;
  }

  dispose() {
    this.disposed = true;
    this.renderer.setAnimationLoop(null);
    this.ro.disconnect();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  // ---------- input ----------
  private ndc(x: number, y: number) {
    const r = this.renderer.domElement.getBoundingClientRect();
    return new THREE.Vector2(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1);
  }

  private toScreen(p: THREE.Vector3) {
    const r = this.renderer.domElement.getBoundingClientRect();
    const v = p.clone().project(this.camera);
    return new THREE.Vector2(((v.x + 1) / 2) * r.width, ((1 - v.y) / 2) * r.height);
  }

  private onDown = (e: PointerEvent) => {
    if (this.gesture) return;
    if (e.button !== 0) return;
    this.root.updateMatrixWorld(true);
    this.renderer.domElement.setPointerCapture(e.pointerId);
    this.velocity = { x: 0, y: 0 };
    this.recenterFrom = null;
    this.raycaster.setFromCamera(this.ndc(e.clientX, e.clientY), this.camera);
    const hit = this.raycaster.intersectObjects(this.pickables, false)[0];
    if (hit && hit.face) {
      // Moving cubies are not on stable layer coordinates: do not misread a swipe.
      if (this.pendingCount() > 0) return;
      const inv = this.root.quaternion.clone().invert();
      const n = hit.face.normal.clone().transformDirection(hit.object.matrixWorld).applyQuaternion(inv);
      const a = [Math.abs(n.x), Math.abs(n.y), Math.abs(n.z)];
      const i = a.indexOf(Math.max(...a));
      const normal = new THREE.Vector3();
      normal.setComponent(i, Math.sign(n.getComponent(i)));
      this.gesture = { kind: "face", x: e.clientX, y: e.clientY, normal, point: hit.point.clone(), cubie: hit.object.userData["cubie"] };
    } else {
      this.gesture = { kind: "orbit", x: e.clientX, y: e.clientY, t: performance.now() };
    }
  };

  private onMove = (e: PointerEvent) => {
    const g = this.gesture;
    if (!g) return;
    if (g.kind === "orbit") {
      const dx = e.clientX - g.x;
      const dy = e.clientY - g.y;
      const now = performance.now();
      const dt = Math.max(1, now - g.t);
      g.x = e.clientX;
      g.y = e.clientY;
      g.t = now;
      this.rotateView(dx, dy);
      this.velocity = { x: (dx / dt) * 16, y: (dy / dt) * 16 };
      return;
    }
    if (g.kind !== "face") return;
    const s = this.cb.getSettings();
    const drag = new THREE.Vector2(e.clientX - g.x, e.clientY - g.y);
    if (drag.length() < (s.easy ? 14 : 8)) return;
    const move = this.resolveFaceGesture(g, drag, s.easy);
    this.gesture = { kind: "spent" };
    if (move) this.cb.onUserMove(move);
  };

  private onUp = (e: PointerEvent) => {
    try {
      this.renderer.domElement.releasePointerCapture(e.pointerId);
    } catch {
      /* noop */
    }
    if (this.gesture?.kind === "orbit" && this.rigidView()) {
      this.velocity = { x: 0, y: 0 };
      this.recenterFrom = this.root.quaternion.clone();
      this.recenterTo.copy(nearestCubeView(this.root.quaternion, DEFAULT_VIEW));
      this.recenterT = 0;
    } else if (this.gesture?.kind !== "orbit") this.velocity = { x: 0, y: 0 };
    this.gesture = null;
  };

  private rotateView(dx: number, dy: number) {
    const k = 0.0085 * this.cb.getSettings().sensitivity;
    const qy = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), dx * k);
    const qx = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), dy * k);
    this.root.quaternion.premultiply(qy).premultiply(qx).normalize();
    this.dirty = true;
  }

  private rigidView() {
    return rigidRotationEnabled(this.cb.getSettings().rigidRotation, window.innerWidth,
      window.matchMedia("(pointer: fine)").matches, window.matchMedia("(hover: hover)").matches);
  }

  private resolveFaceGesture(
    g: Extract<Gesture, { kind: "face" }>,
    drag: THREE.Vector2,
    easy: boolean,
  ): Move | null {
    const ni = [0, 1, 2].find((i) => g.normal.getComponent(i) !== 0);
    if (ni === undefined) return null;
    const tangents = [0, 1, 2].filter((i) => i !== ni).map((i) => {
      const t = new THREE.Vector3();
      t.setComponent(i, 1);
      return t;
    });
    const base = this.toScreen(g.point);
    const screen = tangents.map((t) => {
      const w = t.clone().applyQuaternion(this.root.quaternion).multiplyScalar(0.6).add(g.point);
      return this.toScreen(w).sub(base);
    });
    // Decompose drag = a*s0 + b*s1
    const s0 = screen[0];
    const s1 = screen[1];
    if (!s0 || !s1) return null;
    const det = s0.x * s1.y - s1.x * s0.y;
    if (Math.abs(det) < 1e-3) return null;
    const a = (drag.x * s1.y - s1.x * drag.y) / det;
    const b = (s0.x * drag.y - drag.x * s0.y) / det;
    const ca = Math.abs(a) * s0.length();
    const cb = Math.abs(b) * s1.length();
    const ratio = Math.min(ca, cb) / Math.max(ca, cb);
    if (ratio > (easy ? 0.8 : 0.6)) return null; // ambiguous diagonal → do nothing
    const useA = ca > cb;
    const tangent = tangents[useA ? 0 : 1];
    if (!tangent) return null;
    const d = tangent.clone().multiplyScalar(Math.sign(useA ? a : b));
    const axisVec = new THREE.Vector3().crossVectors(g.normal, d);
    const ai = [0, 1, 2].find((i) => Math.round(axisVec.getComponent(i)) !== 0) as Axis | undefined;
    if (ai === undefined) return null;
    const dir = Math.sign(axisVec.getComponent(ai)) as 1 | -1;
    const layer = Math.round(g.cubie.position.getComponent(ai));
    const move = turnToMove(ai, layer, dir);
    return move;
  }

  // ---------- loop ----------
  private startNext() {
    const item = this.queue.shift();
    if (!item) return;
    const { axis, layers, quarters } = moveToTurn(item.move);
    const pivot = new THREE.Group();
    this.root.add(pivot);
    const members = this.cubies.filter((c) => layers.includes(Math.round(c.position.getComponent(axis))));
    members.forEach((m) => pivot.attach(m));
    const axisVec = new THREE.Vector3();
    axisVec.setComponent(axis, 1);
    const speed = this.cb.getSettings().speed;
    // Speed up when moves pile up so fast typing (high TPS) never lags behind.
    const backlog = this.queue.length;
    const base = (Math.abs(quarters) === 2 ? 0.22 : 0.14) / speed;
    const duration = Math.max(0.018, base / (1 + backlog * 0.3));
    this.anim = { pivot, axis: axisVec, target: (quarters * Math.PI) / 2, elapsed: 0, duration, members, done: item.resolve };
  }

  private finishAnim() {
    const a = this.anim;
    if (!a) return;
    a.pivot.quaternion.setFromAxisAngle(a.axis, a.target);
    a.pivot.updateMatrixWorld(true);
    for (const m of a.members) {
      this.root.attach(m);
      m.position.set(Math.round(m.position.x), Math.round(m.position.y), Math.round(m.position.z));
      const e = new THREE.Matrix4().makeRotationFromQuaternion(m.quaternion).elements;
      for (let i = 0; i < e.length; i++) e[i] = Math.round(e[i] ?? 0);
      m.quaternion.setFromRotationMatrix(new THREE.Matrix4().fromArray(e));
    }
    this.root.remove(a.pivot);
    this.anim = null;
    a.done();
    this.cb.onQueueChange?.(this.pendingCount());
  }

  private tick = () => {
    if (this.disposed) return;
    const dt = Math.min((this.clock.update(), this.clock.getDelta()), 0.05);
    let remaining = dt;
    let guard = 0;
    while ((this.anim || this.queue.length) && remaining > 0 && guard++ < 50) {
      if (!this.anim) this.startNext();
      const a = this.anim;
      if (!a) break;
      const used = Math.min(remaining, a.duration - a.elapsed);
      a.elapsed += used;
      remaining -= used;
      const t = Math.min(1, a.elapsed / a.duration);
      // A finger turn accelerates then seats cleanly, without bounce or overshoot.
      const ease = t * t * (3 - 2 * t);
      a.pivot.quaternion.setFromAxisAngle(a.axis, a.target * ease);
      this.dirty = true;
      if (t >= 1) {
        this.finishAnim();
      }
    }
    if (!this.gesture && (Math.abs(this.velocity.x) > 0.05 || Math.abs(this.velocity.y) > 0.05)) {
      this.rotateView(this.velocity.x, this.velocity.y);
      const damp = Math.exp(-7 * dt);
      this.velocity.x *= damp;
      this.velocity.y *= damp;
    }
    if (this.recenterFrom) {
      this.recenterT = Math.min(1, this.recenterT + dt * 3);
      const e = 1 - Math.pow(1 - this.recenterT, 3);
      this.root.quaternion.slerpQuaternions(this.recenterFrom, this.recenterTo, e);
      this.dirty = true;
      if (this.recenterT >= 1) this.recenterFrom = null;
    }
    if (this.dirty) {
      this.renderer.render(this.scene, this.camera);
      this.dirty = false;
    }
  };
}
