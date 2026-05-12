import { Exchanger, Initiator, Recipient } from "src/exchange";

import { describe, expect, it } from "bun:test";

describe('exchange test suite', () => {
  describe('exchanger instantiation', () => {
    describe('exchanger instantiation', () => {
      it('should throw when instantiating an exchanger with peers having the same identifier', () => {
        const initiator = new Initiator('alice')
        const recipient = new Recipient('alice')

        expect(() => new Exchanger({ initiator, recipient }))
          .toThrowError('invalid peers specified')
      })

      it('should initialize the exchanger state to not_started at instantitation', () => {
        const exchanger = new Exchanger({
          initiator: new Initiator('alice'),
          recipient: new Recipient('bob')
        })

        expect(exchanger.state()).toBe('not_started')
      })
    })
  })
})
