/* AudioManager - Synthesizes retro sounds using the Web Audio API */

export class AudioManager {
  constructor() {
    this.ctx = null;
    this.masterVolume = null;
    this.muted = false;
  }

  // Initialize the AudioContext (must be triggered by a user interaction)
  init() {
    if (this.ctx) return;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.masterVolume = this.ctx.createGain();
      this.masterVolume.gain.setValueAtTime(0.25, this.ctx.currentTime); // Comfortable master volume
      this.masterVolume.connect(this.ctx.destination);
    } catch (e) {
      console.error("Web Audio API is not supported in this browser:", e);
    }
  }

  resume() {
    this.init();
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  // Synthesize normal clown hit
  playHit() {
    this.resume();
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime;

    // 1. Thump (Triangle)
    const oscThump = this.ctx.createOscillator();
    const gainThump = this.ctx.createGain();
    oscThump.type = 'triangle';
    oscThump.frequency.setValueAtTime(160, now);
    oscThump.frequency.exponentialRampToValueAtTime(40, now + 0.12);
    gainThump.gain.setValueAtTime(1.0, now);
    gainThump.gain.exponentialRampToValueAtTime(0.01, now + 0.12);
    oscThump.connect(gainThump);
    gainThump.connect(this.masterVolume);
    oscThump.start(now);
    oscThump.stop(now + 0.13);

    // 2. High pop (Sine)
    const oscPop = this.ctx.createOscillator();
    const gainPop = this.ctx.createGain();
    oscPop.type = 'sine';
    oscPop.frequency.setValueAtTime(700, now);
    oscPop.frequency.exponentialRampToValueAtTime(120, now + 0.07);
    gainPop.gain.setValueAtTime(0.6, now);
    gainPop.gain.exponentialRampToValueAtTime(0.01, now + 0.07);
    oscPop.connect(gainPop);
    gainPop.connect(this.masterVolume);
    oscPop.start(now);
    oscPop.stop(now + 0.08);
  }

  // Synthesize bomb explosion sound
  playExplosion() {
    this.resume();
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime;

    // Create noise buffer for explosion texture
    const bufferSize = this.ctx.sampleRate * 0.4;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    // Noise filter (lowpass to make it rumble)
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(300, now);
    filter.frequency.linearRampToValueAtTime(10, now + 0.4);

    const gainNode = this.ctx.createGain();
    gainNode.gain.setValueAtTime(1.2, now);
    gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.4);

    noise.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(this.masterVolume);

    // Low pitch synth element for weight
    const subOsc = this.ctx.createOscillator();
    const subGain = this.ctx.createGain();
    subOsc.type = 'sawtooth';
    subOsc.frequency.setValueAtTime(100, now);
    subOsc.frequency.linearRampToValueAtTime(20, now + 0.3);
    subGain.gain.setValueAtTime(1.0, now);
    subGain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
    
    subOsc.connect(subGain);
    subGain.connect(this.masterVolume);

    noise.start(now);
    noise.stop(now + 0.4);
    subOsc.start(now);
    subOsc.stop(now + 0.3);
  }

  // Synthesize staccato cartoon clown laugh: "Heh-heh-heh-heh!"
  playLaugh() {
    this.resume();
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime;

    // Play a sequence of 6 notes, alternating high/low, with pitch vibrato
    const laughNotes = [523.25, 659.25, 523.25, 659.25, 587.33, 783.99]; // C5, E5, C5, E5, D5, G5
    const noteDuration = 0.07;
    const noteGap = 0.09;

    laughNotes.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gainNode = this.ctx.createGain();

      osc.type = 'square'; // buzzy retro cartoon sound
      osc.frequency.setValueAtTime(freq, now + idx * noteGap);
      
      // Pitch slide up slightly during note
      osc.frequency.linearRampToValueAtTime(freq + 40, now + idx * noteGap + noteDuration);

      gainNode.gain.setValueAtTime(0, now + idx * noteGap);
      gainNode.gain.linearRampToValueAtTime(0.4, now + idx * noteGap + 0.01);
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + idx * noteGap + noteDuration);

      // Lowpass filter to make the square wave a bit warmer
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1500, now + idx * noteGap);

      osc.connect(filter);
      filter.connect(gainNode);
      gainNode.connect(this.masterVolume);

      osc.start(now + idx * noteGap);
      osc.stop(now + idx * noteGap + noteDuration + 0.01);
    });
  }

  // Synthesize low-frequency warning siren for multiple clown spawns
  playWarning() {
    this.resume();
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime;

    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gainNode = this.ctx.createGain();

    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(110, now);
    osc1.frequency.linearRampToValueAtTime(160, now + 0.25);
    osc1.frequency.linearRampToValueAtTime(110, now + 0.5);

    osc2.type = 'sawtooth';
    osc2.frequency.setValueAtTime(111.5, now); // Detune slightly for chorusing effect
    osc2.frequency.linearRampToValueAtTime(161.5, now + 0.25);
    osc2.frequency.linearRampToValueAtTime(111.5, now + 0.5);

    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(0.6, now + 0.05);
    gainNode.gain.linearRampToValueAtTime(0.6, now + 0.45);
    gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.5);

    // Filter out very harsh high frequencies
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(600, now);

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(this.masterVolume);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.5);
    osc2.stop(now + 0.5);
  }

  // Synthesize freeze power-up sound
  playFreeze() {
    this.resume();
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime;

    // High crystalline sine chords sliding downwards
    const frequencies = [1500, 1300, 1100, 900];
    const delay = 0.06;

    frequencies.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gainNode = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * delay);
      osc.frequency.exponentialRampToValueAtTime(freq - 200, now + idx * delay + 0.5);

      gainNode.gain.setValueAtTime(0, now + idx * delay);
      gainNode.gain.linearRampToValueAtTime(0.5, now + idx * delay + 0.02);
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + idx * delay + 0.5);

      osc.connect(gainNode);
      gainNode.connect(this.masterVolume);

      osc.start(now + idx * delay);
      osc.stop(now + idx * delay + 0.55);
    });
  }

  // Synthesize double points power-up sound
  playDouble() {
    this.resume();
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime;

    // A classic retro coin arpeggio
    const osc = this.ctx.createOscillator();
    const gainNode = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, now); // D5
    osc.frequency.setValueAtTime(880.00, now + 0.08); // A5

    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(0.7, now + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    osc.connect(gainNode);
    gainNode.connect(this.masterVolume);

    osc.start(now);
    osc.stop(now + 0.36);
  }

  // Synthesize Game Over music/chord
  playGameOver() {
    this.resume();
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime;

    const baseFrequencies = [220, 277.18, 329.63, 440]; // A minor / major shift down
    const slideDuration = 0.8;

    baseFrequencies.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gainNode = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now);
      osc.frequency.linearRampToValueAtTime(freq * 0.6, now + slideDuration); // Slide down pitch

      gainNode.gain.setValueAtTime(0, now);
      gainNode.gain.linearRampToValueAtTime(0.4, now + 0.05);
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + slideDuration);

      osc.connect(gainNode);
      gainNode.connect(this.masterVolume);

      osc.start(now);
      osc.stop(now + slideDuration + 0.05);
    });
  }

  // Synthesize generic interface click
  playClick() {
    this.resume();
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gainNode = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(450, now);
    osc.frequency.exponentialRampToValueAtTime(150, now + 0.05);

    gainNode.gain.setValueAtTime(0.4, now);
    gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.05);

    osc.connect(gainNode);
    gainNode.connect(this.masterVolume);

    osc.start(now);
    osc.stop(now + 0.06);
  }
}
