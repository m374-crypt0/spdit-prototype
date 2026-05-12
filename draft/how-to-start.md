# how to start

This is a draft helping me to go forward for **SPDIT** prototype implementation.

## Rules, code of conduct

Though a prototype, make it clean. Ideally, it should act as some sort of model
to implement a real and performant `c++` implementation.

## Main topics to address

There are 2 topics that are of utmost importance so far:

1. seeded hashing
2. *SPD* peer-to-peer exchange

## *SPD* peer-to-peer exchange

This one make me loose some hair... Actively working on, I'll start by this one.
I've some ideas I need to test, demonstrate, and make understandable.

### First task: pseudo random number generation

1. seed generator (`splitmix64`)
2. Uniform Bit Random Generator (`xoroshiro128+`)
3. Uniform unsigned integer distribution (`unsigned integer 64 bits size`)

- [x] DONE

### Second task: design SPD creation

- get rid of pure functional style because of too much performance penalty
  (especially for encoding and maybe *SPD* creation)
- double shuffle effort: both horizontal and vertical to ensure *SPD* is not
  recognizable regarding any random binary content
  - Currently, *shuffle* utility only works on linear buffer or array
    (understand horizontally)
  - It might be OK if once the *SPD* is generated, shuffle horizontally, I
    rotate it.
    - No, because, if rotated in the other way around, an horizontally shuffled
      only *SPD* is recognizable
    - The solution: rotate it, then re-shuffle horizontally.
      - This way I do not need to modify the *shuffle* utility
- I noticed *decoding* is really fast (only lookup) but encoding is sub-optimal
  (functional style array reconstruction + shuffling)
  - a *SPD* must be switched both for *encoding* and *decoding*
  - The purpose is to get as much performance in encoding as in decoding, that
    is: do only lookups.
  - compromises:
    - more storage space for *SPD* up to **3X**.
      - decoding *SPD* is (256 to 64k bytes)
      - encoding *SPD* is (512 to 128k bytes)
        - Could be reduced to (256 to 64k bytes) by sacrificing vertical
          shuffling. It is an unacceptable security trade off.
      - encoding *SPD* is an implementation detail. It means it will never be
        stored or transmitted as is. Only the decoding *SPD* is to be stored or
        transmitted.
- [x] DONE

### Third task: transcoding

- [x] Create a *Transcoder* class having responsibility to:
  - [x] make *encoding* and *decoding* performant operations (lookup for both)
  - handle a state composed of *high SPD* and *low SPD*, private
    - [x] *low SPD* is managed, both in its encoding and decoding form
    - [x] *high SPD* is yet to be done for arbitrary data *transcoding*
  - [x] ~default constructible generating default *high SPD* and *low SPD*~
    - *SPD* are generated on-demand.
    - so far, only a *low SPD* is generated for *decoding* and *encoding* a
      *high SPD* and an *encoding low SPD* for encoding purpose
  - [x] constructible with user-provided *high SPD* and *low SPD*
    - Observable when several *encoding*s are done on the same data
  - [x] encode and decode *high SPD* (useful for future *high SPD* exchange
    feature, need *low SPD*)
  - [x] deterministic *encoding*, needed for *high SPD* exchange feature
    (intuition) and for *seeded hashing*
  - [x] encode and decode any content (need a *high SPD*)
- [x] DONE

### Fourth task: design the exchange protocol

- Leverage *SPD* and *Transcoder* classes capabilities to achieve *exchange* of
  *high SPD*
- model parties who want to exchange
  - *initiator* will be the one wanting to exchange a *high SPD* with another
    peer
  - *recipient*, the other peer the *initiator* deals with
