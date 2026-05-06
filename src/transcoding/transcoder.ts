import { SPD } from "src/SPD";

export class Transcoder {
  encodeHighSPD(spd: SPD) {
    if (spd.laneSize !== 256)
      throw new Error('only high SPD can be encoded')

    this.setupLowSPDForEncoding()

    const b = Buffer.from(new ArrayBuffer(spd.size * 2, { maxByteLength: spd.size * 2 }))
    const m = this.encodingLowSPD!

    spd.readonlyBufferView()
      .forEach((byte, index) => {
        const lowNibble = byte & 0x0f
        const highNibble = (byte & 0xf0) >> 4

        const i = index * 2

        b[i] = m.get(lowNibble)![0]!
        b[i + 1] = m.get(highNibble)![0]!
      })

    return b
  }

  decodeToHighSPD(buffer: Readonly<Buffer<ArrayBuffer>>) {
    if (buffer.byteLength !== 256 * 256 * 2)
      throw new Error('invalid buffer, likely not an encoded high SPD')

    this.setupLowSPDForDecoding()
    const l = this.lowSPD!.readonlyBufferView()

    const b = Buffer.from(new ArrayBuffer(256 * 256))

    b.forEach((_, index) => {
      const i = index * 2

      const lowAddress = buffer[i]!
      const highAddress = buffer[i + 1]!

      const lowNibble = l[lowAddress]!
      const highNibble = l[highAddress]!
      const byte = (highNibble << 4) | lowNibble

      b[index] = byte
    })

    return SPD.from(b)
  }

  private setupLowSPDForDecoding() {
    if (this.encodingLowSPD)
      return

    this.lowSPD = this.lowSPD ?? new SPD('low')
  }

  private setupLowSPDForEncoding() {
    this.setupLowSPDForDecoding()

    if (this.encodingLowSPD)
      return

    this.encodingLowSPD = new Map<number, number[]>

    const m = this.encodingLowSPD

    this.lowSPD!.readonlyBufferView()
      .forEach((nibble, i) => {
        const a = m.get(nibble) ?? []
        a.push(i)
        m.set(nibble, a)
      })
  }

  private lowSPD: SPD | undefined
  private encodingLowSPD: Map<number, number[]> | undefined
}
