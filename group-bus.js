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

      // optional: track-level gain could go here if you add one later
      src.connect(offline.destination);
      src.start(0);
    }

    return await offline.startRendering();
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
  this.staticBins = await StaticSpectrum.compute(mixed, { fftSize, hopSize });

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