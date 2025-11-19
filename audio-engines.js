


// =====================
// Engines
// =====================

// make basic sine wave oscillator voice
function makeSinOsc(f){
  const osc = audioCtx.createOscillator();
  osc.type = 'sine';
  const g = audioCtx.createGain();
  g.gain.value = 0.12; // gain setting
  osc.frequency.value = f; // initial freq
  osc.connect(g); // connect osc to gain
  osc.start();

  return {
    in: null, // no input node
    out: g, //audio output node
    setFreq: (hz)=>osc.frequency.setValueAtTime(hz, audioCtx.currentTime), // freq changer
    stop: ()=>{// if stop called, stop and disconnect nodes
      try{osc.stop();}catch(e){} // in case already stopped
      osc.disconnect();
      g.disconnect();
    }
  };
}

// triangle wave oscillator voice
function makeTriOsc(f){
  const osc = audioCtx.createOscillator();
  osc.type = 'triangle';
  const g = audioCtx.createGain();
  g.gain.value = 0.12;
  osc.frequency.value = f;
  osc.connect(g);
  osc.start();

  return {
    in: null,
    out: g,
    setFreq: (hz)=>osc.frequency.setValueAtTime(hz, audioCtx.currentTime),
    stop: ()=>{
      try{osc.stop();}catch(e){}
      osc.disconnect();
      g.disconnect();
    }
  };
}

// square wave oscillator voice
function makeSquareOsc(f){
  const osc = audioCtx.createOscillator();
  osc.type = 'square';
  const g = audioCtx.createGain();
  g.gain.value = 0.12;
  osc.frequency.value = f;
  osc.connect(g);
  osc.start();

  return {
    in: null,
    out: g,
    setFreq: (hz)=>osc.frequency.setValueAtTime(hz, audioCtx.currentTime),
    stop: ()=>{
      try{osc.stop();}catch(e){}
      osc.disconnect();
      g.disconnect();
    }
  };
}




// Additive string model with slight inharmonicity
// f_n = n f0 * sqrt(1 + B n^2)
// amplitude_n = (sin(pi n p) / n) to mimic pluck position p in (0,1)
function makeAdditiveString(f0, B, p){
  const group = audioCtx.createGain();
  group.gain.value = 0.09;
  const N = 24; // TWENTY FOUR PARTIALS
  const oscs = [];

  // track base frequency and current B so updates behave
  let baseF0 = f0;
  let curB   = B;

  const freqFor = (n) => baseF0 * n * Math.sqrt(1 + curB * n * n);

  for(let n=1; n<=N; n++){
    const fn = freqFor(n);
    const amp = Math.abs(Math.sin(Math.PI * n * p)) / n; // rolloff around 1/n
    const o = audioCtx.createOscillator();
    o.type = 'sine';
    const g = audioCtx.createGain();
    g.gain.value = amp;
    o.frequency.value = fn;
    o.connect(g).connect(group);
    o.start();
    oscs.push({o, g, n});
  }

  return {
    in: null,
    out: group,

    // frequency setter
    setFreq: (hz)=>{ // update all frequencies based on new f0
      baseF0 = hz;
      for(const {o,n} of oscs){
        const fn = freqFor(n);
        o.frequency.setValueAtTime(fn, audioCtx.currentTime);
      }
    },
    // inharmonicity B setter
    setB: (B2)=>{
      curB = B2;
      for(const {o,n} of oscs){ // update all frequencies based on new B
        const fn = freqFor(n);
        o.frequency.setValueAtTime(fn, audioCtx.currentTime);
      }
    },
    // pluck position setter
    setPluckPos: (p2)=>{ // update all gains based on new p
      for(const {g,n} of oscs){
        const amp = Math.abs(Math.sin(Math.PI * n * p2)) / n;
        g.gain.setValueAtTime(amp, audioCtx.currentTime);
      }
    },
    // stop everything
    stop: ()=>{
      oscs.forEach(({o,g})=>{
        try{o.stop();}catch(e){}
        o.disconnect();
        g.disconnect();
      });
      group.disconnect();
    }
  };
}







// Piano sample voice for engineA === 'pianoSample'
//audiobuffer = decoded audiobuffer of sample
//nominalpitchHz = estimate of pitch of sample
//pitch = target pitch to play at now
//offset = start pos (s)
// pianovoiceA = current active voice object for A
function makePianoSampleVoice(audioBuffer, {startSec = 0, pitchHz = 220, nominalHz = 220} ={}) {
//create an audiobuffersourcenode, read file into it and play 
//can change pitch via playback rate and where in file to start (start(when, offset))
//wrap it in voice object so acts like other engines with .out, .setfreq, etc...
  const outGain = audioCtx.createGain();
  outGain.gain.value = 0.8;

  let srcNode = null; 
  let currentStartSec = startSec; 
  let currentPitchHz = pitchHz;
  let currentNominalHz = nominalHz;

  function playNow() {
    stop();

    const src = audioCtx.createBufferSource();
    src.buffer = audioBuffer;

    // playbackRate = desiredPitch / nominalPitch
    const ratio = currentNominalHz > 0 ? (currentPitchHz / currentNominalHz) : 1;
    src.playbackRate.value = ratio;

    const clampedStart = Math.min(
      Math.max(currentStartSec, 0),
      audioBuffer.duration - 0.001
    );

    src.connect(outGain);
    src.start(0, clampedStart);

    srcNode = src;
  }

  function stop(){
    if (srcNode){
      try{ srcNode.stop(); }catch(e){}
      try{ srcNode.disconnect(); }catch(e){}
      srcNode = null;
    }
  }

  function setFreq(hz){
    currentPitchHz = hz;
    if (srcNode && currentNominalHz > 0){
      const ratio = currentPitchHz / currentNominalHz;
      srcNode.playbackRate.setValueAtTime(ratio, audioCtx.currentTime);
    }
  }

  function setStart(sec){
    currentStartSec = sec;
    // don't scrub mid play you hit retrigger to hear new slice
  }

  function retrigger(){
    playNow();
  }

  // fire once on creation so A behaves like other engines and is audible immediately
  playNow();

  return {
    out: outGain,
    setFreq,
    setStart,
    retrigger,
    stop
  };
}




//builds voices for A or B depending on engine
function makeVoice(engine, f0, opts){

  // pianoSample only for A for now
  if (engine === 'pianoSample') {
    if (!pianoBufA){
      const g = audioCtx.createGain();
      g.gain.value = 0.0;
      return {
        out: g,
        setFreq: ()=>{},
        setStart: ()=>{},
        retrigger: ()=>{},
        stop: ()=>{ g.disconnect(); }
      };
    }

    // create pianoSample voice using global A state
    pianoVoiceA = makePianoSampleVoice(pianoBufA, {
      startSec: pianoOffsetA,
      pitchHz: pianoPitchHzA,
      nominalHz: pianoNominalHzA
    });

    return pianoVoiceA;
  }

  if(engine === 'sinOsc')       return makeSinOsc(f0);
  if(engine === 'triangleOsc')  return makeTriOsc(f0);
  if(engine === 'squareOsc')    return makeSquareOsc(f0);
  if(engine === 'add')          return makeAdditiveString(f0, opts.B || 0, opts.pos || 0.2);
}