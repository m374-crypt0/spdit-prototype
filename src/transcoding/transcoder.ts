import type { SPD } from "src/SPD";

export class Transcoder {
  encodeHighSPD(spd: SPD) {
    if (spd.laneSize != 256)
      throw new Error('only high SPD can be encoded')

    return Buffer.alloc(spd.size * 2)
  }
}
