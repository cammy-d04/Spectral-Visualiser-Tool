// track.js
// defines track class (id, colour, file, peaks array, analyser, gain)
// tracks instantiates in main.js and stored in window.tracks array
// handles file loading (decoding audio into aduio buffer)
//creates and controls playback of AudioBufferSourceNode for each track
class Track {
  constructor(opts) { 
    this.id = opts.id;           // A, B, C etc

    this.groupSelect = document.getElementById("show" + this.id);
    this.group = this.groupSelect ? this.groupSelect.value : 'context'; 
    this.show = (this.group !== 'off');

    this.gain = window.audioCtx.createGain();

    // Each track connects its output gain to one bus gain for analysis.
    this._currentBus = null;

    this.gain.gain.value = this.show ? 1 : 0;
    this._applyGroupRouting();
    this._updateBottomRowColor();

    //connect to gain
    this.gain.connect(window.audioCtx.destination);

    //file loading stuff
    this.fileBuffer = null;      // decoded AudioBuffer
    this.fileSource = null;      // current AudioBufferSourceNode

    this.fileInput = document.getElementById("fileInput" + this.id); // get file
    this.fileInput.addEventListener("change", () => this.loadFile());

    // crop bounds as fractions 0..1 of file duration
    // crop bounds as fractions 0..1 of file duration
    this.cropStart = 0;
    this.cropEnd = 1;
    this.pitchRate = 1.0;



    // pitch slider and vol slider
    this.pitchValueLabel = document.getElementById("filePitchVal" + this.id);
    this.volValueLabel = document.getElementById("volVal" + this.id);
// pitch slider
this.pitchSlider = document.getElementById("filePitch" + this.id);
if (this.pitchSlider) {
  // set initial visible value
  if (this.pitchValueLabel) {
    this.pitchValueLabel.textContent = Number(this.pitchSlider.value).toFixed(2);
  }

  this.pitchSlider.addEventListener("input", () => {
    this.pitchRate = parseFloat(this.pitchSlider.value);

    // update visible number
    if (this.pitchValueLabel) {
      this.pitchValueLabel.textContent = this.pitchRate.toFixed(2);
    }
    this._scheduleBusRecompute();
    });
}

this.volSlider = document.getElementById("vol" + this.id);
if (this.volSlider) {
  // set initial visible value
  if (this.volValueLabel) {
    this.volValueLabel.textContent = Number(this.volSlider.value).toFixed(2);
  }

  this.volSlider.addEventListener("input", () => {
    const v = parseFloat(this.volSlider.value);

    // update visible number
    if (this.volValueLabel) {
      this.volValueLabel.textContent = v.toFixed(2);
    }

    this.gain.gain.setValueAtTime(v, window.audioCtx.currentTime);

    this._scheduleBusRecompute();
  });
}

    // crop sliders
    this.cropStartSlider = document.getElementById("cropStart" + this.id);
    this.cropEndSlider = document.getElementById("cropEnd" + this.id);
    this.cropStartVal = document.getElementById("cropStartVal" + this.id);
    this.cropEndVal = document.getElementById("cropEndVal" + this.id);

    this._refreshCropLabels();

   if (this.cropStartSlider) {
  this.cropStartSlider.addEventListener("input", () => {
    let v = parseFloat(this.cropStartSlider.value);
    if (v >= this.cropEnd) v = this.cropEnd - 0.01;
    this.cropStart = Math.max(0, v);
    this.cropStartSlider.value = this.cropStart;
    this._refreshCropLabels();
    this._scheduleBusRecompute();
  });
}

if (this.cropEndSlider) {
  this.cropEndSlider.addEventListener("input", () => {
    let v = parseFloat(this.cropEndSlider.value);
    if (v <= this.cropStart) v = this.cropStart + 0.01;
    this.cropEnd = Math.min(1, v);
    this.cropEndSlider.value = this.cropEnd;
    this._refreshCropLabels();
    this._scheduleBusRecompute();
  });
}

    this._wireUI();
  }



