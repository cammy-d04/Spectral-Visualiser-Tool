// track.js
// defines track class (id, colour, file, peaks array, analyser, gain)
// tracks instantiates in main.js and stored in window.tracks array
// handles file loading (decoding audio into aduio buffer)
//creates and controls playback of AudioBufferSourceNode for each track
class Track {
  constructor(opts) {
    this.id = opts.id;           // A, B, C etc
    this.color = opts.color;     // used in draw()
    this.engine = "file"          // probably remove
    this.peaks = [];              // stores tracks peaks

    this.groupSelect = document.getElementById(opts.showCheckboxId);
    this.group = this.groupSelect ? this.groupSelect.value : 'context';
    this.show = (this.group !== 'off');

    this.analyser = window.makeAnalyser();
    this.gain = window.audioCtx.createGain();

    // --- Group routing (analysis buses) ---
    // Each track connects its *stable* output gain to one bus gain for analysis.
    this._currentBus = null;

    this.gain.gain.value = this.show ? 1 : 0;
    this._applyGroupRouting();

    // permanent wiring
    this.analyser.connect(this.gain);
    this.gain.connect(window.audioCtx.destination);


    //file loading stuff
    this.fileBuffer = null;      // decoded AudioBuffer
    this.fileSource = null;      // current AudioBufferSourceNode
    this.fileInput = null;       // the <input type="file"> assigned to this track
    this.fileInput = document.getElementById("fileInput" + this.id);
    this.fileInput.addEventListener("change", () => this.loadFile());
    this.pitchSlider = document.getElementById("filePitch" + this.id);


    this.pitchSlider.addEventListener("input", () => {
    const r = parseFloat(this.pitchSlider.value);

    // live-update the currently playing loop
    if (this.fileSource) {
      this.fileSource.playbackRate.setValueAtTime(r, window.audioCtx.currentTime);
    }
    });
    
    this._wireUI();
  }


   _applyGroupRouting() {
  // detach from previous bus
  if (this._currentBus) {
    this._currentBus.detach(this);
    this._currentBus = null;
  }

  if (!window.buses) return;

  // if "off", don't attach anywhere
  if (this.group === "off") return;

  const bus = window.buses[this.group];
  if (!bus) return;

  bus.attach(this);
  this._currentBus = bus;
}


  _wireUI() {


if (this.groupSelect) {
    // Apply initial state (in case HTML default is Off)
    this.group = this.groupSelect.value;
    this.show = (this.group !== "off");
    if (this.gain) this.gain.gain.value = this.show ? 1 : 0;
    this._applyGroupRouting();

    // React to changes
    this.groupSelect.addEventListener("change", () => {
      this.group = this.groupSelect.value;
      this.show = (this.group !== "off");

      // mute/unmute
      if (this.gain) {
        this.gain.gain.setValueAtTime(this.show ? 1 : 0, window.audioCtx.currentTime);
      }

      // reconnect to correct bus (or none if off)
      this._applyGroupRouting();
    });
  }
}

buildAudioGraph() {

  if (!this.fileBuffer) return;

  if (this.fileSource) {
    try { this.fileSource.stop(); } catch(e){}
    try { this.fileSource.disconnect(); } catch(e){}
  }

  const src = window.audioCtx.createBufferSource();
  src.buffer = this.fileBuffer;
  src.loop = true;

  src.playbackRate.setValueAtTime(
    parseFloat(this.pitchSlider.value),
    window.audioCtx.currentTime
  );

  src.connect(this.analyser);

  this.fileSource = src;
}


start() {
  if (!this.fileSource && this.fileBuffer) this.buildAudioGraph();
  if (!this.fileSource) return;

  try { this.fileSource.start(); } catch (e) {}
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
  this.fileBuffer = await window.audioCtx.decodeAudioData(arrayBuf);

  console.log("Loaded file for track", this.id);

  // rebuild graph so analyser exists (and fileSource is ready if engine=file)
  this.buildAudioGraph();

  // compute static spectrum
  try {
    const fftSize = this.analyser ? this.analyser.fftSize : 2048;
    const hopSize = fftSize / 4; // more overlap = better visuals

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
  if (window.audioCtx.state !== "running") audioCtx.resume();

  // --- Stop any currently playing audition pair ---
  this.stopAudition();

  const when = window.audioCtx.currentTime; // immediate
  const ratio = Math.pow(2, cents / 1200);

  // Helper to create + start one source at a given playbackRate
  const makeSrc = (rate) => {
    const src = window.audioCtx.createBufferSource();
    src.buffer = this.fileBuffer;
    src.loop = false;
    src.playbackRate.setValueAtTime(rate, when);

    // Route: straight to speakers (cleanest for "audition")
    // If you want it to show up in viz1/viz2, route via analyser/gain instead:
    // src.connect(this.analyser).connect(this.gain);
    src.connect(window.audioCtx.destination);

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
