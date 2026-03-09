// group-bus.js
// A "bus" is a group mixing point for analysis/visualisation.
// Tracks connect their (stable) output GainNode to a bus GainNode.
// The bus feeds an AnalyserNode which the viz reads and draws as one line.
//this is basically just a gain node
class GroupBus {
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

    console.log(`Bus ${this.id} attaching track ${track.id}, total: ${this.tracks.size + 1}`);

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



  async renderMixedBuffer() {
    const sr = window.audioCtx.sampleRate; //get sample rate from audio context

    const sources = [...this.tracks]
      .filter(t => t.fileBuffer);

    if (sources.length === 0) return null;


    // figure out how long the mix should be, considering playbackRate changes
    let maxSamples = 0;

    // Longest track determines render length
    for (const t of sources) {
        if (t.fileBuffer.length > maxSamples) maxSamples = t.fileBuffer.length;
    }

    // make offline mono audio context for rendering the mix
    const offline = new OfflineAudioContext(1, maxSamples, sr);

   for (const t of sources) {
      const src = offline.createBufferSource();
      src.buffer = t.fileBuffer;

      const g = offline.createGain();
      g.gain.value = t.gain.gain.value;

      src.connect(g);
      g.connect(offline.destination);
      src.start(0);
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
  const mixed = await this.renderMixedBuffer();
  if (!mixed) {
    this.staticBins = null;
    return null;
  }

  // Use same FFT size as your analyser so everything matches the live view
  const fftSize = this.analyser ? this.analyser.fftSize : 2048;
  const hopSize = Math.floor(fftSize / 4);

  // StaticSpectrum.compute should take an AudioBuffer and return bins/array/etc.
  const result = await StaticSpectrum.compute(mixed, { fftSize, hopSize });
  this.staticBins = result.bytes;
  this.staticRaw = result.raw;
  this.normalizeAllBuses();  // re-scale both buses against shared max
  return this.staticBins;
}



// Add this to your GroupBus class in group-bus.js
playAudition(rate, when) {
  const sources = [];
  this.tracks.forEach(track => {
    const s = track.createAuditionSource(rate, when);
    if (s) sources.push(s);
  });
  return sources;
}


}
window.GroupBus = GroupBus; //export to global for main.js to use