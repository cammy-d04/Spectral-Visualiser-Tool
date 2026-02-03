// track.js

class Track {
  constructor(opts) {
    this.id = opts.id;           // A, B, C etc
    this.color = opts.color;     // used in draw()
    this.engineSelect = document.getElementById(opts.engineSelectId); // synthesis engine select
    this.engine = this.engineSelect ? this.engineSelect.value : "sinOsc";
    this.freqSlider   = document.getElementById(opts.freqSliderId); // frequency slider
    this.freqInput    = document.getElementById(opts.freqInputId); // frequency text input
    this.freqLabel    = document.getElementById(opts.freqLabelId); // frequency label
    this.showCheckbox = document.getElementById(opts.showCheckboxId); // show/hide checkbox


    this.peaks = [];              // stores tracks peaks
    //optional stuff

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
    // If freq slider / engine select don't exist, this track is "headless"
    if (!this.freqSlider) return;

    // if change engine then rebuild audio graph with new voice
    if (this.engineSelect) {
      this.engineSelect.addEventListener('change', () => {
        this.engine = this.engineSelect.value;
        if (!window.audioCtx) return;
        this.rebuildVoice();
        if (window.toggleParamVisibility) { // update visible params
          window.toggleParamVisibility();
        }
      });
    }

    // freq slider updates label, text freq input, tells current voice to change freq
    this.freqSlider.addEventListener('input', () => {
      const f = parseFloat(this.freqSlider.value);
      if (this.freqLabel) this.freqLabel.textContent = f;
      if (this.freqInput) this.freqInput.value = f;
      if (this.voice && this.voice.setFreq) this.voice.setFreq(f);
    });

    // numeric freq input updates slider, label, tells current voice to change freq
    if (this.freqInput) {
      this.freqInput.addEventListener('change', () => {
        const f = parseFloat(this.freqInput.value);
        this.freqSlider.value = f;
        if (this.freqLabel) this.freqLabel.textContent = f;
        if (this.voice && this.voice.setFreq) this.voice.setFreq(f);
      });
    }
// show / hide checkbox, if false, gain set to 0 and draw skips it else show
    if (this.showCheckbox) {
      this.showCheckbox.addEventListener('change', () => {
        this.show = this.showCheckbox.checked;
        if (this.gain) this.gain.gain.value = this.show ? 1 : 0;
      });
    }

    // Additive synthesis params  

    if (this.BSlider && this.BLabel) {
      this.BSlider.addEventListener('input', () => {
        const v = parseFloat(this.BSlider.value);
        this.BLabel.textContent = v.toFixed(3);
        if (this.voice && this.voice.setB) this.voice.setB(v);
      });
    }
// pluck position
    if (this.posSlider && this.posLabel) {
      this.posSlider.addEventListener('input', () => {
        const v = parseFloat(this.posSlider.value);
        this.posLabel.textContent = v.toFixed(2);
        if (this.voice && this.voice.setPluckPos) this.voice.setPluckPos(v);
      });
    }
// decay time
    if (this.decaySlider && this.decayLabel) {
      this.decaySlider.addEventListener('input', () => {
        const v = parseFloat(this.decaySlider.value);
        this.decayLabel.textContent = v.toFixed(1);
        if (this.voice && this.voice.setDecay) this.voice.setDecay(v);
      });
    }
// brightness
    if (this.brightSlider && this.brightLabel) {
      this.brightSlider.addEventListener('input', () => {
        const v = parseFloat(this.brightSlider.value);
        this.brightLabel.textContent = v.toFixed(2);
        if (this.voice && this.voice.setBrightness) this.voice.setBrightness(v);
      });
    }
  }





  buildAudioGraph() {
  console.log(`buildAudioGraph(${this.id}) engine=${this.engineSelect.value}`);

  if (!window.audioCtx || !window.makeAnalyser || !window.makeVoice) return;

  // read engine
  this.engine = this.engineSelect ? this.engineSelect.value : "sinOsc";

  // wipe old nodes
  if (this.voice && this.voice.stop) try { this.voice.stop(); } catch(e){}
  this.voice = null;

  if (this.fileSource) try { this.fileSource.stop(); } catch(e){}
  this.fileSource = null;

  if (this.analyser) this.analyser.disconnect();
  if (this.gain) this.gain.disconnect();

  // rebuild analyser + gain
  this.analyser = makeAnalyser();
  this.gain = audioCtx.createGain();
  this.gain.gain.value = this.show ? 1 : 0;

  // FILE ENGINE FIRST (no makeVoice!)
 if (this.engine === "file") {
  console.log(`Track ${this.id}: FILE ENGINE selected`);
    if (!this.fileBuffer) {
      console.log(`Track ${this.id}: NO FILE LOADED, skipping fileSource`);
      // Don't abort the whole graph. Just skip file node creation.
      this.fileSource = null;
    } else {
      console.log(`Track ${this.id}: building fileSource`);
      const src = audioCtx.createBufferSource();
      src.playbackRate.setValueAtTime(
      parseFloat(this.pitchSlider.value),
      audioCtx.currentTime
      );
      src.buffer = this.fileBuffer;
      src.loop = true;
      src.connect(this.analyser).connect(this.gain);
      this.fileSource = src;
    }
    this.gain.connect(audioCtx.destination);
    return;
}

console.log(`Track ${this.id}: building oscillator voice`);
  // OSC / ADDITIVE ENGINES
  const f0 = this.freqSlider ? parseFloat(this.freqSlider.value) || 220 : 220;

  const opts = {
    B: this.BSlider ? parseFloat(this.BSlider.value) : 0,
    pos: this.posSlider ? parseFloat(this.posSlider.value) : 0.2,
    decay: this.decaySlider ? parseFloat(this.decaySlider.value) : 2,
    brightness: this.brightSlider ? parseFloat(this.brightSlider.value) : 0.5,
  };

  const v = makeVoice(this.engine, f0, opts);
  this.voice = v;

  v.out.connect(this.analyser).connect(this.gain);
  this.gain.connect(audioCtx.destination);
}


  // rebuild audio graph (e.g. on engine change)
  rebuildVoice() {
    if (this.analyser) this.analyser.disconnect();
    if (this.gain) this.gain.disconnect();
    if (this.voice && this.voice.stop) this.voice.stop();
    this.buildAudioGraph();
  }



  start() {
    console.log(`Track ${this.id}.start(), engine=${this.engine}`);
  if (this.engine === "file") {
    console.log(" -> file engine start", this.fileSource);
      if (this.fileSource) {
        console.log(" -> osc engine start", this.voice);
          try { this.fileSource.start(); } catch(e) {}
      }
      return;
  }

  // oscillator engines:
  if (this.voice && this.voice.start) {
      this.voice.start();
  }
}

stop() {
  if (this.engine === "file") {
      if (this.fileSource) {
          try { this.fileSource.stop(); } catch(e){}
      }
      this.fileSource = null;
      return;
  }

  if (this.voice && this.voice.stop) {
      this.voice.stop();
  }
  this.voice = null; 
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
