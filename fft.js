
import FFT from 'https://cdn.jsdelivr.net/npm/fft.js@4.0.4/+esm';

//Blackman Harris Windowing
  export function blackmanHarrisWindow(N) {
    const a0 = 0.35875, a1 = 0.48829, a2 = 0.14128, a3 = 0.01168;
    const w = new Float32Array(N);
    for (let n = 0; n < N; n++) {
      const x = (2 * Math.PI * n) / N - 1;
      w[n] = a0 - a1 * Math.cos(x) + a2 * Math.cos(2 * x) - a3 * Math.cos(3 * x);
    }
    return w;
  }



//turn stereo buffer into mono
  export function mixToMono(audioBuffer) {

    if (audioBuffer.numberOfChannels === 1) return audioBuffer.getChannelData(0);

    const mono = new Float32Array(audioBuffer.length);
    for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
      const x = audioBuffer.getChannelData(channel);
      for (let i = 0; i < audioBuffer.length; i++) {
        mono[i] += x[i];
      }
    }
    const inv = 1 / audioBuffer.numberOfChannels;
    for (let i = 0; i < audioBuffer.length; i++) mono[i] *= inv;
    return mono;
  }



//Compute magnitude spectrum for a single frame
export function computeFrameMagnitude(samples, start, win, fftSize) {
  const fft = new FFT(fftSize);

  const input = new Float32Array(fftSize);
  for (let i = 0; i < fftSize; i++) {//for each sample in frame, multiply by BH window value
    input[i] = samples[start + i] * win[i];
  }

  // fft library uses complex arrays
  const out = fft.createComplexArray();
  fft.realTransform(out, input);
  fft.completeSpectrum(out);

  const half = fftSize / 2; //remove mirrored information
  const magnitudeArray = new Float32Array(half);

  //convert each complex bin to magnitude
  for (let i = 0; i < half; i++) {
    const real = out[2 * i];
    const imaginary = out[2 * i + 1];
    magnitudeArray[i] = Math.sqrt(real * real + imaginary * imaginary);
  }

  return magnitudeArray;
}
