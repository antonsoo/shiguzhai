import { bellAt } from "./bells";
import { coupling, pitches, type State } from "./model";
export const SAMPLE_RATE = 44100;
export const DURATION = 2;
export function strikeSamples(s: State): Float32Array<ArrayBuffer> {
  const frequencies = pitches(bellAt(s.bell), s.tuning);
  if (!frequencies) throw new RangeError("This paper reports no pitch for the selected bell.");
  const weights = coupling(s.angle),
    pcm = new Float32Array(SAMPLE_RATE * DURATION);
  for (let i = 0; i < pcm.length; i++) {
    const t = i / SAMPLE_RATE,
      envelope = Math.min(1, t / 0.008) * Math.min(1, (DURATION - t) / 0.025) * Math.exp(-t / 0.65);
    pcm[i] =
      0.14 *
      envelope *
      (weights.a * Math.sin(2 * Math.PI * frequencies.a * t) +
        weights.b * Math.sin(2 * Math.PI * frequencies.b * t));
  }
  return pcm;
}
export function wavBytes(s: State): Uint8Array<ArrayBuffer> {
  const info = (key: string, text: string) => {
    const encoded = new TextEncoder().encode(`${text}\0`);
    const chunk = new Uint8Array(8 + encoded.length + (encoded.length % 2));
    chunk.set(new TextEncoder().encode(key));
    new DataView(chunk.buffer).setUint32(4, encoded.length, true);
    chunk.set(encoded, 8);
    return chunk;
  };
  const bell = bellAt(s.bell),
    pair = pitches(bell, s.tuning);
  if (!pair) throw new RangeError("This paper reports no pitch for the selected bell.");
  const metadata = [
    info("INAM", `Shuang ${bell.label}, ${s.angle} degree model strike, ${s.tuning}`),
    info("ISFT", "Shuang - https://antonsoo.github.io/shiguzhai/shuang.html"),
    info(
      "ICMT",
      `New synthesized teaching signal, not an ancient bell recording. Two damped sine waves; a=${pair.a} Hz, b=${pair.b} Hz; cos(2 theta), sin(2 theta) coupling. ${s.tuning === "measured" ? "Published frequencies at 30 C" : "Modern semitone projection anchored to 364.07 Hz, not ancient tuning evidence"}. Source: Takahashi (1989), Table 2, DOI 10.1250/ast.10.299. Higher modes, original timbre and actual damping are absent.`,
    ),
  ];
  const metadataSize = 4 + metadata.reduce((size, chunk) => size + chunk.length, 0);
  const samples = strikeSamples(s),
    buffer = new ArrayBuffer(44 + samples.length * 2 + 8 + metadataSize),
    view = new DataView(buffer);
  const ascii = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i));
  };
  ascii(0, "RIFF");
  view.setUint32(4, buffer.byteLength - 8, true);
  ascii(8, "WAVE");
  ascii(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, SAMPLE_RATE, true);
  view.setUint32(28, SAMPLE_RATE * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  ascii(36, "data");
  view.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++)
    view.setInt16(44 + i * 2, Math.round((samples[i] ?? 0) * 32767), true);
  let offset = 44 + samples.length * 2;
  ascii(offset, "LIST");
  view.setUint32(offset + 4, metadataSize, true);
  ascii(offset + 8, "INFO");
  offset += 12;
  for (const chunk of metadata) {
    new Uint8Array(buffer).set(chunk, offset);
    offset += chunk.length;
  }
  return new Uint8Array(buffer);
}
export class Listening {
  private context: AudioContext | null = null;
  private source: AudioBufferSourceNode | null = null;
  private request = 0;
  stop() {
    this.request++;
    this.source?.stop();
    this.source = null;
  }
  async play(s: State, ended: () => void) {
    this.stop();
    const request = this.request;
    this.context ??= new AudioContext();
    await this.context.resume();
    if (request !== this.request) return;
    const samples = strikeSamples(s),
      buffer = this.context.createBuffer(1, samples.length, SAMPLE_RATE);
    buffer.getChannelData(0).set(samples);
    const source = this.context.createBufferSource();
    source.buffer = buffer;
    source.connect(this.context.destination);
    this.source = source;
    source.onended = () => {
      if (request === this.request) {
        this.source = null;
        ended();
      }
    };
    source.start();
  }
}
