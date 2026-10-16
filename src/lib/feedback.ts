let ctx: AudioContext | null = null;

/** Tiny synthesized click — generated locally, no audio files or network needed. */
export function playClick(freq = 1800, dur = 0.03, gain = 0.06) {
  try {
    ctx ??= new AudioContext();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "triangle";
    o.frequency.value = freq;
    g.gain.setValueAtTime(gain, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
    o.connect(g).connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + dur);
  } catch {
    /* audio unavailable */
  }
}

export function vibrate(ms = 10) {
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* unsupported */
  }
}
