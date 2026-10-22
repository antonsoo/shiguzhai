import type { Plan, Tone } from "./core/pitches";

export const LEVEL = 0.16;
export const ATTACK = 0.02;
export const RELEASE = 0.06;
export const SAMPLE_RATE = 48000;

// The live player and WAV renderer use the same graph. A single finite sine
// tone makes the ratios audible without claiming an ancient instrument timbre.
function schedule(context: BaseAudioContext, tone: Tone, offset: number) {
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  const start = offset + tone.start;
  const end = start + tone.duration;
  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(tone.hz, start);
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(LEVEL, start + ATTACK);
  gain.gain.setValueAtTime(LEVEL, end - RELEASE);
  gain.gain.linearRampToValueAtTime(0, end);
  oscillator.connect(gain).connect(context.destination);
  oscillator.start(start);
  oscillator.stop(end);
  oscillator.onended = () => {
    oscillator.disconnect();
    gain.disconnect();
  };
  return { oscillator, gain, start, end };
}
export class Player {
  private context: AudioContext | undefined;
  private generation = 0;
  private nodes: ReturnType<typeof schedule>[] = [];
  private frame = 0;
  stop() {
    this.generation++;
    cancelAnimationFrame(this.frame);
    const now = this.context?.currentTime ?? 0;
    for (const { oscillator, gain, start, end } of this.nodes) {
      // cancelAndHoldAtTime is absent in Firefox. Reconstruct our own linear
      // envelope at cancellation, including scheduled tones not yet started.
      const level =
        now < start || now >= end
          ? 0
          : now < start + ATTACK
            ? (LEVEL * (now - start)) / ATTACK
            : now > end - RELEASE
              ? (LEVEL * (end - now)) / RELEASE
              : LEVEL;
      gain.gain.cancelScheduledValues(now);
      gain.gain.setValueAtTime(level, now);
      gain.gain.linearRampToValueAtTime(0, now + 0.015);
      oscillator.stop(now + 0.02);
    }
    this.nodes = [];
  }
  async play(sequence: Plan, onTone: (tone: Tone | null) => void, onEnd: () => void) {
    this.stop();
    const generation = this.generation;
    this.context ??= new AudioContext();
    await this.context.resume();
    // A stop or a second play during the asynchronous resume wins.
    if (generation !== this.generation) return;
    const context = this.context;
    const offset = context.currentTime + 0.04;
    this.nodes = sequence.tones.map((tone) => schedule(context, tone, offset));
    let previous: Tone | null = null;
    const tick = () => {
      if (generation !== this.generation) return;
      const time = context.currentTime - offset;
      const current =
        sequence.tones.find((tone) => time >= tone.start && time < tone.start + tone.duration) ??
        null;
      if (current !== previous) {
        onTone(current);
        previous = current;
      }
      if (time >= sequence.duration) {
        this.nodes = [];
        onTone(null);
        onEnd();
        return;
      }
      this.frame = requestAnimationFrame(tick);
    };
    tick();
  }
}
export async function renderWav(sequence: Plan): Promise<Blob> {
  const context = new OfflineAudioContext(
    1,
    Math.ceil(sequence.duration * SAMPLE_RATE),
    SAMPLE_RATE,
  );
  for (const tone of sequence.tones) schedule(context, tone, 0);
  const rendered = await context.startRendering();
  const samples = rendered.getChannelData(0);
  const bytes = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(bytes);
  const text = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i));
  };
  text(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  text(8, "WAVE");
  text(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, SAMPLE_RATE, true);
  view.setUint32(28, SAMPLE_RATE * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  text(36, "data");
  view.setUint32(40, samples.length * 2, true);
  samples.forEach((sample, index) => {
    view.setInt16(44 + index * 2, Math.round(Math.max(-1, Math.min(1, sample)) * 32767), true);
  });
  return new Blob([bytes], { type: "audio/wav" });
}
