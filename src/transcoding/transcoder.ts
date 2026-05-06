import type { SPD } from "src/SPD";

export class Transcoder {
  encodeHighSPD(spd: SPD) {
    throw new Error('only high SPD can be encoded')
  }
}
