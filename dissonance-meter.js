// dissonance-meter.js
// Computes dissonance over time and stores it globally.

(function () {
  "use strict";

  const { blackmanHarrisWindow, mixToMono, computeFrameMagnitude } = window.FFTUtils;
  const { pickPeaks } = window.PeakPicking;

  /**
   * Compute dissonance over time between context and complement buses.
   * Reads from window.buses and window.auditionCents.
   * Stores result in window.dissonanceOverTime.
   */
  async function compute() {
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

    if (rawMax > rawMin) {
      const inv = 1 / (rawMax - rawMin);
      for (let i = 0; i < maxFrames; i++) {
        dissonance[i] = (dissonance[i] - rawMin) * inv;
      }
    }

    window.dissonanceOverTime = { frameTimes, dissonance, hopDuration };
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
      });

      allPeaks.push(peaks);
    }

    return allPeaks;
  }

  window.DissonanceMeter = { compute };




// Add these inside the IIFE, after compute():

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
  const hue = (1 - value) * 120;
  fill.style.backgroundColor = `hsl(${hue}, 70%, 50%)`;
}

// Update the export to include all three:
window.DissonanceMeter = { compute, startPlayback, stopPlayback };

})();