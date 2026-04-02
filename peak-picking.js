// peak-picking.js
// Standalone peak-picking logic, reusable by GroupBus and time-varying analysis.

 
  export function pickPeaks(mag, opts = {}) {
    const {
      binHz,
      threshFrac = 0.2,
      maxPeaks = 7,
      minSepHz = 30,
      minFreqHz = 60,
      normalize = true,
      compress = true,
    } = opts;


    const minSepBins = Math.max(1, Math.round(minSepHz / binHz));
    const minBin = Math.max(2, Math.round(minFreqHz / binHz));

    // Find max for thresholding
    let maxMag = 0;
    for (let i = 0; i < mag.length; i++) {
      if (mag[i] > maxMag) maxMag = mag[i];
    }

    if (maxMag <= 0) return [];

    const thresh = threshFrac * maxMag;

    // Find local maxima above threshold
    const candidates = [];
    for (let i = minBin; i < mag.length - 1; i++) {
      const m = mag[i];
      if (m > mag[i - 1] && m >= mag[i + 1] && m > thresh) {
        candidates.push({ bin: i, mag: m });
      }
    }

    // Sort by magnitude (strongest first)
    candidates.sort((a, b) => b.mag - a.mag);

    // Select top peaks with minimum separation
    const chosen = [];
    for (const c of candidates) {
      if (chosen.length >= maxPeaks) break;

      const tooClose = chosen.some(p => Math.abs(p.bin - c.bin) < minSepBins);
      if (!tooClose) {
        chosen.push(c);
      }
    }

    // Convert to output format
    const peaks = chosen.map(c => {
      const f = c.bin * binHz;
      let a = normalize ? c.mag / maxMag : c.mag;
      if (compress) a = Math.sqrt(a);
      return { f, a, bin: c.bin };
    });

    return peaks;
  }


  export function pickPeaksWithGlobals(mag, binHz) {
    return pickPeaks(mag, {
      binHz,
      threshFrac: window.threshFrac ?? 0.2,
      maxPeaks: window.maxPeaksPicked ?? 7,
      minSepHz: window.minSepHz ?? 30,
      minFreqHz: window.peakFMin ?? 60,
      normalize: true,
      compress: true,
    });
  }

