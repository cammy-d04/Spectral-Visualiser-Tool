import { blackmanHarrisWindow, mixToMono, computeFrameMagnitude } from './fft.js';



  export function logCompressSpectrum(mag) {
    let max = 0;
    for (let i = 0; i < mag.length; i++) {
      if (mag[i] > max) max = mag[i];
    }
    if (max <= 0) return new Uint8Array(mag.length);

    const out = new Uint8Array(mag.length);
    for (let i = 0; i < mag.length; i++) {
      const v = Math.log1p(20 * (mag[i] / max)) / Math.log1p(20);
      out[i] = Math.max(0, Math.min(255, Math.round(v * 255)));//fix byte conversion
    }
    return out;
  }



  export async function compute(audioBuffer, fftSize) {
    const hopSize = Math.floor(fftSize / 4);
    const samples = mixToMono(audioBuffer);
    const window = blackmanHarrisWindow(fftSize);
    const half = fftSize/2; //only keep positive bins

    const powerArray = new Float32Array(half);
    let frames = 0;

    // Welch averaging
    for (let start = 0; start + fftSize <= samples.length; start += hopSize) { //loop over waveform in overlapping windows
      const magnitudeArray = computeFrameMagnitude(samples, start, window, fftSize);
      
      for (let k = 0; k < half; k++) {
        powerArray[k] += magnitudeArray[k] * magnitudeArray[k];  // accumulate power
      }
      frames++;
    }

    if (frames === 0) {
      return { compressedSpectrum: new Uint8Array(half), rawSpectrum: new Float32Array(half) };
    }

    // average and convert to magnitude
    const avgMag = new Float32Array(half);
    for (let k = 0; k < half; k++) {
      avgMag[k] = Math.sqrt(powerArray[k] * (1/frames));
    }

    return { compressedSpectrum: logCompressSpectrum(avgMag), rawSpectrum: avgMag };
  }
