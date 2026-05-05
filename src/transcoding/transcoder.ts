import { SPD } from "src/SPD";

export class Transcoder {
  constructor() {
    this.highSPD = new SPD('high')
  }

  readonly highSPD: SPD
}
