// peak-picking.js
// Standalone peak-picking logic, reusable by GroupBus and time-varying analysis.

 
  export function pickPeaks(mag, binHz) {

    const threshFrac = window.threshFrac;
    const maxPeaks = window.maxPeaksPicked;
    const minSepHz =  window.minSepHz;
    const minFreqHz =  window.peakFMin;
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

    // Sort by magnitude descending
    candidates.sort((a, b) => b.mag - a.mag);

    // Select top peaks with minimum separation
    const chosen = [];
    for (const c of candidates) {
      if (chosen.length >= maxPeaks) break;

      if (!chosen.some(p => Math.abs(p.bin - c.bin) < minSepBins)) { //if too close
        chosen.push(c);
      }
    }

    // Convert to output format
    const peaks = chosen.map(c => {
      const f = c.bin * binHz;
      let a = c.mag / maxMag; //normalize
      a = Math.sqrt(a); //compress
      return { f, a, bin: c.bin };
    });

    return peaks;

  }

