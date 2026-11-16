import { writeFileSync } from "node:fs"

const sampleRate = 22050
const seconds = 2
const count = sampleRate * seconds
const pcm = Buffer.alloc(count * 2)

for (let i = 0; i < count; i++) {
  const t = i / sampleRate
  const attack = Math.min(1, t / 0.08)
  const release = Math.min(1, (seconds - t) / 0.25)
  const env = attack * release * Math.exp(-0.45 * t)
  const sample =
    env *
    (0.34 * Math.sin(2 * Math.PI * 392 * t) +
      0.18 * Math.sin(2 * Math.PI * 494 * t) +
      0.06 * Math.sin(2 * Math.PI * 587.33 * t))
  const clamped = Math.max(-1, Math.min(1, sample))
  pcm.writeInt16LE(Math.round(clamped * 32767), i * 2)
}

const header = Buffer.alloc(44)
header.write("RIFF", 0)
header.writeUInt32LE(36 + pcm.length, 4)
header.write("WAVE", 8)
header.write("fmt ", 12)
header.writeUInt32LE(16, 16)
header.writeUInt16LE(1, 20)
header.writeUInt16LE(1, 22)
header.writeUInt32LE(sampleRate, 24)
header.writeUInt32LE(sampleRate * 2, 28)
header.writeUInt16LE(2, 32)
header.writeUInt16LE(16, 34)
header.write("data", 36)
header.writeUInt32LE(pcm.length, 40)

const out = new URL("../public/samples/harbor-tone.wav", import.meta.url)
writeFileSync(out, Buffer.concat([header, pcm]))
console.log(`wrote ${out.pathname} (${36 + pcm.length + 8} bytes)`)
