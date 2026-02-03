// track.js

class Track {
  constructor(opts) {
    this.id = opts.id;           // A, B, C etc
    this.color = opts.color;     // used in draw()
    this.engine = "file"
    this.showCheckbox = document.getElementById(opts.showCheckboxId); // show/hide checkbox

    this.peaks = [];              // stores tracks peaks

    //file loading stuff
    this.fileBuffer = null;      // decoded AudioBuffer
    this.fileSource = null;      // current AudioBufferSourceNode
    this.fileInput = null;       // the <input type="file"> assigned to this track
    this.fileInput = document.getElementById("fileInput" + this.id);
    this.fileInput.addEventListener("change", () => this.loadFile());
    this.pitchSlider = document.getElementById("filePitch" + this.id);

    this.pitchSlider.addEventListener("input", () => {
  if (this.engine === "file" && this.voice && this.voice.src) {
    const r = parseFloat(this.pitchSlider.value);
    this.voice.src.playbackRate.setValueAtTime(r, audioCtx.currentTime);
  }
});


    // audio nodes
    this.analyser = null; // analyser node
    this.gain     = null; // gain node
    this.voice    = null; // synthesis voice
    this.show     = true; // visible by default

    this._wireUI();
  }

  _wireUI() {


// show / hide checkbox, if false, gain set to 0 and draw skips it else show
    if (this.showCheckbox) {
      this.showCheckbox.addEventListener('change', () => {
        this.show = this.showCheckbox.checked;
        if (this.gain) this.gain.gain.value = this.show ? 1 : 0;
      });
    }
  }





  buildAudioGraph() {
  console.log(`buildAudioGraph(${this.id}) engine=${this.engine}`);

  if (!window.audioCtx || !window.makeAnalyser) return;

  // file-only, permanently
  this.engine = "file";

  // stop old nodes
  if (this.fileSource) {
    try { this.fileSource.stop(); } catch (e) {}
    try { this.fileSource.disconnect(); } catch (e) {}
  }
  this.fileSource = null;

  if (this.analyser) try { this.analyser.disconnect(); } catch (e) {}
  if (this.gain)     try { this.gain.disconnect(); } catch (e) {}

  // rebuild analyser + gain
  this.analyser = makeAnalyser();
  this.gain = audioCtx.createGain();
  this.gain.gain.value = this.show ? 1 : 0;

  // If no file loaded yet, still connect gain so the graph is valid
  this.gain.connect(audioCtx.destination);

  if (!this.fileBuffer) {
    console.log(`Track ${this.id}: NO FILE LOADED (graph built anyway)`);
    return;
  }

  // Build looping file source routed through analyser/gain
  const src = audioCtx.createBufferSource();
  src.buffer = this.fileBuffer;
  src.loop = true;

  src.playbackRate.setValueAtTime(
    parseFloat(this.pitchSlider.value),
    audioCtx.currentTime
  );

  src.connect(this.analyser);
  this.analyser.connect(this.gain);

  this.fileSource = src;

  console.log(`Track ${this.id}: fileSource ready`);
}




start() {
  // File-only: start looping buffer if it exists
  if (this.engine !== "file") return;

  // If graph not built yet, build it
  if (!this.analyser || !this.gain) {
    this.buildAudioGraph();
  }

  if (!this.fileSource) {
    // No file loaded yet, nothing to start
    return;
  }

  try {
    this.fileSource.start();
  } catch (e) {
    // This will throw if already started; ignore
  }
}


stop() {
  if (this.fileSource) {
    try { this.fileSource.stop(); } catch (e) {}
    try { this.fileSource.disconnect(); } catch (e) {}
  }
  this.fileSource = null;
}



async loadFile() {
  const file = this.fileInput.files[0];
  if (!file) return;

  const arrayBuf = await file.arrayBuffer();
  this.fileBuffer = await audioCtx.decodeAudioData(arrayBuf);

  console.log("Loaded file for track", this.id);

  // rebuild graph so analyser exists (and fileSource is ready if engine=file)
  this.buildAudioGraph();

  // --- STATIC WHOLE-FILE SPECTRUM ---
  // Requires you to include static-spectrum.js which defines window.StaticSpectrum.compute
  try {
    const fftSize = this.analyser ? this.analyser.fftSize : 2048;
    const hopSize = fftSize / 2;

    this.staticBins = await StaticSpectrum.compute(this.fileBuffer, {
      fftSize,
      hopSize
    });

    console.log(`Static spectrum computed for track ${this.id}`, this.staticBins.length);
  } catch (e) {
    console.warn("Static spectrum compute failed:", e);
    this.staticBins = null;
  }
}






// audition an interval of given size (in cents) from current file buffer (viz2click)
auditionInterval(cents) {
  if (!this.fileBuffer) return;

  // Make sure audio can start (in case click happens before Start button)
  if (audioCtx.state !== "running") audioCtx.resume();

  // --- Stop any currently playing audition pair ---
  this.stopAudition();

  const when = audioCtx.currentTime; // immediate
  const ratio = Math.pow(2, cents / 1200);

  // Helper to create + start one source at a given playbackRate
  const makeSrc = (rate) => {
    const src = audioCtx.createBufferSource();
    src.buffer = this.fileBuffer;
    src.loop = false;
    src.playbackRate.setValueAtTime(rate, when);

    // Route: straight to speakers (cleanest for "audition")
    // If you want it to show up in viz1/viz2, route via analyser/gain instead:
    // src.connect(this.analyser).connect(this.gain);
    src.connect(audioCtx.destination);

    // Clean up when it ends
    src.onended = () => {
      try { src.disconnect(); } catch (e) {}
      // remove from active list if still present
      if (this._auditionSources) {
        this._auditionSources = this._auditionSources.filter(s => s !== src);
        if (this._auditionSources.length === 0) this._auditionSources = null;
      }
    };

    src.start(when);
    return src;
  };

  const root = makeSrc(1.0);
  const shifted = makeSrc(ratio);

  // Keep references so we can stop them on the next click
  this._auditionSources = [root, shifted];
}

stopAudition() {
  if (!this._auditionSources) return;

  for (const src of this._auditionSources) {
    try { src.onended = null; } catch (e) {}
    try { src.stop(); } catch (e) {}
    try { src.disconnect(); } catch (e) {}
  }

  this._auditionSources = null;
}



}
