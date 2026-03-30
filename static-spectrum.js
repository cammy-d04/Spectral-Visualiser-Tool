// static-spectrum.js
// Whole-file static spectrum (Welch average).
// Uses FFTUtils for the heavy lifting.

(function () {
  "use strict";

  const { blackmanHarrisWindow, mixToMono, isPowerOfTwo, computeFrameMagnitude } = window.FFTUtils;

  function normaliseToByteBins(mag) {
    let max = 0;
    for (let i = 0; i < mag.length; i++) {
      if (mag[i] > max) max = mag[i];
    }
    if (max <= 0) return new Uint8Array(mag.length);

    const out = new Uint8Array(mag.length);
    for (let i = 0; i < mag.length; i++) {
      const v = Math.log1p(20 * (mag[i] / max)) / Math.log1p(20);
      out[i] = Math.max(0, Math.min(255, Math.round(v * 255)));
    }
    return out;
  }

  async function compute(audioBuffer, opts = {}) {
    const fftSize = opts.fftSize ?? 2048;
    const hopSize = opts.hopSize ?? (fftSize >> 1);

    if (!isPowerOfTwo(fftSize)) {
      throw new Error(`fftSize must be power of two, got ${fftSize}`);
    }

    const samples = mixToMono(audioBuffer);
    const window = blackmanHarrisWindow(fftSize);
    const half = fftSize >> 1;

    const accPow = new Float32Array(half);
    let frames = 0;

    // Welch averaging
    for (let start = 0; start + fftSize <= samples.length; start += hopSize) {
      const mag = computeFrameMagnitude(samples, start, window, fftSize);
      
      for (let k = 0; k < half; k++) {
        accPow[k] += mag[k] * mag[k];  // accumulate power
      }
      frames++;
    }

    if (frames === 0) {
      return { bytes: new Uint8Array(half), raw: new Float32Array(half) };
    }

    // Average and convert to magnitude
    const avgMag = new Float32Array(half);
    const invFrames = 1 / frames;
    for (let k = 0; k < half; k++) {
      avgMag[k] = Math.sqrt(accPow[k] * invFrames);
    }

    return { bytes: normaliseToByteBins(avgMag), raw: avgMag };
  }

  window.StaticSpectrum = { compute };
})();