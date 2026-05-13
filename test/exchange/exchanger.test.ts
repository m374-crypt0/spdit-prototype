import { Exchanger, Initiator, Recipient } from "src/exchange";

import { beforeEach, describe, expect, it, spyOn, xdescribe } from "bun:test";
import { SPD, Transcoder } from "src/transcoding";

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

    describe('exchanger flow', () => {
      let initiator: Initiator
      let recipient: Recipient
      let exchanger: Exchanger

      beforeEach(() => {
        initiator = new Initiator('alice')
        recipient = new Recipient('bob')
        exchanger = new Exchanger({ initiator, recipient })
      })

      describe('from not_started', () => {
        it('should move on to initiated and gets exchange initialization data from initiator', () => {
          const initiateExchange = spyOn(initiator, 'initiateExchange')

          exchanger.initiate()

          expect(exchanger.state()).toBe('initiated')
          expect(initiateExchange).toHaveBeenCalled()
        })

        it('should throw if initiate is called more than once in the lifetime of an exchanger instance', () => {
          exchanger.initiate()

          expect(() => exchanger.initiate()).toThrowError('invalid initiate call')
        })
      })

      describe('from initiated', () => {
        beforeEach(() => exchanger.initiate())

        it('should move on to accepted and gets exchange acceptation data from recipient', () => {
          const acceptExchange = spyOn(recipient, 'acceptExchange')

          exchanger.accept()

          expect(exchanger.state()).toBe('accepted')
          expect(acceptExchange).toHaveBeenCalled()
        })

        it('should throw if accept is called from any other state as initiated', () => {
          const exchanger = new Exchanger({
            initiator: new Initiator('alice'),
            recipient: new Recipient('bob')
          })

          expect(() => exchanger.accept()).toThrowError('invalid accept call')

          exchanger.initiate()
          exchanger.accept()

          expect(() => exchanger.accept()).toThrowError('invalid accept call')
        })
      })

      describe('from accepted', () => {
        beforeEach(() => {
          exchanger.initiate()
          exchanger.accept()
        })

        it('should move on to finalized and get final exchange data from the initiator', () => {
          const initiatorFinalizeExchange = spyOn(initiator, 'finalizeExchange')
          const recipientFinalizeExchange = spyOn(recipient, 'finalizeExchange')

          exchanger.finalize()

          expect(exchanger.state()).toBe('finalized')
          expect(initiatorFinalizeExchange).toHaveBeenCalled()
          expect(recipientFinalizeExchange).toHaveBeenCalled()
        })

        it('should throw if accept is called from any other state as accepted', () => {
          const exchanger = new Exchanger({
            initiator: new Initiator('alice'),
            recipient: new Recipient('bob')
          })

          expect(() => exchanger.finalize()).toThrowError('invalid finalize call')

          exchanger.initiate()
          expect(() => exchanger.finalize()).toThrowError('invalid finalize call')

          exchanger.accept()
          exchanger.finalize()
          expect(() => exchanger.finalize()).toThrowError('invalid finalize call')
        })
      })

      describe.only('from finalized', () => {
        describe('initiator and recipient share the same initial low SPD', () => {
          const lowSPD = new SPD('low')

          beforeEach(() => {
            initiator = new Initiator('alice', new Transcoder({ lowSPD }))
            recipient = new Recipient('bob', new Transcoder({ lowSPD }))
            exchanger = new Exchanger({ initiator, recipient })

            exchanger.initiate()
            exchanger.accept()
            exchanger.finalize()
          })

          it('should allow transcoding between initiator and recipient', () => {
            const originalMessage = Buffer.from('Hello SPDIT from initiator!')
            const encodedMessage = initiator.transcoder().encode(originalMessage)
            const decodedMessage = recipient.transcoder().decode(encodedMessage)

            expect(decodedMessage).toEqual(originalMessage)
          })

          it('should allow transcoding between recipient and initiator', () => {
            const originalMessage = Buffer.from('Hello SPDIT from recipient!')
            const encodedMessage = recipient.transcoder().encode(originalMessage)
            const decodedMessage = initiator.transcoder().decode(encodedMessage)

            expect(decodedMessage).toEqual(originalMessage)
          })
        })

        xdescribe('initiator and recipient do not share the same initial low SPD', () => {
          beforeEach(() => {
            exchanger.initiate()
            exchanger.accept()
            exchanger.finalize()
          })

          it('should allow transcoding between initiator and recipient', () => {
            const originalMessage = Buffer.from('Hello SPDIT from initiator!')
            const encodedMessage = initiator.transcoder().encode(originalMessage)
            const decodedMessage = recipient.transcoder().decode(encodedMessage)

            expect(decodedMessage).toEqual(originalMessage)
          })

          it('should allow transcoding between recipient and initiator', () => {
            const originalMessage = Buffer.from('Hello SPDIT from recipient!')
            const encodedMessage = recipient.transcoder().encode(originalMessage)
            const decodedMessage = initiator.transcoder().decode(encodedMessage)

            expect(decodedMessage).toEqual(originalMessage)
          })
        })
      })
    })
  })
})
