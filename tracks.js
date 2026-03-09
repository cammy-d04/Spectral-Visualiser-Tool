// track.js
// defines track class (id, colour, file, peaks array, analyser, gain)
// tracks instantiates in main.js and stored in window.tracks array
// handles file loading (decoding audio into aduio buffer)
//creates and controls playback of AudioBufferSourceNode for each track
class Track {
  constructor(opts) { 
    this.id = opts.id;           // A, B, C etc
    this.color = opts.color;     // (prob dont need)

    this.groupSelect = document.getElementById("show" + this.id);
    this.group = this.groupSelect ? this.groupSelect.value : 'context';
    this.show = (this.group !== 'off');

    this.gain = window.audioCtx.createGain();

    // Each track connects its *stable* output gain to one bus gain for analysis.
    this._currentBus = null;

    this.gain.gain.value = this.show ? 1 : 0;
    this._applyGroupRouting();

    //connect to gain
    this.gain.connect(window.audioCtx.destination);

    //file loading stuff
    this.fileBuffer = null;      // decoded AudioBuffer
    this.fileSource = null;      // current AudioBufferSourceNode
    this.fileInput = document.getElementById("fileInput" + this.id); // the <input type="file"> assigned to this track in the html
    this.fileInput.addEventListener("change", () => this.loadFile());

    
    this.volSlider = document.getElementById("vol" + this.id);
    this.volSlider.addEventListener("input", () => {
      const v = parseFloat(this.volSlider.value);
      this.gain.gain.setValueAtTime(v, window.audioCtx.currentTime);

      clearTimeout(this._volDebounce);
      this._volDebounce = setTimeout(() => {
        if (this._currentBus) {
          this._currentBus.computeStaticSpectrum().catch(console.warn);
        }
      }, 150);
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


    this.groupSelect.addEventListener("change", () => {
      this.group = this.groupSelect.value;
      this.show = (this.group !== "off");
      
      if (this.gain) {
        this.gain.gain.setValueAtTime(this.show ? 1 : 0, window.audioCtx.currentTime);
      }
      this._applyGroupRouting();
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


/*
loads file from input, turns it into an audio node then 
kicks off the draw loop if not started already
*/

async loadFile() {
  const file = this.fileInput.files[0]; // get the selected file from input
  if (!file) return;

  const arrayBuf = await file.arrayBuffer(); // read file into arraybuffer
  this.fileBuffer = await window.audioCtx.decodeAudioData(arrayBuf); // turn arraybuffer (raw bytes) into AudioBuffer

  this.buildAudioGraph(); // creates audio node needed to play/analyse file

  await window.audioCtx.resume(); //browsers block audioplayback until user interaction, so resume just in case

  if (!window.vizStarted) { //first time any track loads a file, kicks off draw loop (in viz.js)
    window.vizStarted = true; 
    draw(); 
  }

  //recompute static spectrum if bus selected and file changed
  if (this._currentBus) {
  this._currentBus.computeStaticSpectrum().catch(console.warn);
  }
}






// creates one shot audition source
createAuditionSource(rate, when) {
  if (!this.fileBuffer) return null;

  const src = window.audioCtx.createBufferSource();
  src.buffer = this.fileBuffer;
  src.loop = false;
  src.playbackRate.setValueAtTime(rate, when);

  // Direct to destination ensures the audition sounds don't 
  // mess with the "Live" analyser data used for peaks.
  src.connect(this.gain);
  
  src.start(when);
  return src;
}
}
