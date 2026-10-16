import { Audio } from 'expo-av';
import { Platform } from 'react-native';

// Helper to generate a minimal valid PCM WAV data URI
function generateToneWavDataUri(
  durationSec: number,
  sampleRate: number,
  generator: (t: number) => number
): string {
  const numSamples = Math.floor(sampleRate * durationSec);
  const buffer = new Uint8Array(44 + numSamples * 2);

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      buffer[offset + i] = str.charCodeAt(i);
    }
  };

  const writeUint32 = (offset: number, val: number) => {
    buffer[offset] = val & 0xff;
    buffer[offset + 1] = (val >> 8) & 0xff;
    buffer[offset + 2] = (val >> 16) & 0xff;
    buffer[offset + 3] = (val >> 24) & 0xff;
  };

  const writeUint16 = (offset: number, val: number) => {
    buffer[offset] = val & 0xff;
    buffer[offset + 1] = (val >> 8) & 0xff;
  };

  // RIFF header
  writeString(0, 'RIFF');
  writeUint32(4, 36 + numSamples * 2);
  writeString(8, 'WAVE');

  // fmt chunk
  writeString(12, 'fmt ');
  writeUint32(16, 16); // SubChunk1Size (16 for PCM)
  writeUint16(20, 1); // AudioFormat (1 = PCM)
  writeUint16(22, 1); // NumChannels (1 = Mono)
  writeUint32(24, sampleRate);
  writeUint32(28, sampleRate * 2); // ByteRate
  writeUint16(32, 2); // BlockAlign
  writeUint16(34, 16); // BitsPerSample

  // data chunk
  writeString(36, 'data');
  writeUint32(40, numSamples * 2);

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const sample = Math.max(-1, Math.min(1, generator(t)));
    const int16 = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
    const offset = 44 + i * 2;
    buffer[offset] = int16 & 0xff;
    buffer[offset + 1] = (int16 >> 8) & 0xff;
  }

  // Convert buffer to binary string
  let binary = '';
  const len = buffer.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(buffer[i]);
  }

  // Base64 encode
  let base64 = '';
  const globalBuf = (globalThis as any).Buffer;
  if (typeof btoa !== 'undefined') {
    base64 = btoa(binary);
  } else if (globalBuf) {
    base64 = globalBuf.from(buffer).toString('base64');
  } else {
    // Basic fallback base64
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    for (let i = 0; i < binary.length; i += 3) {
      const a = binary.charCodeAt(i);
      const b = i + 1 < binary.length ? binary.charCodeAt(i + 1) : 0;
      const c = i + 2 < binary.length ? binary.charCodeAt(i + 2) : 0;
      base64 += chars[a >> 2];
      base64 += chars[((a & 3) << 4) | (b >> 4)];
      base64 += i + 1 < binary.length ? chars[((b & 15) << 2) | (c >> 6)] : '=';
      base64 += i + 2 < binary.length ? chars[c & 63] : '=';
    }
  }

  return `data:audio/wav;base64,${base64}`;
}

export class CarSoundEngine {
  private static instance: CarSoundEngine;

  // Web Audio Context (if available)
  private audioCtx: any = null;
  private engineOsc1: any = null;
  private engineOsc2: any = null;
  private engineGain: any = null;
  private filterNode: any = null;
  private distortionNode: any = null;

  // Screech synth
  private screechOsc: any = null;
  private screechGain: any = null;

  // Current car profile
  private currentProfile: 'classic_twincam' | 'modern_inline4' | 'aggressive_inline6' =
    'classic_twincam';
  private isEngineRunning: boolean = false;
  private isScreeching: boolean = false;
  private masterVolume: number = 0.9;
  private lastRpm: number = 900;

  // Sound cache for expo-av fallback
  private sfxSounds: Map<string, Audio.Sound> = new Map();

  private constructor() {
    this.initAudio();
  }

  public static getInstance(): CarSoundEngine {
    if (!CarSoundEngine.instance) {
      CarSoundEngine.instance = new CarSoundEngine();
    }
    return CarSoundEngine.instance;
  }

