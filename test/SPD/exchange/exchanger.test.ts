import { Exchanger, Party, SPD } from "src/SPD";
import { Transcoder } from "src/transcoding";

import { beforeEach, describe, expect, it, spyOn } from "bun:test";

describe('SPD test suite', () => {
  describe('exchange test suite', () => {
    describe('exchanger instantiation', () => {
      it('should throw at initializing an exchange between an intiator and himself', () => {
        const initiator = new Party('alice')

        expect(() => new Exchanger({ initiator, recipient: initiator }))
          .toThrowError('invalid exchange configuration, initiator must be different from recipient')
      })

      it('should report the state of an exchange as not_started when instantiated', () => {
        const initiator = new Party('alice')
        const recipient = new Party('bob')
        expect(new Exchanger({ initiator, recipient }).state()).toBe('not_started')
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

          it('should throw if initiate is called while state is not not_started', () => {
            exchanger.initiate()

            expect(() => exchanger.initiate())
              .toThrowError('invalid initiate call')
          })

          it('should initiate exchange between initiator and recipient then transition to initiating', async () => {
            exchanger.initiate()

            expect(exchanger.state()).toBe('initiating')
          })
        })

        describe('from initiating', () => {
          let exchanger: Exchanger
          let initiating: Promise<void>

          beforeEach(async () => {
            exchanger = new Exchanger({ initiator, recipient })
            initiating = exchanger.initiate()
          })

          it('should eventually transition from initiating to initiated', async () => {
            const computeInitiateExchangeData = spyOn(initiator, 'computeInitiateExchangeData')
            const initiateExchange = spyOn(recipient, 'initiateExchange')

            await initiating

            expect(computeInitiateExchangeData).toHaveBeenCalled()
            expect(initiateExchange).toHaveBeenCalled()

            expect(exchanger.state()).toBe('initiated')
          })
        })

        describe('from initiated', () => {
          let exchanger: Exchanger

          beforeEach(async () => {
            exchanger = new Exchanger({ initiator, recipient })
            await exchanger.initiate()
          })

          it('should throw if ask for compute is done if state is not initiated', () => {
            const f = () => { return new Exchanger({ initiator, recipient }) }

            [f(), f()]
              .map((x, i) => {
                i === 1 && x.initiate()

                return x
              })
              .forEach(x =>
                expect(() => x.compute()).toThrowError('invalid compute call')
              )
          })

          it('should transition from initiated to computing', () => {
            exchanger.compute()

            expect(exchanger.state()).toBe('computing')
          })
        })

        describe('from computing', () => {
          let exchanger: Exchanger
          let computing: Promise<void>

          beforeEach(async () => {
            exchanger = new Exchanger({ initiator, recipient })
            await exchanger.initiate()
            computing = exchanger.compute()
          })

          it('should eventually transition from computing to ready', async () => {
            const computeLowSPDFromEncodedPayload = spyOn(initiator, 'computeLowSPDFromEncodedPayload')

            await computing

            expect(computeLowSPDFromEncodedPayload).toHaveBeenCalled()
            expect(exchanger.state()).toBe('ready')
          })
        })

        describe('from ready', () => {
          let exchanger: Exchanger

          beforeEach(async () => {
            exchanger = new Exchanger({ initiator, recipient })
            await exchanger.initiate()
            await exchanger.compute()
          })

          it('should throw asking for finalize the exchange if not ready', async () => {
            const f = () => { return new Exchanger({ initiator, recipient }) }

            [f(), f(), f()]
              .map(async (x, i) => {
                i === 1 && await x.initiate()
                i === 2 && await x.initiate() && x.compute()
                return x
              })
              .forEach(x =>
                expect(async () => (await x).finalize()).toThrowError('invalid finalize call')
              )
          })

          it('should transition from ready to finalizing', () => {
            exchanger.finalize()

            expect(exchanger.state()).toBe('finalizing')
          })
        })

        describe('from finalizing', () => {
          let exchanger: Exchanger
          let finalizing: Promise<void>

          beforeEach(async () => {
            exchanger = new Exchanger({ initiator, recipient })
            await exchanger.initiate()
            await exchanger.compute()
            finalizing = exchanger.finalize()
          })

          it('should eventually transition from computing to ready', async () => {
            const finalizeExchange = spyOn(recipient, 'finalizeExchange')

            await finalizing

            expect(finalizeExchange).toHaveBeenCalled()
            expect(exchanger.state()).toBe('finalized')
          })
        })
      })
    })
  })
})
