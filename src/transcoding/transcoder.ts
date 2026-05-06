import { SPD } from "src/SPD";
import { UniformUint64DistributionEngine } from "src/stochastic/distributionEngines";

/**
 * A transcoder has both encoding and decoding in charge.
 * It can either transcode arbitrary data or be more specific and transcode
 * high SPD
 */
export class Transcoder {
  /**
   * Specifically encode a SPD of 'high' type using a SPD of 'low' type to do
   * so.
   * @param highSPD a 'high' type SPD. Passing a 'low' type SPD throws
   * @throws Error if the spd parameter is not of 'high' type
   * @returns A buffer view on the encoded high SPD
   */
  encodeHighSPD(highSPD: SPD) {
    if (highSPD.laneSize !== SPD.HIGH_LANE_SIZE)
      throw new Error('only high SPD can be encoded')

    const map = this.initAndGetLowSPDForEncoding()
    const buffer = Buffer.from(new ArrayBuffer(highSPD.size * SPD.DIMENSIONAL_FACTOR, { maxByteLength: highSPD.size * SPD.DIMENSIONAL_FACTOR }))
    const d = new UniformUint64DistributionEngine

    highSPD.readonlyBufferView()
      .forEach((byte, index) => {
        const lowNibble = byte & 0x0f
        const highNibble = (byte & 0xf0) >> 4
        const i = index * SPD.DIMENSIONAL_FACTOR
        const lowNibbleAddresses = map.get(lowNibble)!
        const highNibbleAddresses = map.get(highNibble)!
        const lowNibbleAddress = lowNibbleAddresses[Number(d.newUint([0n, BigInt(lowNibbleAddresses.length - 1)]))]!
        const highNibbleAddress = highNibbleAddresses[Number(d.newUint([0n, BigInt(highNibbleAddresses.length - 1)]))]!

        buffer[i] = lowNibbleAddress
        buffer[i + 1] = highNibbleAddress
      })

    return buffer
  }

  /**
   * Decodes a well-sized buffer to a 'high' type SPD.
   * @param encodedSPDBuffer the supposed encoded SPD. Only the buffer byteLength is
   * check for validity
   * @throws Error if the buffer size does not match with an encoded 'high'
   * type SPD
   * @returns a 'high' type SPD
   */
  decodeToHighSPD(encodedSPDBuffer: Readonly<Buffer<ArrayBuffer>>) {
    if (encodedSPDBuffer.byteLength !== SPD.HIGH_SPD_SIZE * SPD.DIMENSIONAL_FACTOR)
      throw new Error('invalid buffer, likely not an encoded high SPD')

    const lowSpd = this.initAndGetLowSPDForDecoding().readonlyBufferView()
    const spdBuffer = Buffer.from(new ArrayBuffer(SPD.HIGH_SPD_SIZE))

    spdBuffer.forEach((_, index) => {
      const i = index * SPD.DIMENSIONAL_FACTOR

      const lowAddress = encodedSPDBuffer[i]!
      const highAddress = encodedSPDBuffer[i + 1]!

      const lowNibble = lowSpd[lowAddress]!
      const highNibble = lowSpd[highAddress]!
      const byte = (highNibble << 4) | lowNibble

      spdBuffer[index] = byte
    })

    return SPD.from(spdBuffer)
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
