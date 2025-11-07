// track.js

class Track {
  constructor(opts) {
    this.id = opts.id;           // "A", "B", etc
    this.color = opts.color;     // used in draw()
    this.engineSelect = document.getElementById(opts.engineSelectId);
    this.freqSlider   = document.getElementById(opts.freqSliderId);
    this.freqInput    = document.getElementById(opts.freqInputId);
    this.freqLabel    = document.getElementById(opts.freqLabelId);
    this.showCheckbox = document.getElementById(opts.showCheckboxId);

    // Optional params (for additive / KS)
    this.BSlider      = opts.BSliderId      ? document.getElementById(opts.BSliderId)      : null;
    this.BLabel       = opts.BLabelId       ? document.getElementById(opts.BLabelId)       : null;
    this.posSlider    = opts.posSliderId    ? document.getElementById(opts.posSliderId)    : null;
    this.posLabel     = opts.posLabelId     ? document.getElementById(opts.posLabelId)     : null;
    this.decaySlider  = opts.decaySliderId  ? document.getElementById(opts.decaySliderId)  : null;
    this.decayLabel   = opts.decayLabelId   ? document.getElementById(opts.decayLabelId)   : null;
    this.brightSlider = opts.brightSliderId ? document.getElementById(opts.brightSliderId) : null;
    this.brightLabel  = opts.brightLabelId  ? document.getElementById(opts.brightLabelId)  : null;

    // audio nodes
    this.analyser = null;
    this.gain     = null;
    this.voice    = null;
    this.show     = true;

    this._wireUI();
  }

  _wireUI() {
    // If freq slider / engine select don't exist, this track is "headless"
    if (!this.freqSlider) return;

    if (this.engineSelect) {
      this.engineSelect.addEventListener('change', () => {
        if (!window.audioCtx) return;
        this.rebuildVoice();
        if (window.toggleParamVisibility) {
          window.toggleParamVisibility();
        }
      });
    }

    // freq slider → label, text input, voice
    this.freqSlider.addEventListener('input', () => {
      const f = parseFloat(this.freqSlider.value);
      if (this.freqLabel) this.freqLabel.textContent = f;
      if (this.freqInput) this.freqInput.value = f;
      if (this.voice && this.voice.setFreq) this.voice.setFreq(f);
    });

    if (this.freqInput) {
      this.freqInput.addEventListener('change', () => {
        const f = parseFloat(this.freqInput.value);
        this.freqSlider.value = f;
        if (this.freqLabel) this.freqLabel.textContent = f;
        if (this.voice && this.voice.setFreq) this.voice.setFreq(f);
      });
    }

    if (this.showCheckbox) {
      this.showCheckbox.addEventListener('change', () => {
        this.show = this.showCheckbox.checked;
        if (this.gain) this.gain.gain.value = this.show ? 1 : 0;
      });
    }

    // Additive / KS params

    if (this.BSlider && this.BLabel) {
      this.BSlider.addEventListener('input', () => {
        const v = parseFloat(this.BSlider.value);
        this.BLabel.textContent = v.toFixed(3);
        if (this.voice && this.voice.setB) this.voice.setB(v);
      });
    }

    if (this.posSlider && this.posLabel) {
      this.posSlider.addEventListener('input', () => {
        const v = parseFloat(this.posSlider.value);
        this.posLabel.textContent = v.toFixed(2);
        if (this.voice && this.voice.setPluckPos) this.voice.setPluckPos(v);
      });
    }

    if (this.decaySlider && this.decayLabel) {
      this.decaySlider.addEventListener('input', () => {
        const v = parseFloat(this.decaySlider.value);
        this.decayLabel.textContent = v.toFixed(1);
        if (this.voice && this.voice.setDecay) this.voice.setDecay(v);
      });
    }

    if (this.brightSlider && this.brightLabel) {
      this.brightSlider.addEventListener('input', () => {
        const v = parseFloat(this.brightSlider.value);
        this.brightLabel.textContent = v.toFixed(2);
        if (this.voice && this.voice.setBrightness) this.voice.setBrightness(v);
      });
    }
  }

  buildAudioGraph() {
    if (!window.audioCtx || !window.makeAnalyser || !window.makeVoice) return;

    this.analyser = makeAnalyser();
    this.gain = audioCtx.createGain();
    this.gain.gain.value = this.show ? 1 : 0;

    const f0 = this.freqSlider ? parseFloat(this.freqSlider.value) || 220 : 220;
    const engine = this.engineSelect ? this.engineSelect.value : 'sinOsc';

    const opts = {
      B: this.BSlider ? parseFloat(this.BSlider.value) : 0,
      pos: this.posSlider ? parseFloat(this.posSlider.value) : 0.2,
      decay: this.decaySlider ? parseFloat(this.decaySlider.value) : 2,
      brightness: this.brightSlider ? parseFloat(this.brightSlider.value) : 0.5,
    };

    // kill old voice if any
    if (this.voice && this.voice.stop) this.voice.stop();

    this.voice = makeVoice(engine, f0, opts);
    this.voice.out.connect(this.analyser).connect(this.gain);
    this.gain.connect(audioCtx.destination);
  }

  rebuildVoice() {
    if (this.analyser) this.analyser.disconnect();
    if (this.gain) this.gain.disconnect();
    if (this.voice && this.voice.stop) this.voice.stop();
    this.buildAudioGraph();
  }

  stop() {
    if (this.voice && this.voice.stop) this.voice.stop();
    if (this.analyser) this.analyser.disconnect();
    if (this.gain) this.gain.disconnect();
    this.voice = null;
    this.analyser = null;
    this.gain = null;
  }
}
