// Impact wave 1: the STREET fight set, played from the tip modules.
// Same frame path as the gallery (createFx / createAct, composite, backdrop).

import {
  createFrame,
  clearFrame,
  createFx,
  createAct,
  actBounds,
  composite,
  backdrop,
  drawActor,
  painterFor,
  stockActor,
  actorAlphaOf,
} from "../src/core/index.js";
import * as hitSpark from "../src/fx/impacts/hit-spark.js";
import * as bluntHit from "../src/fx/impacts/blunt-hit.js";
import * as critHit from "../src/fx/impacts/crit-hit.js";
import * as hitFlash from "../src/fx/impacts/hit-flash.js";
import * as impactFrame from "../src/fx/impacts/impact-frame.js";
import * as parry from "../src/fx/impacts/parry.js";
import * as groundSlam from "../src/fx/impacts/ground-slam.js";
import * as heavyLanding from "../src/fx/impacts/heavy-landing.js";
import * as uppercut from "../src/fx/melee/uppercut.js";
import * as cartoonPow from "../src/fx/explosions/cartoon-pow.js";
import * as dirtExplosion from "../src/fx/explosions/dirt-explosion.js";
import * as smokeBomb from "../src/fx/explosions/smoke-bomb.js";

const MODULES = {
  "impacts/hit-spark": hitSpark,
  "impacts/blunt-hit": bluntHit,
  "impacts/crit-hit": critHit,
  "impacts/hit-flash": hitFlash,
  "impacts/impact-frame": impactFrame,
  "impacts/parry": parry,
  "impacts/ground-slam": groundSlam,
  "impacts/heavy-landing": heavyLanding,
  "melee/uppercut": uppercut,
  "explosions/cartoon-pow": cartoonPow,
  "explosions/dirt-explosion": dirtExplosion,
  "explosions/smoke-bomb": smokeBomb,
};

const ROLE_ORDER = ["Action", "Reaction", "Aftermath"];
const ROLE_COPY = {
  Action: "The strike itself. Spark, thud, star, speed lines, POW.",
  Reaction: "What the other body does. Damage flash and clash.",
  Aftermath: "What the street keeps. Shockwave, landing dust, grit, smoke.",
};

const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
let master = !reduced;
const $ = (s) => document.querySelector(s);

function el(tag, props = {}, kids = []) {
  const node = Object.assign(document.createElement(tag), props);
  for (const kid of [].concat(kids)) node.append(kid);
  return node;
}

const isScreen = (meta) => meta.size[0] >= 320 && Math.abs(meta.size[0] / meta.size[1] - 16 / 9) < 0.05;

