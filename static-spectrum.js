// static-spectrum.js
// Whole-file static spectrum (Welch average) with Blackman–Harris window.
// Outputs Uint8Array bins (0..255) length = fftSize/2 to mimic getByteFrequencyData().
//
// given an audio buffer, computes a single spectrum representing the whole file.
//

(function () {
  "use strict";

  // ---------- Blackman–Harris (4-term) window ----------
  function blackmanHarrisWindow(N) {
    const a0 = 0.35875, a1 = 0.48829, a2 = 0.14128, a3 = 0.01168;
    const w = new Float32Array(N);
    const denom = N - 1;
    for (let n = 0; n < N; n++) {
      const x = (2 * Math.PI * n) / denom;
      w[n] = a0 - a1 * Math.cos(x) + a2 * Math.cos(2 * x) - a3 * Math.cos(3 * x);
    }
    return w;
  }

  // ---------- Minimal radix-2 FFT (in-place) ----------
  // Re/im are Float32Array, length N (power of 2).
  function fftRadix2(re, im) {
    const N = re.length;
    // bit-reversal permutation
    let j = 0;
    for (let i = 0; i < N; i++) {
      if (i < j) {
        let tr = re[i]; re[i] = re[j]; re[j] = tr;
        let ti = im[i]; im[i] = im[j]; im[j] = ti;
      }
      let m = N >> 1;
      while (m >= 1 && j >= m) { j -= m; m >>= 1; }
      j += m;
    }

    // Cooley-Tukey
    for (let size = 2; size <= N; size <<= 1) {
      const half = size >> 1;
      const step = -2 * Math.PI / size;
      for (let start = 0; start < N; start += size) {
        for (let k = 0; k < half; k++) {
          const ang = step * k;
          const wr = Math.cos(ang);
          const wi = Math.sin(ang);

          const i0 = start + k;
          const i1 = i0 + half;

          const tr = wr * re[i1] - wi * im[i1];
          const ti = wr * im[i1] + wi * re[i1];

          re[i1] = re[i0] - tr;
          im[i1] = im[i0] - ti;
          re[i0] = re[i0] + tr;
          im[i0] = im[i0] + ti;
        }
      }
    }
  }

  function isPowerOfTwo(n) {
    return n > 0 && (n & (n - 1)) === 0;
  }

  function mixToMono(audioBuffer) {
    const nCh = audioBuffer.numberOfChannels;
    const len = audioBuffer.length;

    if (nCh === 1) return audioBuffer.getChannelData(0);

    const mono = new Float32Array(len);
    for (let ch = 0; ch < nCh; ch++) {
      const x = audioBuffer.getChannelData(ch);
      for (let i = 0; i < len; i++) mono[i] += x[i];
    }
    const inv = 1 / nCh;
    for (let i = 0; i < len; i++) mono[i] *= inv;
    return mono;
  }

  function normaliseToByteBins(mag) {
    // mag: Float32Array length N/2 (non-negative)
    // Convert to 0..255 with a mild log-ish curve so quiet partials don't vanish completely.
    let max = 0;
    for (let i = 0; i < mag.length; i++) if (mag[i] > max) max = mag[i];
    if (max <= 0) return new Uint8Array(mag.length);

    const out = new Uint8Array(mag.length);
    for (let i = 0; i < mag.length; i++) {
      // log compress; tweak 20 -> stronger compression, 5 -> weaker
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
    if (hopSize <= 0 || hopSize > fftSize) {
      throw new Error(`hopSize must be in (0, fftSize], got ${hopSize}`);
    }

    const x = mixToMono(audioBuffer);
    const N = fftSize;
    const half = N >> 1;

    const win = blackmanHarrisWindow(N);

    const accPow = new Float32Array(half);
    let frames = 0;

    const re = new Float32Array(N);
    const im = new Float32Array(N);

    // Welch averaging across frames
    for (let start = 0; start + N <= x.length; start += hopSize) {
      // windowed frame
      for (let i = 0; i < N; i++) {
        re[i] = x[start + i] * win[i];
        im[i] = 0;
      }

      fftRadix2(re, im);

      // power spectrum (ignore DC bin for visuals if you want, but keep it for length match)
      for (let k = 0; k < half; k++) {
        const r = re[k], ii = im[k];
        accPow[k] += (r * r + ii * ii);
      }
      frames++;
    }

    if (frames === 0) return new Uint8Array(half);

    // average + convert to magnitude
    const mag = new Float32Array(half);
    const invFrames = 1 / frames;
    for (let k = 0; k < half; k++) {
      mag[k] = Math.sqrt(accPow[k] * invFrames);
    }

    return normaliseToByteBins(mag);
  }

  window.StaticSpectrum = { compute };
})();
