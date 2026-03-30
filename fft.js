// fft-utils.js
// Shared FFT utilities used by StaticSpectrum and TimeVaryingSpectrum.

(function () {
  "use strict";

  /**
   * Blackman-Harris (4-term) window function.
   * Reduces spectral leakage when applied before FFT.
   * @param {number} N - Window length
   * @returns {Float32Array}
   */
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

  /**
   * In-place radix-2 FFT (Cooley-Tukey).
   * @param {Float32Array} re - Real parts (length must be power of 2)
   * @param {Float32Array} im - Imaginary parts (same length)
   */
  function fftRadix2(re, im) {
    const N = re.length;
    
    // Bit-reversal permutation
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

    // Cooley-Tukey butterflies
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

  /**
   * Mix multi-channel AudioBuffer down to mono.
   * @param {AudioBuffer} audioBuffer
   * @returns {Float32Array}
   */
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

  /**
   * Check if n is a power of two.
   * @param {number} n
   * @returns {boolean}
   */
  function isPowerOfTwo(n) {
    return n > 0 && (n & (n - 1)) === 0;
  }

  /**
   * Compute magnitude spectrum for a single frame.
   * @param {Float32Array} samples - Mono audio samples
   * @param {number} start - Start index
   * @param {Float32Array} window - Pre-computed window
   * @param {number} fftSize
   * @returns {Float32Array} - Magnitude array (length fftSize/2)
   */
  function computeFrameMagnitude(samples, start, window, fftSize) {
    const re = new Float32Array(fftSize);
    const im = new Float32Array(fftSize);

    // Apply window
    for (let i = 0; i < fftSize; i++) {
      re[i] = samples[start + i] * window[i];
      im[i] = 0;
    }

    fftRadix2(re, im);

    // Magnitude for positive frequencies
    const half = fftSize >> 1;
    const mag = new Float32Array(half);
    for (let k = 0; k < half; k++) {
      mag[k] = Math.sqrt(re[k] * re[k] + im[k] * im[k]);
    }

    return mag;
  }

  // Export
  window.FFTUtils = {
    blackmanHarrisWindow,
    fftRadix2,
    mixToMono,
    isPowerOfTwo,
    computeFrameMagnitude,
  };
})();