- Start with an easy case: each party share the same *low SPD*
- Then, generalize for any *low SPD*
- constraints:
  - do as less as round-trip as possible between the *initiator* and the
    *recipient*
    - > [!NOTE]
      > The [Flow](#flow-of-the-high-spd-exchange) described below shows the
      > following:
      > from *initiator* to *recipient*: encoded *entropy* source and *seed*
      > from *recipient* to *initiator*: encoded *payload*
      > from *initiator* to *recipient*: encoded *seed* and encoded *high SPD*
    - One round-trip plus one trip
    - 128 kb-sized encoded *entropy* and *payload* transfer for each trip, plus
      64-bits for each *seed*, quite a lot, need to reduce
      - > [!NOTE]
        > invent a new type of *SPD* called *null SPD*
        > one order of magnitude smaller than *low SPD*
  - transfer the least amount of information possible for the exchange to make
    it practical in constrained environments

#### Flow of the *high SPD* exchange

##### High level exchanger state

1. Initiate the exchange: The *initiator* initiates an exchange with the
   *recipient*
2. Accept the exchange: The *recipient* accept the exchange from the
   *initiator*
3. Finalize the exchange: The *initiator* finalizes the exchange with the
   *recipient*

##### Initiate the exchange

The *initiator* executes the following steps:

1. setup a secret *low SPD*
2. builds an *entropy* source and a compute a *seed*
3. encodes the *entropy* source deterministically with the setup *low SPD*
   using the *seed*
4. sends both the encoded *entropy* source and the *seed* to the *recipient*

Pre-conditions:

- None

Post-conditions:

- An encoded *entropy* source and a *seed* are sent to the *recipient*
- created *low SPD* is kept secret

##### Accept the exchange

The *recipient* executes the following steps:

1. The *recipient* setup a secret *low SPD*
2. The *recipient* decodes the received encoded *entropy* source with the setup
   *low SPD* creating a *payload*
3. The *recipient* encodes the *payload* deterministically with the setup *low
   SPD* using the received *seed*
4. The *recipient* sends the encoded *payload* to the *initiator*

Pre-conditions:

- A *seed* is received
- An encoded *entropy* source is received

Post-conditions:

- The encoded *payload* sent to the *initiator*
- Both the created *low SPD* and the *payload* are kept secret

##### Finalize the exchange

The *initiator* executes the following steps:

1. The *initiator* compares byte to byte the encoded *entropy* source he
   created and the encoded *payload* he received to build a *common alphabet*
2. The *initiator* computes a new *seed*
3. The *initiator* creates a one-time use *low SPD* deterministically using the
   new *seed*
4. The *initiator* encodes the new *seed* with the *common alphabet*
5. The *initiator* encodes the *high SPD* with the one-time use *low SPD*
6. The *initiator* sends both the encoded *high SPD* and the encoded new *seed*
   to the *recipient*
7. discard all the data involved in the exchange but the last generated *high
   SPD*

Pre-conditions:

- An encoded *payload* is received
- The encoded *entropy* source is available
- The computed *common alphabet* is sufficiently large to scramble the *seed*
  value upon encoding

Post-conditions:

- An encoded *seed* is created with the help of the *common alphabet*
- A *low SPD* is deterministically created using the *seed*
- A *high SPD* is created
- An encoded *high SPD* is created from the *high SPD* using the created
  one-time use *low SPD*
- The encoded *high SPD* and the encoded *seed* are sent to the *recipient*
- The *seed*, the *high SPD* and the *low SPD* are kept secret

##### Post-finalization step

The *recipient* executes the following steps:

1. receives the encoded *high SPD* and an encoded *seed*
2. decodes the encoded *seed* with its own *low SPD* that is a superset of the
   *common alphabet*
3. creates the very same one-time use *low SPD* the *initiator* created using
   the decoded *seed*
4. decodes the encoded *high SPD* with the one-time use *low SPD*
5. discard all data involved in the *exchange* but the last decoded *high SPD*

Pre-conditions:

- The *recipient*'s secret *low SPD* is available
- The encoded *seed* and the encoded *high SPD* are received

Post-conditions:

- The *initiator* and the *recipient* share the same *high SPD*
- The aforementioned *high SPD* is kept secret

##### Entropy source details

- generated by the *initiator*
- encoded using a *low SPD*
- must be order of magnitude larger than the *low SPD* ,that's why a *high SPD*
  is a valid candidate
- The encoded *high SPD* is very large (128kb) is highly likely not to be
  suitable in real *exchange* protocol implementation
- A potential replacement that is still *ITS* would involve the creation of a
  new type of *SPD* that is one order of magnitude smaller than the *low SPD*
  - Could be named *null SPD* and specifically designed to be one-time used and
    space efficient for secret *seed* transfers

##### Note on deterministic encoding

- Can have catastrophic consequences on *SPDIT* security if:
  - The *seed* to perform it is revealed
  - used more than one time with the same *SPD*
- Safe otherwise

##### Note on encoded data transfers

- Following data are transferred on a network where adversarial behavior is
  considered the norm:
  - encoded *entropy* source (exchange initiate)
  - clear *seed* value (exchange initiate)
  - encoded *payload* (exchange accepted)
  - encoded *seed* (exchange finalized)
  - encoded *high SPD*  (exchange finalized)
- Without anything else (information kept secret by both the *initiator* and
  the *recipient* or discarded by them), it is impossible for an attacker to
  deterministically reconstruct the final *high SPD* both the *initiator* and the
  *recipient* will share once the *exchange* is done.

##### Note on the common alphabet

- In essence, it is a probabilistic approach
- It is a set of *addresses* in a *low SPD*
- In fact, a piece of a *low SPD*
- encoded *entropy* source and *encoded* payload use the same *alphabet* as the
  encoding system (*low SPD*)
- Those encoded data are order of magnitude bigger than the *low SPD* they
  share the alphabet with
- Then, there are substantial probability values *AND* position of those values
  are shared both in encoded *entropy* source and encoded *payload* thanks to
  deterministic encoding (this is *THE TRICK*)
- A sufficiently large *common alphabet*, though relatively small compared to a
  full *low SPD* is sufficiently secured to encode (one time or more in a row) a
  small value like a *seed* if used **only once**

  ##### Note on deterministic SPD generation

- Discouraged unless for:
  - publicly accessible *SPD* for future seeded universal ITS hashing I'll be
    working on later
- Such a *SPD* is as strong as the underlying *seed* used to generate it
- Such a *SPD* remains secure if used only once (as it is the case in this
  *exchange* protocol)

## Seeded / Universal / Information theoritically secured hashing

I've built a clear mental model about this one, I do not plan anymore
difficulty so I will work on that later on.