class Player {
  constructor(canvas, fx, aspect, pad) {
    Object.assign(this, { canvas, fx, ctx: canvas.getContext("2d"), aspect, pad, playing: master });
    this.layout();
    if (reduced && !master) this.hold(fx.meta.duration * 0.4);
    else this.render();
  }
  get acted() {
    return !!this.fx.mod.act;
  }
  layout() {
    const acted = this.acted;
    const b = acted ? { ...actBounds(this.fx.mod) } : null;
    if (b) b.y1 = Math.min(b.y1, 22);
    const [w, h] = acted ? [b.x1 - b.x0, b.y1 - b.y0] : this.fx.meta.size;
    const [ox, oy] = acted ? [-b.x0, -b.y0] : this.fx.meta.origin;
    const pad = acted ? Math.min(this.pad, 1.1) : this.pad;
    this.W = Math.ceil(Math.max(w * pad, h * pad * this.aspect));
    this.H = Math.ceil(this.W / this.aspect);
    this.x = Math.floor((this.W - w) / 2) + ox;
    this.y = acted ? Math.max(oy + 2, this.H - b.y1 - 2) : Math.floor((this.H - h) / 2) + oy;
    this.canvas.width = this.W;
    this.canvas.height = this.H;
    this.frame = createFrame(this.W, this.H);
    this.img = this.ctx.createImageData(this.W, this.H);
    const kind = this.fx.meta.bg;
    this.bgBuf = kind === "none" ? null : backdrop(kind, this.W, this.H, this.y);
    this.restart();
  }
  restart() {
    const place = { x: this.x, y: this.y };
    this.inst = (this.acted ? createAct : createFx)(this.fx.mod, place);
    this.acc = 0;
    this.wait = 0;
    this.dirty = true;
  }
  tick(dt) {
    const m = this.fx.meta;
    const step = 1 / m.fps;
    if (this.playing) this.acc = Math.min(this.acc + dt, 0.25);
    let moved = false;
    while (this.acc >= step) {
      this.acc -= step;
      const ended = !m.loop && (this.acted ? this.inst.done() : this.inst.t >= m.duration);
      if (ended) {
        this.wait += step;
        if (this.wait > 0.16) this.restart();
      } else this.inst.update(step);
      moved = true;
    }
    if (moved || this.dirty) this.render();
  }
  hold(t) {
    this.restart();
    this.playing = false;
    this.inst.update(t);
    this.render();
  }
  render() {
    const f = clearFrame(this.frame);
    if (this.acted) {
      this.inst.draw(f);
      composite(f, this.img.data, this.bgBuf);
      const [sx, sy] = this.inst.shake ?? [0, 0];
      this.ctx.clearRect(0, 0, this.W, this.H);
      this.ctx.putImageData(this.img, sx, sy);
      this.dirty = false;
      return;
    }
    this.inst.draw(f, "back");
    const m = this.fx.meta;
    const tt = m.loop ? this.inst.t % m.duration : Math.min(this.inst.t, m.duration);
    if (m.actor) {
      drawActor(
        painterFor(f).place(this.x, this.y),
        this.inst.options.actor ?? stockActor(m.actor === 2 ? 2 : 1),
        actorAlphaOf(this.fx.mod, tt, this.inst.options),
      );
    }
    this.inst.draw(f, "front");
    composite(f, this.img.data, this.bgBuf);
    this.ctx.putImageData(this.img, 0, 0);
    this.dirty = false;
  }
}

const tiles = [];

function syncPlay(tile) {
  const on = tile.player.playing;
  tile.play.textContent = on ? "Pause" : "Play";
  tile.play.setAttribute("aria-pressed", String(on));
}

function syncAll() {
  const btn = $("#all");
  const allOn = master && tiles.every((t) => !t.player || t.player.playing);
  btn.textContent = allOn ? "Pause all" : "Play all";
  btn.setAttribute("aria-pressed", String(allOn));
}