  _applyGroupRouting() {
    // detach from previous bus
    if (this. _currentBus) {
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
    // Apply initial state
    this.group = this.groupSelect.value;
    this.show = (this.group !== "off");
    if (this.gain) this.gain.gain.value = this.show ? 1 : 0;
    this._applyGroupRouting();


    this.groupSelect.addEventListener("change", () => {
      this.group = this.groupSelect.value;
      this.show = (this.group !== "off");
      if (this.gain) {
        this.gain.gain.value = this.show ? 1 : 0;
      }
      this._applyGroupRouting();
      this._updateBottomRowColor();
      //this._currentBus.computeStaticSpectrum().catch(console.warn);
    });
  }
}
/*
creates buffer
*/
buildAudioGraph() {

  if (!this.fileBuffer) return; 

  //cleans up any previous source if it exists (if loading new file onto track, replacing old one)
  if (this.fileSource) {
    try { this.fileSource.stop(); } catch(e){}
    try { this.fileSource.disconnect(); } catch(e){}
  }

  const src = window.audioCtx.createBufferSource(); //creates buffer source node (tape player basically)
  src.buffer = this.fileBuffer; //put tape in tape player
  src.loop = false;

  // plug tape players output into the analyser input
  //chain is AudioBufferSourceNode -> AnalyserNode -> GainNode -> Destination
  // also:   AudioBufferSourceNode -> AnalyserNode -> GroupBus GainNode -> GroupBus AnalyserNode
  src.connect(this.gain);

  // we don't connect the source directly to destination because we want to be able to control the gain 
  // (for muting when switching groups) or pitch change or whatever.
  this.fileSource = src;
}

/*
loads file from input, turns it into an audio node then 
kicks off the draw loop if not started already
*/

async loadFile() {
  const file = this.fileInput.files[0]; // get the selected file from input
  if (!file) return;

  console.log(`Track ${this.id}: loadFile started`);
  const arrayBuf = await file.arrayBuffer(); // read file into arraybuffer
  this.fileBuffer = await window.audioCtx.decodeAudioData(arrayBuf); // turn arraybuffer (raw bytes) into AudioBuffer

  console.log(`Track ${this.id}: fileBuffer ready`);
  this.buildAudioGraph(); // creates audio node needed to play/analyse file
  this._refreshCropLabels();

  await window.audioCtx.resume(); //browsers block audioplayback until user interaction, so resume just in case

  if (!window.vizStarted) { //first time any track loads a file, kicks off draw loop (in viz.js)
    window.vizStarted = true; 
    draw(); 
  }

  //recompute static spectrum if bus selected and file changed
  if (this._currentBus) { 
  console.log(`Bus ${this._currentBus.id} recomputing static spectrum due to file load on track ${this.id}`);
  this._currentBus.computeStaticSpectrum().catch(console.warn);
  }
}


_scheduleBusRecompute() {
  clearTimeout(this._busRecomputeDebounce);
  this._busRecomputeDebounce = setTimeout(() => {
    if (this._currentBus) {
      this._currentBus.computeStaticSpectrum().catch(console.warn);
      window.rebuildDissonanceCurve();
    }
  }, 150);
}

_formatSecondsFromFraction(frac) {
  if (!this.fileBuffer) return `${Number(frac).toFixed(2)} s`;
  return `${(frac * this.fileBuffer.duration).toFixed(2)} s`;
}

_refreshCropLabels() {
  if (this.cropStartVal) this.cropStartVal.textContent = this._formatSecondsFromFraction(this.cropStart);
  if (this.cropEndVal) this.cropEndVal.textContent = this._formatSecondsFromFraction(this.cropEnd);
}


getCropSeconds() {
  if (!this.fileBuffer) return { offset: 0, duration: 0 };
  const dur = this.fileBuffer.duration;
  const offset = this.cropStart * dur;
  const duration = (this.cropEnd - this.cropStart) * dur;
  return { offset, duration };
}

getCropSamples() {
  if (!this.fileBuffer) return { startSample: 0, endSample: 0 };
  const len = this.fileBuffer.length;
  const startSample = Math.round(this.cropStart * len);
  const endSample = Math.round(this.cropEnd * len);
  return { startSample, endSample };
}


previewPlay() {
  if (!this.fileBuffer) return;

  this.previewStop(); 

  const btn = document.getElementById('previewBtn' + this.id);

 const doPlay = () => {
    const src = window.audioCtx.createBufferSource();
    src.buffer = this.fileBuffer;
    src.loop = false;
    src.playbackRate.value = this.pitchRate || 1.0;

    const { offset, duration } = this.getCropSeconds();
    src.connect(this.gain);
    src.start(0, offset, duration);
    this._previewSrc = src;

    if (btn) { btn.textContent = '⏹ Stop'; btn.classList.add('previewing'); }

    src.onended = () => {
      this._previewSrc = null;
      if (btn) { btn.textContent = '▶ Preview'; btn.classList.remove('previewing'); }
    };
  };

  if (window.audioCtx.state === 'running') {
    doPlay();
  } else {
    window.audioCtx.resume().then(doPlay);
  }
}

previewStop() {
  if (this._previewSrc) {
    try { this._previewSrc.stop(); } catch (e) {}
    this._previewSrc = null;
  }
  const btn = document.getElementById('previewBtn' + this.id);
  if (btn) { btn.textContent = '▶ Preview'; btn.classList.remove('previewing'); }
}




// creates one shot audition source
createAuditionSource(rate, when) {
  if (!this.fileBuffer) return null;

  const src = window.audioCtx.createBufferSource();
  src.buffer = this.fileBuffer;
  src.loop = false;
  src.playbackRate.setValueAtTime(rate * (this.pitchRate || 1.0), when);

  const {offset, duration} = this.getCropSeconds();

  // Direct to destination ensures the audition sounds don't 
  // mess with the "Live" analyser data used for peaks.
  src.connect(this.gain);
  
  src.start(when, offset, duration);
  return src;
}

_updateBottomRowColor() {
  const row = document.getElementById('previewBtn' + this.id)?.closest('.trackBottomRow');
  if (!row) return;
  if (this.group === 'complement') row.style.background = '#5e8ec3';
  else if (this.group === 'context') row.style.background = '#bb5858';
  else row.style.background = '#b0b0b0';
}
}
