// audio.js
// iOS: Tone.start() must be called directly inside a user gesture.
// Sound design: drone/pad + pluck. "energy" modulates filter/reverb.

let AudioEngine = (() => {
  let started = false;

  let limiter, reverb, filter, master;
  let pad, pluck;

  let lastTapTime = 0;

  const scale = ["C", "D", "Eb", "G", "Ab"]; // minor-ish pentatonic
  function noteFromX(xNorm){
    const octave = 3 + Math.floor(xNorm * 3); // 3..5
    const idx = Math.min(scale.length - 1, Math.floor(xNorm * scale.length));
    return `${scale[idx]}${octave}`;
  }

  async function start(){
    if(started) return;

    // MUST be called from user gesture (overlay pointerdown)
    await Tone.start();

    limiter = new Tone.Limiter(-1).toDestination();
    reverb  = new Tone.Reverb({ decay: 6.5, preDelay: 0.01, wet: 0.22 });
    filter  = new Tone.Filter({ type:"lowpass", frequency: 900, Q: 0.7 });
    master  = new Tone.Gain(0.9);

    filter.connect(reverb);
    reverb.connect(master);
    master.connect(limiter);

    pad = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: "sine" },
      envelope: { attack: 0.8, decay: 0.25, sustain: 0.7, release: 3.4 }
    }).connect(filter);

    pluck = new Tone.PluckSynth({
      attackNoise: 0.7,
      dampening: 2600,
      resonance: 0.92
    }).connect(filter);

    // gentle initial chord (quiet)
    const now = Tone.now();
    pad.triggerAttackRelease(["C3","G3","Ab3"], 8, now, 0.08);

    started = true;
  }

  function onTap(xNorm, intensity=0.6){
    if(!started) return;

    const now = Tone.now();
    const dt = now - lastTapTime;
    lastTapTime = now;

    const n = noteFromX(xNorm);
    const vel = Math.min(0.9, 0.18 + intensity * 0.72);

    // short pluck
    pluck.triggerAttackRelease(n, 0.18 + intensity * 0.22, now, vel * 0.9);

    // sparse shimmer
    if(dt > 0.22){
      const n2 = noteFromX((xNorm + 0.19) % 1);
      pad.triggerAttackRelease([n, n2], 2.4, now + 0.02, vel * 0.16);
    }
  }

  function updateEnergy(e){
    if(!started) return;
    const energy = Math.max(0, Math.min(1, e));

    // filter opens with energy
    const f = 520 + energy * 2600;
    filter.frequency.rampTo(f, 0.08);

    // reverb gets wetter with energy
    const w = 0.16 + energy * 0.42;
    reverb.wet.rampTo(w, 0.12);

    // slight gain breathing
    const g = 0.72 + energy * 0.28;
    master.gain.rampTo(g, 0.12);
  }

  return {
    start,
    onTap,
    updateEnergy,
    get started(){ return started; }
  };
})();
