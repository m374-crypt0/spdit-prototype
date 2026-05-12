import { SPD } from "src/transcoding";
import { SplitMix64, UniformUint64, Xoroshiro128Plus } from "src/stochastic";
import { UniformUint64DistributionEngine } from "src/stochastic/distributionEngines";

/**
 * A transcoder has both encoding and decoding in charge.
 * It can either transcode arbitrary data or be more specific and transcode
 * high SPD
 */
export class Transcoder {
  constructor(options?: ConstructorOptions) {
    if (options && options.lowSPD && options.lowSPD.laneSize !== SPD.LOW_LANE_SIZE)
      throw new Error('invalid low SPD specified')

    if (options && options.highSPD && options.highSPD.laneSize !== SPD.HIGH_LANE_SIZE)
      throw new Error('invalid high SPD specified')

    this.lowSPD_ = options?.lowSPD
    this.highSPD_ = options?.highSPD
  }

  /**
   * get a readonly reference to the underlying low SPD
   */
  lowSPD(): Readonly<SPD> {
    return this.initAndGetLowSPDForDecoding()
  }

  /**
   * get a readonly reference to the underlying high SPD
   */
  highSPD(): Readonly<SPD> {
    return this.initAndGetHighSPDForDecoding()
  }

  /**
   * Specifically encode a SPD of 'high' type using a SPD of 'low' type to do
   * so.
   * @param highSPD a 'high' type SPD. Passing a 'low' type SPD throws
   * @param options various options to modify the default behavior of this function
   * @throws Error if the spd parameter is not of 'high' type
   * @returns A buffer view on the encoded high SPD
   */
  encodeHighSPD(highSPD: SPD, options?: EncodeOptions) {
    if (highSPD.laneSize !== SPD.HIGH_LANE_SIZE)
      throw new Error('only high SPD can be encoded')

    const map = this.initAndGetLowSPDForEncoding()
    const buffer = Buffer.from(new ArrayBuffer(highSPD.size * SPD.DIMENSIONAL_FACTOR, { maxByteLength: highSPD.size * SPD.DIMENSIONAL_FACTOR }))
    const d = new UniformUint64DistributionEngine(new Xoroshiro128Plus(new SplitMix64(options?.seed)))

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

  /**
   * Encode arbitrary data using a 'high SPD'
   * @param data data to encode
   * @param options various options to modify the default behavior of this function
   * @returns A buffer view on the encoded data
   */
  encode(data: Readonly<Buffer<ArrayBuffer>>, options?: EncodeOptions): Readonly<Buffer<ArrayBuffer>> {
    if (data.byteLength === 0)
      return Buffer.from(new ArrayBuffer(0))

    const map = this.initAndGetHighSPDForEncoding()
    const buffer = new ArrayBuffer(data.byteLength * SPD.DIMENSIONAL_FACTOR)
    const dv = new DataView(buffer)
    const d = new UniformUint64(new Xoroshiro128Plus(new SplitMix64(options?.seed)))

    data
      .forEach((byte, index) => {
        const addresses = map.get(byte)!
        const address = addresses[Number(d.newUint([0n, BigInt(addresses.length - 1)]))]!
        const i = index * SPD.DIMENSIONAL_FACTOR

        dv.setUint16(i, address)
      })

    return Buffer.from(buffer)
  }

  /**
   * Decodes a well-sized buffer of encoded data
   * @param encodedData the supposed encoded data. Only the buffer byteLength
   * alignment check for validity
   * @throws Error if the buffer size alignment does not match with the
   * dimensional factor of the transcoding scheme
   * @returns decoded data in regard of the high SPD of this transcoder instance
   */
  decode(encodedData: Readonly<Buffer<ArrayBuffer>>): Readonly<Buffer<ArrayBuffer>> {
    if (encodedData.byteLength === 0)
      return Buffer.from(new ArrayBuffer(0))

    if (encodedData.byteLength % SPD.DIMENSIONAL_FACTOR !== 0)
      throw new Error('invalid encoded data')

    const highSPD = this.initAndGetHighSPDForDecoding().readonlyBufferView()
    const buffer = Buffer.from(new ArrayBuffer(encodedData.byteLength / SPD.DIMENSIONAL_FACTOR))
    const dv = new DataView(encodedData.buffer)

    buffer.forEach((_, index) => {
      const i = index * SPD.DIMENSIONAL_FACTOR
      const address = dv.getUint16(i)

      buffer[index] = highSPD[address]!
    })

    return buffer
  }

  private initAndGetLowSPDForDecoding() {
    return this.lowSPD_ = this.lowSPD_ ?? new SPD('low')
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

  private initAndGetHighSPDForDecoding() {
    return this.highSPD_ = this.highSPD_ ?? new SPD('high')
  }

  private initAndGetHighSPDForEncoding() {
    if (this.encodingHighSPD)
      return this.encodingHighSPD

    const highSPD = this.initAndGetHighSPDForDecoding()

    const map = this.encodingHighSPD = new Map<number, number[]>

    highSPD.readonlyBufferView()
      .forEach((byte, i) =>
        map.set(byte, [...map.get(byte) ?? [], i]))

    return map
  }

  private lowSPD_: Readonly<SPD> | undefined
  private highSPD_: Readonly<SPD> | undefined
  private encodingLowSPD: Map<number, number[]> | undefined
  private encodingHighSPD: Map<number, number[]> | undefined
}

type EncodeOptions = {
  /**
   * If defined, this seed will be used to make the random selection of address
   * deterministic. Using the same seed for more than one encoding has
   * catastrophic effects on the encoding security as it exposes repetitions in
   * chosen addresses for the encoded data.
   */
  seed?: bigint
}

type ConstructorOptions = {
  /**
   * A pre-built high SPD to intialize this transcoder instance with
   */
  highSPD?: Readonly<SPD>

  /**
   * A pre-built low SPD to intialize this transcoder instance with
   */
  lowSPD?: Readonly<SPD>
}
