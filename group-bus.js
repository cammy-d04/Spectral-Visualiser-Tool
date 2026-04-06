import {compute} from './static-spectrum.js';
import {pickPeaks} from './peak-picking.js';

// group-bus.js
// A "bus" is a group mixing point for analysis/visualisation.
// Tracks connect their (stable) output GainNode to a bus GainNode.
// The bus feeds an AnalyserNode which the viz reads and draws as one line.
//this is basically just a gain node

export class GroupBus {
  constructor(opts) {
    this.id = opts.id;
    this.color = opts.color;
    this.show = true;
    this.peaks = [];
    this.staticBins = null;

    this.tracks = new Set(); // set of tracks

    this.gain = window.audioCtx.createGain();
    this.gain.gain.value = 1.0;

    this.analyser = window.makeAnalyser();
    this.gain.connect(this.analyser);
  }

  attach(track) { // plug track in to bus
    if (!track || !track.gain) return;
    if (this.tracks.has(track)) return;

    console.log(`Bus ${this.id}: attach track ${track.id}, has fileBuffer: ${!!track.fileBuffer}`);

    track.gain.connect(this.gain);
    this.tracks.add(track);
    this.computeStaticSpectrum().catch(console.warn);
  }

  detach(track) { //unplug track from bus
    if (!track || !track.gain) return;
    if (!this.tracks.has(track)) return;

    try { track.gain.disconnect(this.gain); } catch (e) {}
    this.tracks.delete(track);
    this.computeStaticSpectrum().catch(console.warn);
  }

  listTrackIds() {
    return [...this.tracks].map(t => t.id);
  }



async renderMixedBuffer(rateMultiplier = 1.0) {
    const sr = window.audioCtx.sampleRate;

    const sources = [...this.tracks].filter(t => t.fileBuffer);//maybe remove filtering!!!!

    if (sources.length === 0) return null;

    let maxSamples = 0;

    for (const t of sources) {
        const { startSample, endSample } = t.getCropSamples();
        const cropped = endSample - startSample;
        const rate = (t.pitchRate || 1.0) * rateMultiplier;
        const adjusted = Math.ceil(cropped / rate);
        if (adjusted > maxSamples) maxSamples = adjusted;
    }

    if (maxSamples <= 0) return null;

    const offline = new OfflineAudioContext(1, maxSamples, sr);

   for (const t of sources) {
    console.log(`renderMixed: track ${t.id}, gain value: ${t.gain.gain.value}`);
      const src = offline.createBufferSource();
      src.buffer = t.fileBuffer;

      const rate = (t.pitchRate || 1.0) * rateMultiplier;
      src.playbackRate.value = rate;

      const g = offline.createGain();
      g.gain.value = t.gain.gain.value;

      src.connect(g);
      g.connect(offline.destination);
      const { offset, duration } = t.getCropSeconds();
      src.start(0, offset, duration);
    }

    return await offline.startRendering();
  }



  normalizeAllBuses() {
      const buses = [window.buses.context, window.buses.complement];
    
      // find the global max across all buses
      let globalMax = 0;
      for (const bus of buses) {
          if (!bus.staticRaw) continue;
          for (let i = 0; i < bus.staticRaw.length; i++) {
              if (bus.staticRaw[i] > globalMax) globalMax = bus.staticRaw[i];
          }
      }
    
      if (globalMax <= 0) return;
    
      // now rebuild each bus's staticBins using that shared max
      for (const bus of buses) {
          if (!bus.staticRaw) continue;
          const out = new Uint8Array(bus.staticRaw.length);
          for (let i = 0; i < bus.staticRaw.length; i++) {
              const v = Math.log1p(20 * (bus.staticRaw[i] / globalMax)) / Math.log1p(20);
              out[i] = Math.max(0, Math.min(255, Math.round(v * 255)));
          }
          bus.staticBins = out;
    }
  }


  async computeStaticSpectrum() {
  const mixed = await this.renderMixedBuffer(); ////what is goin gon here????

  if (!mixed) {
    this.staticBins = null;
    this.staticRaw = null;
    return null;
  }

  // Use same FFT size as  analyser so everything matches the live view
  const fftSize = this.analyser.fftSize || 2048;

  // StaticSpectrum.compute should take an AudioBuffer and return bins/array/etc.
  const result = await compute(mixed, fftSize);
  this.staticBins = result.compressedSpectrum;
  this.staticRaw = result.rawSpectrum;
  this.normalizeAllBuses();  // rescale both buses against shared max

  this.pickPeaks()
  return this.staticBins;
}


    pickPeaks() {
        const binHz = window.audioCtx.sampleRate / this.analyser.fftSize;
        this.peaks = pickPeaks(this.staticBins, binHz);
    }

playAudition(rate, when) {
  const sources = [];
  this.tracks.forEach(track => {
    const s = track.createAuditionSource(rate, when);
    if (s) sources.push(s);
  });
  return sources;
}


}