function build(hooks) {
  const board = $("#board");
  const fx = hooks.map((row) => {
    const mod = MODULES[row.id];
    if (!mod) throw new Error(`wave hook has no tip module: ${row.id}`);
    const meta = { fps: 30, bg: "dark", loop: false, duration: 1, tags: [], options: {}, ...mod.meta };
    return { ...row, mod: { ...mod, meta }, meta, screen: isScreen(meta) };
  });
  $("#count").textContent = `${fx.length} effects`;
  syncAll();
  for (const role of ROLE_ORDER) {
    const list = fx.filter((item) => item.role === role);
    if (!list.length) continue;
    const grid = el("div", { className: "fx-grid" });
    const sec = el("section", { className: "wave-role", id: "role-" + role.toLowerCase() }, [
      el("div", { className: "wave-role-head" }, [
        el("h2", { textContent: role }),
        el("p", { textContent: ROLE_COPY[role] ?? "" }),
      ]),
      grid,
    ]);
    for (const item of list) {
      const canvas = el("canvas", { ariaLabel: `${item.label} preview` });
      const stage = el("div", { className: item.screen ? "fx-stage is-screen" : "fx-stage" }, canvas);
      const play = el("button", { type: "button", className: "btn", textContent: reduced ? "Play" : "Pause" });
      const again = el("button", { type: "button", className: "btn", textContent: "Again" });
      play.setAttribute("aria-pressed", String(!reduced));
      const card = el("article", { className: "fx-card", id: "fx-" + item.id.replaceAll("/", "-") }, [
        stage,
        el("div", { className: "fx-body" }, [
          el("div", { className: "fx-kicker" }, [
            el("span", { className: "role role-" + role.toLowerCase(), textContent: role }),
            el("span", { className: "mono dim", textContent: `${+item.meta.duration.toFixed(2)}s` }),
          ]),
          el("h3", { textContent: item.label }),
          el("p", { className: "mono fx-id", textContent: item.id }),
          el("p", { className: "fx-notes", textContent: item.notes }),
          el("div", { className: "fx-actions" }, [play, again]),
        ]),
      ]);
      card.dataset.id = item.id;
      const tile = {
        item,
        card,
        canvas,
        play,
        again,
        player: null,
        visible: false,
      };
      play.addEventListener("click", () => {
        tile.player.playing = !tile.player.playing;
        if (tile.player.playing && tile.player.wait > 0) tile.player.restart();
        syncPlay(tile);
        syncAll();
      });
      again.addEventListener("click", () => {
        tile.player.playing = true;
        tile.player.restart();
        tile.player.render();
        syncPlay(tile);
        syncAll();
      });
      const screen = item.screen;
      tile.player = new Player(canvas, item, screen ? 16 / 9 : 6 / 5, screen ? 1 : 1.25);
      syncPlay(tile);
      grid.append(card);
      tiles.push(tile);
    }
    board.append(sec);
  }

  const io = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      const tile = tiles.find((t) => t.card === entry.target);
      tile.visible = entry.isIntersecting;
    }
    syncAll();
  }, { rootMargin: "240px" });
  for (const tile of tiles) io.observe(tile.card);

  $("#all").addEventListener("click", () => {
    const allOn = master && tiles.every((t) => !t.player || t.player.playing);
    master = !allOn;
    for (const tile of tiles) {
      if (!tile.player) {
        const screen = tile.item.screen;
        tile.player = new Player(tile.canvas, tile.item, screen ? 16 / 9 : 6 / 5, screen ? 1 : 1.25);
      }
      tile.player.playing = master;
      if (master && tile.player.wait > 0) tile.player.restart();
      syncPlay(tile);
    }
    syncAll();
  });

  const hash = location.hash.replace(/^#/, "");
  const target = hash && (document.getElementById(hash) || document.getElementById("fx-" + hash.replaceAll("/", "-")));
  if (target) target.scrollIntoView();
}

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  for (const tile of tiles) if (tile.visible && tile.player) tile.player.tick(dt);
  requestAnimationFrame(frame);
}

try {
  const hooks = await fetch(new URL("./impact-wave1-hooks.json", import.meta.url)).then((res) => {
    if (!res.ok) throw new Error(`hook map ${res.status}`);
    return res.json();
  });
  if (!Array.isArray(hooks) || hooks.length < 8 || hooks.length > 12) {
    throw new Error(`wave hook map must list 8–12 effects, got ${hooks?.length}`);
  }
  const seen = new Set();
  for (const row of hooks) {
    if (!row || typeof row.id !== "string" || !MODULES[row.id]) throw new Error(`unknown wave id: ${row?.id}`);
    if (!ROLE_ORDER.includes(row.role)) throw new Error(`bad role on ${row.id}`);
    if (!row.label || !row.notes) throw new Error(`hook ${row.id} needs label and notes`);
    if (seen.has(row.id)) throw new Error(`duplicate wave id: ${row.id}`);
    seen.add(row.id);
  }
  build(hooks);
  requestAnimationFrame(frame);
} catch (err) {
  $("#board").replaceChildren(el("p", { className: "wave-error", textContent: String(err.message || err) }));
}
