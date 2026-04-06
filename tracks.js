
// track.js
// defines track class (id, colour, file, peaks array, analyser, gain)
// tracks instantiates in main.js and stored in window.tracks array
// handles file loading (decoding audio into audio buffer)
//creates and controls playback of AudioBufferSourceNode for each track


export class Track {
  constructor(opts) {
    this.id = opts.id;
    this.group = 'off';
    this.gain = window.audioCtx.createGain();
    this._currentBus = null;
    this.gain.gain.value = 1;
    this.gain.connect(window.audioCtx.destination);

    this.fileBuffer = null;
    this.fileSource = null;
    this.cropStart = 0;
    this.cropEnd = 1;
    this.pitchRate = 1.0;
  }

setGroup(group) {
    this.group = group;

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




  async initialiseFile(file) {

    const arrayBuf = await file.arrayBuffer();
    this.fileBuffer = await window.audioCtx.decodeAudioData(arrayBuf);

    if (!this.fileBuffer) return;

    //cleans up any previous source if it exists (if loading new file onto track, replacing old one)
    if (this.fileSource) {
      try { this.fileSource.stop(); } catch(e){}
      try { this.fileSource.disconnect(); } catch(e){}
    }

    const src = window.audioCtx.createBufferSource(); //creates buffer source node (tape player basically)
    src.buffer = this.fileBuffer; //put tape in tape player
    // plug tape players output into the analyser input
    //chain is AudioBufferSourceNode -> AnalyserNode -> GainNode -> Destination
    // also:   AudioBufferSourceNode -> AnalyserNode -> GroupBus GainNode -> GroupBus AnalyserNode
    src.connect(this.gain);

    // we don't connect the source directly to destination because we want to be able to control the gain
    // (for muting when switching groups) or pitch change or whatever.
    this.fileSource = src;
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


}
