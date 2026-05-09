import { Exchanger, Peer, SPD } from "src/SPD";
import { Transcoder } from "src/transcoding";

import { beforeEach, describe, expect, it, spyOn, xit } from "bun:test";

describe('SPD test suite', () => {
  describe('exchange test suite', () => {
    describe('exchanger instantiation', () => {
      it('should throw at initializing an exchange between an intiator and himself', () => {
        const initiator = new Peer('alice')

        expect(() => new Exchanger({ initiator, recipient: initiator }))
          .toThrowError('invalid exchange configuration, initiator must be different from recipient')
      })

      it('should report the state of an exchange as not_started when instantiated', () => {
        const initiator = new Peer('alice')
        const recipient = new Peer('bob')
        expect(new Exchanger({ initiator, recipient }).state()).toBe('not_started')
      })
    })

    describe('exchange flow', () => {
      let exchanger: Exchanger
      let initiator: Peer
      let recipient: Peer

      describe('initiator and recipient share the same low SPD', () => {
        const lowSPD = new SPD('low')

        describe('from not_started', () => {
          beforeEach(() =>
            exchanger = new Exchanger({
              initiator: new Peer('initiator', new Transcoder({ lowSPD })),
              recipient: new Peer('recipient', new Transcoder({ lowSPD }))
            }))

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
          let initiating: Promise<void>

          beforeEach(() => {
            initiator = new Peer('initiator', new Transcoder({ lowSPD }))
            recipient = new Peer('recipient', new Transcoder({ lowSPD }))
            exchanger = new Exchanger({ initiator, recipient })
            initiating = exchanger.initiate()
          })

          it('should eventually transition from initiating to initiated', async () => {
            const generateInitiateExchangeData = spyOn(initiator, 'generateInitiateExchangeData')
            const generateEncodedPayload = spyOn(recipient, 'generateEncodedPayload')

            await initiating

            expect(generateInitiateExchangeData).toHaveBeenCalled()
            expect(generateEncodedPayload).toHaveBeenCalled()

            expect(exchanger.state()).toBe('initiated')
          })
        })

        describe('from initiated', () => {
          beforeEach(async () => {
            initiator = new Peer('initiator', new Transcoder({ lowSPD }))
            recipient = new Peer('recipient', new Transcoder({ lowSPD }))
            exchanger = new Exchanger({ initiator, recipient })
            await exchanger.initiate()
          })

          it('should throw if ask for compute is done if state is not initiated', () => {
            const exchanger = new Exchanger({
              initiator: new Peer('initiator'),
              recipient: new Peer('recipient')
            })

            exchanger.initiate()

            expect(() => exchanger.compute()).toThrowError('invalid compute call')
          })

          it('should transition from initiated to computing', () => {
            exchanger.compute()

            expect(exchanger.state()).toBe('computing')
          })
        })

        describe('from computing', () => {
          let computing: Promise<void>

          beforeEach(async () => {
            initiator = new Peer('initiator', new Transcoder({ lowSPD }))
            recipient = new Peer('recipient', new Transcoder({ lowSPD }))
            exchanger = new Exchanger({ initiator, recipient })

            await exchanger.initiate()
            computing = exchanger.compute()
          })

          it('should eventually transition from computing to ready', async () => {
            const reconstructLowSPD = spyOn(initiator, 'reconstructLowSPD')

            await computing

            expect(reconstructLowSPD).toHaveBeenCalled()
            expect(exchanger.state()).toBe('ready')
          })
        })

        describe('from ready', () => {
          beforeEach(async () => {
            initiator = new Peer('initiator', new Transcoder({ lowSPD }))
            recipient = new Peer('recipient', new Transcoder({ lowSPD }))
            exchanger = new Exchanger({ initiator, recipient })

            await exchanger.initiate()
            await exchanger.compute()
          })

          it('should throw asking for finalize the exchange if not ready', async () => {
            const exchanger = new Exchanger({
              initiator: new Peer('initiator'),
              recipient: new Peer('recipient')
            })

            await exchanger.initiate()
            exchanger.compute()

            expect(() => exchanger.finalize()).toThrowError('invalid finalize call')
          })

          it('should transition from ready to finalizing', () => {
            exchanger.finalize()

            expect(exchanger.state()).toBe('finalizing')
          })
        })

        describe('from finalizing', () => {
          let finalizing: Promise<void>

          beforeEach(async () => {
            initiator = new Peer('initiator', new Transcoder({ lowSPD }))
            recipient = new Peer('recipient', new Transcoder({ lowSPD }))
            exchanger = new Exchanger({ initiator, recipient })

            await exchanger.initiate()
            await exchanger.compute()
            finalizing = exchanger.finalize()
          })

          it('should eventually transition from finalizing to finalized', async () => {
            const generateFinalizeExchangeData = spyOn(initiator, 'generateFinalizeExchangeData')
            const acceptEncodedHighSPD = spyOn(recipient, 'acceptEncodedHighSPD')

            await finalizing

            expect(generateFinalizeExchangeData).toHaveBeenCalled()
            expect(acceptEncodedHighSPD).toHaveBeenCalled()
            expect(exchanger.state()).toBe('finalized')
          })
        })

        describe('from finalized', () => {
          beforeEach(async () => {
            initiator = new Peer('initiator', new Transcoder({ lowSPD }))
            recipient = new Peer('recipient', new Transcoder({ lowSPD }))
            exchanger = new Exchanger({ initiator, recipient })

            await exchanger.initiate()
            await exchanger.compute()
            await exchanger.finalize()
          })

          xit('should transcode a same message from initiator to recipient', async () => {
            const message = Math.random().toString()

            const encoded = initiator.transcoder().encode(message)
            const decoded = recipient.transcoder().decode(encoded)

            expect(decoded).toBe(message)
          })
        })
      })
    })
  })
})
