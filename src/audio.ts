import type { Sfx } from "./game/battle.ts";

let ctx: AudioContext | null = null;
let muted = false;

export function loadMute(): boolean {
  try {
    muted = localStorage.getItem("kalos-mute") === "1";
  } catch {
    muted = false;
  }
  return muted;
}

export function mutedNow(): boolean {
  return muted;
}

export function setMuted(next: boolean) {
  muted = next;
  try {
    localStorage.setItem("kalos-mute", next ? "1" : "0");
  } catch {
    /* ignore private mode */
  }
}

const TONE: Record<Sfx | "ui", number> = {
  ui: 520,
  hit: 180,
  super: 660,
  weak: 140,
  faint: 90,
  catch: 740,
  level: 880,
  heal: 600,
  status: 240,
};

export function play(kind: Sfx | "ui") {
  if (muted) return;
  const AudioCtx = window.AudioContext;
  if (!AudioCtx) return;
  if (!ctx) ctx = new AudioCtx();
  if (ctx.state === "suspended") void ctx.resume();
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = kind === "faint" ? "sawtooth" : "triangle";
  osc.frequency.setValueAtTime(TONE[kind], now);
  if (kind === "level" || kind === "catch") osc.frequency.exponentialRampToValueAtTime(TONE[kind] * 1.5, now + 0.18);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.05, now + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.24);
}
