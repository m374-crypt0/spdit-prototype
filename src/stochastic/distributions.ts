import type { UniformRandomBitGenerator } from "./uniformRandomBitGenerators";

export class UniformUint64<State, Value> {
  constructor(urbg: UniformRandomBitGenerator<State, Value>) { }

  newUint64(range: [bigint, bigint]) {
    return 11n;
  }
}
