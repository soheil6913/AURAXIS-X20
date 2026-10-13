// Web Audio API Sound Generator for Ground Scan & Metal/Cavity Detection

class ScannerAudioEngine {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;

  private getContext(): AudioContext {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
  }

  // Play a quick impulse ping tone when user captures a step in scan mode
  public playStepPing(adcValue: number) {
    if (this.isMuted) return;
    try {
      const ctx = this.getContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      // Normalize base frequency (Higher ADC / Gold = Higher pitch 600Hz-1800Hz; Low/Cavity = 150Hz)
      const normalizedAdc = Math.min(Math.max(adcValue, 0), 1024);
      const freq = 180 + (normalizedAdc / 1024) * 1200;

      osc.type = adcValue > 600 ? 'sine' : adcValue < 300 ? 'sawtooth' : 'triangle';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);

      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.12);
    } catch {
      // ignore audio errors
    }
  }

  // Play continuous tracker tone based on live magnetometer signal
  public playLiveSignalTone(adcValue: number, phaseShift: number) {
    if (this.isMuted) return;
    try {
      const ctx = this.getContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      // Phase > 0 usually indicates metallic reaction, Phase < 0 indicates void/cavity
      const isMetal = phaseShift > 10 || adcValue > 550;
      const isCavity = phaseShift < -10 || adcValue < 300;

      let freq = 400;
      if (isMetal) {
        freq = 600 + Math.min(adcValue, 1024) * 1.2; // High beep for metal/gold
      } else if (isCavity) {
        freq = 150 + Math.max(adcValue, 0) * 0.4; // Low hum for cavity
      }

      osc.type = isMetal ? 'sine' : isCavity ? 'sawtooth' : 'triangle';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);

      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.08);
    } catch {
      // ignore
    }
  }

  // Play a celebratory multi-frequency chime when scan completes
  public playScanCompleteChime() {
    if (this.isMuted) return;
    try {
      const ctx = this.getContext();
      const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.08);

        gain.gain.setValueAtTime(0.12, ctx.currentTime + idx * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.08 + 0.3);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(ctx.currentTime + idx * 0.08);
        osc.stop(ctx.currentTime + idx * 0.08 + 0.3);
      });
    } catch {
      // ignore
    }
  }
}

export const audioEngine = new ScannerAudioEngine();