  private async initAudio() {
    try {
      if (Platform.OS !== 'web') {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
          shouldDuckAndroid: true,
        });
      }
    } catch (e) {
      console.warn('Audio.setAudioModeAsync warning:', e);
    }

    // Try Web Audio API in browser or web environment
    if (typeof window !== 'undefined') {
      const AudioCtx =
        window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        try {
          this.audioCtx = new AudioCtx();
        } catch {
          // ignore
        }
      }
    }
  }

  private resumeContext() {
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
  }

  public setVolume(volume: number) {
    this.masterVolume = Math.max(0, Math.min(1, volume));
    if (this.engineGain) {
      this.engineGain.gain.setValueAtTime(
        0.2 * this.masterVolume,
        this.audioCtx.currentTime
      );
    }
  }

  public setCarProfile(profile: 'classic_twincam' | 'modern_inline4' | 'aggressive_inline6') {
    this.currentProfile = profile;
    if (this.isEngineRunning) {
      this.stopEngine();
      this.startEngine(profile);
    }
  }

  public startEngine(profile?: 'classic_twincam' | 'modern_inline4' | 'aggressive_inline6') {
    if (profile) this.currentProfile = profile;
    this.resumeContext();

    if (!this.audioCtx) {
      this.isEngineRunning = true;
      this.playStartupCrank();
      return;
    }

    if (this.isEngineRunning) return;
    this.isEngineRunning = true;

    try {
      const now = this.audioCtx.currentTime;

      // Master Gain for engine
      this.engineGain = this.audioCtx.createGain();
      this.engineGain.gain.setValueAtTime(0.01, now);
      this.engineGain.gain.linearRampToValueAtTime(0.25 * this.masterVolume, now + 0.5);

      // Lowpass Filter for exhaust dampening
      this.filterNode = this.audioCtx.createBiquadFilter();
      this.filterNode.type = 'lowpass';
      this.filterNode.frequency.setValueAtTime(650, now);
      this.filterNode.Q.setValueAtTime(3.0, now);

      // Wave shaper for mechanical grit / exhaust rasp
      this.distortionNode = this.audioCtx.createWaveShaper();
      this.distortionNode.curve = this.makeDistortionCurve(
        this.currentProfile === 'aggressive_inline6' ? 24 : 12
      );
      this.distortionNode.oversample = '4x';

      // Primary Oscillator (fundamental cylinder pulse)
      this.engineOsc1 = this.audioCtx.createOscillator();
      this.engineOsc1.type =
        this.currentProfile === 'classic_twincam' ? 'sawtooth' : 'triangle';
      this.engineOsc1.frequency.setValueAtTime(35, now);

      // Secondary Sub/Harmonic Oscillator
      this.engineOsc2 = this.audioCtx.createOscillator();
      this.engineOsc2.type =
        this.currentProfile === 'aggressive_inline6' ? 'sawtooth' : 'square';
      this.engineOsc2.frequency.setValueAtTime(70, now);

      // Wiring nodes
      this.engineOsc1.connect(this.distortionNode);
      this.engineOsc2.connect(this.distortionNode);
      this.distortionNode.connect(this.filterNode);
      this.filterNode.connect(this.engineGain);
      this.engineGain.connect(this.audioCtx.destination);

      this.engineOsc1.start();
      this.engineOsc2.start();
    } catch (e) {
      console.warn('WebAudio engine start error:', e);
    }
  }

  private makeDistortionCurve(amount: number) {
    const k = amount;
    const nSamples = 44100;
    const curve = new Float32Array(nSamples);
    const deg = Math.PI / 180;
    for (let i = 0; i < nSamples; ++i) {
      const x = (i * 2) / nSamples - 1;
      curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
    }
    return curve;
  }

  public stopEngine() {
    this.isEngineRunning = false;
    if (this.engineOsc1) {
      try {
        this.engineOsc1.stop();
        this.engineOsc1.disconnect();
      } catch {}
      this.engineOsc1 = null;
    }
    if (this.engineOsc2) {
      try {
        this.engineOsc2.stop();
        this.engineOsc2.disconnect();
      } catch {}
      this.engineOsc2 = null;
    }
    if (this.engineGain) {
      try {
        this.engineGain.disconnect();
      } catch {}
      this.engineGain = null;
    }
  }

  public updateRPM(rpm: number, throttle: number, gear: number) {
    this.lastRpm = rpm;
    if (!this.isEngineRunning || !this.audioCtx || !this.engineOsc1) return;

    try {
      const now = this.audioCtx.currentTime;

      // Calculate frequencies based on cylinder count
      // 4-cylinder (Fiat, Optra): 2 ignition pulses per rev -> baseFreq = rpm / 60 * 2
      // 6-cylinder (BMW E30): 3 ignition pulses per rev -> baseFreq = rpm / 60 * 3
      let pulseMultiplier = 2;
      let timbreSharpness = 1.0;

      if (this.currentProfile === 'classic_twincam') {
        // Raw carbureted twin-cam: throaty mid-range
        pulseMultiplier = 2.1;
        timbreSharpness = 1.2 + throttle * 0.4;
      } else if (this.currentProfile === 'modern_inline4') {
        // Smooth civil 4-cyl
        pulseMultiplier = 1.95;
        timbreSharpness = 0.9 + throttle * 0.2;
      } else if (this.currentProfile === 'aggressive_inline6') {
        // Raspy inline-6 M20 screaming up to redline
        pulseMultiplier = 3.0;
        timbreSharpness = 1.5 + throttle * 0.7;
      }

      const fundamentalFreq = Math.max(22, (rpm / 60) * pulseMultiplier);
      const subHarmonicFreq = fundamentalFreq * 1.5;

      this.engineOsc1.frequency.setTargetAtTime(fundamentalFreq, now, 0.05);
      if (this.engineOsc2) {
        this.engineOsc2.frequency.setTargetAtTime(subHarmonicFreq, now, 0.05);
      }

      // Filter cutoff opens up as throttle and RPM increase
      const filterCutoff = Math.min(
        6500,
        450 + (rpm / 7500) * 3500 + throttle * 1800 * timbreSharpness
      );
      if (this.filterNode) {
        this.filterNode.frequency.setTargetAtTime(filterCutoff, now, 0.05);
      }

      // Volume increases under load / throttle
      const engineVol =
        (0.18 + 0.15 * (rpm / 7500) + 0.12 * throttle) * this.masterVolume;
      if (this.engineGain) {
        this.engineGain.gain.setTargetAtTime(engineVol, now, 0.04);
      }
    } catch {}
  }

  public playStartupCrank() {
    this.resumeContext();
    if (this.audioCtx) {
      try {
        const now = this.audioCtx.currentTime;
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(28, now);
        osc.frequency.linearRampToValueAtTime(80, now + 0.4);
        osc.frequency.linearRampToValueAtTime(45, now + 0.8);

        gain.gain.setValueAtTime(0.25 * this.masterVolume, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.85);

        osc.connect(gain);
        gain.connect(this.audioCtx.destination);
        osc.start(now);
        osc.stop(now + 0.85);
      } catch {}
    }
  }

  public playGearShift() {
    this.resumeContext();
    if (this.audioCtx) {
      try {
        const now = this.audioCtx.currentTime;

        // Mechanical metallic clunk
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(140, now);
        osc.frequency.exponentialRampToValueAtTime(40, now + 0.12);

        gain.gain.setValueAtTime(0.3 * this.masterVolume, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

        osc.connect(gain);
        gain.connect(this.audioCtx.destination);
        osc.start(now);
        osc.stop(now + 0.12);

        // Transmission gear gate click
        const clickOsc = this.audioCtx.createOscillator();
        const clickGain = this.audioCtx.createGain();
        clickOsc.type = 'triangle';
        clickOsc.frequency.setValueAtTime(420, now + 0.04);
        clickGain.gain.setValueAtTime(0.2 * this.masterVolume, now + 0.04);
        clickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

        clickOsc.connect(clickGain);
        clickGain.connect(this.audioCtx.destination);
        clickOsc.start(now + 0.04);
        clickOsc.stop(now + 0.14);
      } catch {}
    }
  }

  public playTireScreech(intensity: number = 1.0) {
    this.resumeContext();
    const clampedIntensity = Math.min(1.0, Math.max(0.1, intensity));

    if (this.audioCtx) {
      if (!this.screechGain) {
        try {
          const now = this.audioCtx.currentTime;
          this.screechGain = this.audioCtx.createGain();
          this.screechGain.gain.setValueAtTime(0.01, now);

          // Dual modulated bandpass filtered screech
          const filter = this.audioCtx.createBiquadFilter();
          filter.type = 'bandpass';
          filter.frequency.setValueAtTime(1800, now);
          filter.Q.setValueAtTime(4.0, now);

          this.screechOsc = this.audioCtx.createOscillator();
          this.screechOsc.type = 'sawtooth';
          this.screechOsc.frequency.setValueAtTime(850, now);

          this.screechOsc.connect(filter);
          filter.connect(this.screechGain);
          this.screechGain.connect(this.audioCtx.destination);

          this.screechOsc.start(now);
          this.isScreeching = true;
        } catch {}
      }

      if (this.screechGain && this.screechOsc) {
        const now = this.audioCtx.currentTime;
        const targetVol = 0.22 * clampedIntensity * this.masterVolume;
        this.screechGain.gain.setTargetAtTime(targetVol, now, 0.05);
        this.screechOsc.frequency.setTargetAtTime(
          750 + clampedIntensity * 320,
          now,
          0.05
        );
      }
    }
  }

  public stopTireScreech() {
    if (this.screechGain && this.audioCtx) {
      const now = this.audioCtx.currentTime;
      this.screechGain.gain.setTargetAtTime(0.0001, now, 0.08);
      setTimeout(() => {
        if (this.screechOsc) {
          try {
            this.screechOsc.stop();
            this.screechOsc.disconnect();
          } catch {}
          this.screechOsc = null;
        }
        if (this.screechGain) {
          try {
            this.screechGain.disconnect();
          } catch {}
          this.screechGain = null;
        }
        this.isScreeching = false;
      }, 100);
    }
  }

  public playHorn() {
    this.resumeContext();
    if (this.audioCtx) {
      try {
        const now = this.audioCtx.currentTime;
        const osc1 = this.audioCtx.createOscillator();
        const osc2 = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();

        // Dual automotive horn chords (F and A)
        osc1.type = 'triangle';
        osc1.frequency.setValueAtTime(349.23, now); // F4
        osc2.type = 'triangle';
        osc2.frequency.setValueAtTime(440.0, now); // A4

        gain.gain.setValueAtTime(0.28 * this.masterVolume, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(this.audioCtx.destination);

        osc1.start(now);
        osc2.start(now);
        osc1.stop(now + 0.45);
        osc2.stop(now + 0.45);
      } catch {}
    }
  }

  public playHandbrake() {
    this.resumeContext();
    if (this.audioCtx) {
      try {
        // Multi-notch mechanical ratchet sound
        const now = this.audioCtx.currentTime;
        for (let i = 0; i < 4; i++) {
          const t = now + i * 0.04;
          const osc = this.audioCtx.createOscillator();
          const gain = this.audioCtx.createGain();
          osc.type = 'square';
          osc.frequency.setValueAtTime(900 + i * 150, t);
          gain.gain.setValueAtTime(0.2 * this.masterVolume, t);
          gain.gain.exponentialRampToValueAtTime(0.001, t + 0.025);

          osc.connect(gain);
          gain.connect(this.audioCtx.destination);
          osc.start(t);
          osc.stop(t + 0.025);
        }
      } catch {}
    }
  }

  public playTurnSignal() {
    this.resumeContext();
    if (this.audioCtx) {
      try {
        const now = this.audioCtx.currentTime;
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1200, now);
        gain.gain.setValueAtTime(0.08 * this.masterVolume, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.035);

        osc.connect(gain);
        gain.connect(this.audioCtx.destination);
        osc.start(now);
        osc.stop(now + 0.035);
      } catch {}
    }
  }

  public playCollision(intensity: number = 1.0) {
    this.resumeContext();
    if (this.audioCtx) {
      try {
        const now = this.audioCtx.currentTime;
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(110, now);
        osc.frequency.exponentialRampToValueAtTime(25, now + 0.35);

        const clamped = Math.min(1.0, Math.max(0.2, intensity));
        gain.gain.setValueAtTime(0.4 * clamped * this.masterVolume, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

        osc.connect(gain);
        gain.connect(this.audioCtx.destination);
        osc.start(now);
        osc.stop(now + 0.35);
      } catch {}
    }
  }
}

export const soundEngine = CarSoundEngine.getInstance();
