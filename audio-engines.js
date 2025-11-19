


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