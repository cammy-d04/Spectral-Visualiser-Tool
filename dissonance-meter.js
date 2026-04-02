import { blackmanHarrisWindow, mixToMono, computeFrameMagnitude } from './fft.js';
import { pickPeaks } from './peak-picking.js';
import { setharesDissonance } from './sethares.js';

  /**
   * Compute dissonance over time between context and complement buses.
   * Reads from window.buses and window.auditionCents.
   * Stores result in window.dissonanceOverTime.
   */
  async function computeDissonance() {
    const contextBus = window.buses?.context;
    const complementBus = window.buses?.complement;

    if (!contextBus || !complementBus) {
      window.dissonanceOverTime = null;
      return;
    }

    const ratio = Math.pow(2, (window.auditionCents ?? 0) / 1200);

    const contextBuffer = await contextBus.renderMixedBuffer(1.0);
    const complementBuffer = await complementBus.renderMixedBuffer(ratio);

    if (!contextBuffer && !complementBuffer) {
      window.dissonanceOverTime = null;
      return;
    }

    const fftSize = 2048;
    const hopSize = fftSize >> 2;
    const sampleRate = contextBuffer?.sampleRate ?? complementBuffer.sampleRate;
    const binHz = sampleRate / fftSize;
    const hopDuration = hopSize / sampleRate;

    const contextPeaks = contextBuffer ? getFramePeaks(contextBuffer, fftSize, hopSize, binHz) : [];
    const complementPeaks = complementBuffer ? getFramePeaks(complementBuffer, fftSize, hopSize, binHz) : [];

    const maxFrames = Math.max(contextPeaks.length, complementPeaks.length);
    if (maxFrames === 0) {
      window.dissonanceOverTime = null;
      return;
    }

    const frameTimes = new Float32Array(maxFrames);
    const dissonance = new Float32Array(maxFrames);

    let rawMin = Infinity;
    let rawMax = -Infinity;

    for (let i = 0; i < maxFrames; i++) {
      frameTimes[i] = i * hopDuration;

      const ctxPeaks = contextPeaks[i] ?? [];
      const cmpPeaks = complementPeaks[i] ?? [];

      const combined = [...ctxPeaks, ...cmpPeaks];
      const d = setharesDissonance(combined);

      dissonance[i] = d;
      if (d < rawMin) rawMin = d;
      if (d > rawMax) rawMax = d;
    }

    const refMax = rawMax > 0 ? rawMax : 1;
    for (let i = 0; i < maxFrames; i++) {
      dissonance[i] = Math.min(1, dissonance[i] / refMax);
    }

    window.dissonanceOverTime = { frameTimes, dissonance, hopDuration };
    drawTimeline();
    return window.dissonanceOverTime;
  }



  function getFramePeaks(audioBuffer, fftSize, hopSize, binHz) {
    const samples = mixToMono(audioBuffer);
    const win = blackmanHarrisWindow(fftSize);
    const numFrames = Math.floor((samples.length - fftSize) / hopSize) + 1;

    const allPeaks = [];

    for (let frame = 0; frame < numFrames; frame++) {
      const start = frame * hopSize;
      const mag = computeFrameMagnitude(samples, start, win, fftSize);

      const peaks = pickPeaks(mag, {
        binHz,
        threshFrac: window.threshFrac ?? 0.2,
        maxPeaks: window.maxPeaksPicked ?? 7,
        minSepHz: window.minSepHz ?? 30,
        minFreqHz: window.peakFMin ?? 60,
        normalize: false,
        compress: true
      });

      allPeaks.push(peaks);
    }

    return allPeaks;
  }





let playbackStartTime = null;
let animationId = null;

function startPlayback() {
  if (!window.dissonanceOverTime) return;
  playbackStartTime = window.audioCtx.currentTime;
  updateMeter();
}

function stopPlayback() {
  playbackStartTime = null;
  if (animationId) {
    cancelAnimationFrame(animationId);
    animationId = null;
  }
  setMeterValue(0);
}

function updateMeter() {
  if (playbackStartTime === null || !window.dissonanceOverTime) {
    stopPlayback();
    return;
  }

  const { dissonance, hopDuration } = window.dissonanceOverTime;
  const elapsed = window.audioCtx.currentTime - playbackStartTime;
  const frameIndex = Math.floor(elapsed / hopDuration);

  if (frameIndex >= dissonance.length) {
    stopPlayback();
    return;
  }

  setMeterValue(dissonance[frameIndex]);
  animationId = requestAnimationFrame(updateMeter);
}

function setMeterValue(value) {
  const fill = document.getElementById("dissonanceMeterFill");
  if (!fill) return;

  fill.style.height = `${value * 100}%`;
fill.style.background = dissonanceToColor(value);
}


function getTimelineCanvas() {
  return document.getElementById("dissonanceTimeline");
}

function resizeTimelineCanvas() {
  const canvas = getTimelineCanvas();
  if (!canvas) return null;

  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.max(1, Math.round(rect.width));
  canvas.height = Math.max(1, Math.round(rect.height));

  return canvas;
}
function dissonanceToColor(value) {
  const v = Math.max(0, Math.min(1, value));
  const hue = (1 - Math.pow(v, 0.25)) * 120;
  return `hsl(${hue}, 70%, 50%)`;
}

function drawTimeline() {
  const canvas = resizeTimelineCanvas();
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  const w = canvas.width;
  const h = canvas.height;

  ctx.clearRect(0, 0, w, h);

  const data = window.dissonanceOverTime;
  if (!data || !data.dissonance || data.dissonance.length === 0) {
    ctx.fillStyle = "#333";
    ctx.fillRect(0, 0, w, h);
    return;
  }

  const values = data.dissonance;
  const n = values.length;

  for (let x = 0; x < w; x++) {
    const i = Math.min(n - 1, Math.floor((x / w) * n));
    const v = values[i];

    ctx.fillStyle = dissonanceToColor(v);
    ctx.fillRect(x, 0, 1, h);
  }
}

export { computeDissonance, startPlayback, stopPlayback, drawTimeline };
