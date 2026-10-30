// Synthesized sound effects (Web Audio) — no audio files to download.
// A wooden tile clack for placed tiles and a short fanfare for game end.
let ctx = null;

function audio() {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

function clack(ac, at) {
  const duration = 0.07;
  const buffer = ac.createBuffer(1, Math.ceil(ac.sampleRate * duration), ac.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i += 1) {
    data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 2);
  }
  const src = ac.createBufferSource();
  src.buffer = buffer;
  const filter = ac.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = 1700 + Math.random() * 300;
  filter.Q.value = 1.1;
  const gain = ac.createGain();
  gain.gain.setValueAtTime(0.4, at);
  gain.gain.exponentialRampToValueAtTime(0.01, at + duration);
  src.connect(filter);
  filter.connect(gain);
  gain.connect(ac.destination);
  src.start(at);

  const osc = ac.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(190, at);
  osc.frequency.exponentialRampToValueAtTime(85, at + 0.09);
  const og = ac.createGain();
  og.gain.setValueAtTime(0.14, at);
  og.gain.exponentialRampToValueAtTime(0.001, at + 0.1);
  osc.connect(og);
  og.connect(ac.destination);
  osc.start(at);
  osc.stop(at + 0.11);
}

export function playTileClick() {
  const ac = audio();
  if (!ac) return;
  clack(ac, ac.currentTime);
}

export function playTilesLaid(count = 3) {
  const ac = audio();
  if (!ac) return;
  const start = ac.currentTime + 0.02;
  const total = Math.max(1, Math.min(7, count));
  for (let i = 0; i < total; i += 1) clack(ac, start + i * 0.06);
}

export function playVictory() {
  const ac = audio();
  if (!ac) return;
  const t0 = ac.currentTime + 0.05;
  const melody = [523.25, 659.25, 783.99, 1046.5];
  melody.forEach((freq, i) => {
    const t = t0 + i * 0.14;
    const osc = ac.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = freq;
    const gain = ac.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.2, t + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
    osc.connect(gain);
    gain.connect(ac.destination);
    osc.start(t);
    osc.stop(t + 0.5);
  });
  [1046.5, 1318.51, 1567.98].forEach((freq) => {
    const t = t0 + 0.6;
    const osc = ac.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = freq;
    const gain = ac.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.14, t + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 1.1);
    osc.connect(gain);
    gain.connect(ac.destination);
    osc.start(t);
    osc.stop(t + 1.15);
  });
}