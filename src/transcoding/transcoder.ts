import { SPD } from "src/SPD";

/**
 * A transcoder has both encoding and decoding in charge.
 * It can either transcode arbitrary data or be more specific and transcode
 * high SPD
 */
export class Transcoder {
  /**
   * Specifically encode a SPD of 'high' type using a SPD of 'low' type to do
   * so.
   * @param spd a 'high' type SPD. Passing a 'low' type SPD throws
   * @throws Error if the spd parameter is not of 'high' type
   * @returns A buffer view on the encoded high SPD
   */
  encodeHighSPD(spd: SPD) {
    if (spd.laneSize !== 256)
      throw new Error('only high SPD can be encoded')

    const map = this.initAndGetLowSPDForEncoding()
    const buffer = Buffer.from(new ArrayBuffer(spd.size * 2, { maxByteLength: spd.size * 2 }))

    spd.readonlyBufferView()
      .forEach((byte, index) => {
        const lowNibble = byte & 0x0f
        const highNibble = (byte & 0xf0) >> 4
        const i = index * 2

        buffer[i] = map.get(lowNibble)![0]!
        buffer[i + 1] = map.get(highNibble)![0]!
      })

    return buffer
  }

  /**
   * Decodes a well-sized buffer to a 'high' type SPD.
   * @param buffer the supposed encoded SPD. Only the buffer byteLength is
   * check for validity
   * @throws Error if the buffer size does not match with an encoded 'high'
   * type SPD
   * @returns a 'high' type SPD
   */
  decodeToHighSPD(buffer: Readonly<Buffer<ArrayBuffer>>) {
    if (buffer.byteLength !== 256 * 256 * 2)
      throw new Error('invalid buffer, likely not an encoded high SPD')

    const l = this.initAndGetLowSPDForDecoding().readonlyBufferView()
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

  private initAndGetLowSPDForDecoding() {
    return this.lowSPD = this.lowSPD ?? new SPD('low')
  }

  private initAndGetLowSPDForEncoding() {
    if (this.encodingLowSPD)
      return this.encodingLowSPD

    const lowSPD = this.initAndGetLowSPDForDecoding()

    const map = this.encodingLowSPD = new Map<number, number[]>

    lowSPD.readonlyBufferView()
      .forEach((nibble, i) =>
        map.set(nibble, [...map.get(nibble) ?? [], i]))

    return map
  }

  private lowSPD: SPD | undefined
  private encodingLowSPD: Map<number, number[]> | undefined
}
