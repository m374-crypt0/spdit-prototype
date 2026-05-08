import { Exchanger, Party, SPD } from "src/SPD";
import { Transcoder } from "src/transcoding";

import { afterEach, beforeEach, describe, expect, it, jest, spyOn } from "bun:test";

describe('SPD test suite', () => {
  describe('exchange test suite', () => {
    describe('exchanger instantiation', () => {
      it('should throw at initializing an exchange between an intiator and himself', () => {
        const initiator = new Party('alice')

        expect(() => new Exchanger({ initiator, recipient: initiator }))
          .toThrowError('invalid exchange configuration, initiator must be different from recipient')
      })
    })

    describe('exchange flow', () => {
      describe('initiator and recipient share the same low SPD', () => {
        const lowSPD = new SPD('low')
        const initiator = new Party('alice', new Transcoder({ lowSPD }))
        const recipient = new Party('bob', new Transcoder({ lowSPD }))

        describe('from not_started', () => {
          let exchanger: Exchanger

          beforeEach(() => exchanger = new Exchanger({ initiator, recipient }))

          it('should report the state of an exchange as not_started when instantiated', () => {
            expect(exchanger.state()).toBe('not_started')
          })

          it('should initiate exchange between initiator and recipient then transition to initiating', async () => {
            exchanger.initiate()

            expect(exchanger.state()).toBe('initiating')
          })

          it('should throw if initiate is called while state is already initiating', () => {
            exchanger.initiate()

            expect(() => exchanger.initiate())
              .toThrowError('invalid initiate call')
          })
        })

        describe('from initiating', () => {
          let exchanger: Exchanger
          let asyncInit: Promise<void>

          beforeEach(async () => {
            exchanger = new Exchanger({ initiator, recipient })
            asyncInit = exchanger.initiate()
          })

          it('should eventually transition from initiating to initiated', async () => {
            const computeInitiateExchangeData = spyOn(initiator, 'computeInitiateExchangeData')
            const initiateExchange = spyOn(recipient, 'initiateExchange')

            expect(exchanger.state()).toBe('initiating')

            await asyncInit

            expect(computeInitiateExchangeData).toHaveBeenCalled()
            expect(initiateExchange).toHaveBeenCalled()

            expect(exchanger.state()).toBe('initiated')
          })
        })
      })
    })
  })
})
