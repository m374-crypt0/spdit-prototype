import { Exchanger, Party, SPD } from "src/SPD";
import { Transcoder } from "src/transcoding";

import { beforeEach, describe, expect, it, spyOn } from "bun:test";

describe('SPD test suite', () => {
  describe('exchange test suite', () => {
    describe('exchange instantiation', () => {
      it('should throw at initializing an exchange between an intiator and himself', () => {
        const initiator = new Party('alice')
        const recipient = new Party('bob')

        expect(() => new Exchanger({ initiator, recipient: initiator }))
          .toThrowError('invalid exchange configuration, initiator must be different from recipient')

        expect(() => new Exchanger({ initiator, recipient })).not.toThrow()
      })
    })

    describe('exchange flow', () => {
      describe('initiator and recipient share the same low SPD', () => {
        const lowSPD = new SPD('low')
        const initiator = new Party('alice', new Transcoder({ lowSPD }))
        const recipient = new Party('bob', new Transcoder({ lowSPD }))

        describe('from not_started', () => {
          let exchange: Exchanger

          beforeEach(() => exchange = new Exchanger({ initiator, recipient }))

          it('should report the state of an exchange as not_started when instantiated', () => {
            expect(exchange.state()).toBe('not_started')
          })

          it('should initiate exchange between initiator and recipient then transition to initiating', async () => {
            const computeInitiateExchangeData = spyOn(initiator, 'computeInitiateExchangeData')
            const initiateExchange = spyOn(recipient, 'initiateExchange')

            await exchange.initiate()

            expect(computeInitiateExchangeData).toHaveBeenCalledTimes(1)
            expect(initiateExchange).toHaveBeenCalledTimes(1)
            expect(exchange.state()).toBe('initiating')
          })

          it('should throw if initiate is called while state is already initiating', async () => {
            await exchange.initiate()

            expect(async () => await exchange.initiate())
              .toThrowError('invalid initiate call')
          })
        })

        describe('from initiating', () => {
          let exchange: Exchanger

          beforeEach(async () => {
            exchange = new Exchanger({ initiator, recipient })
            await exchange.initiate()
          })

          it('should eventually transition from initiating to initiated, updating the initiator state', () => {
          })
        })
      })
    })
  })
})
