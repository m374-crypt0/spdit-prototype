import { Party } from "src/SPD";
import { Transcoder } from "src/transcoding";

import { describe, expect, it } from "bun:test";

describe('SPD test suite', () => {
  describe('exchange test suite', () => {
    describe('party test suite', () => {
      it('should construct a party with an optional transcoder and always have a default transcoder in any case', () => {
        const alice = new Party('alice', new Transcoder)
        const bob = new Party('bob')

        expect(alice).toHaveProperty('transcoder')
        expect(bob).toHaveProperty('transcoder')
      })
    })
  })
})

