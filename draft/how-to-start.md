# how to start

This is a draft helping me to go forward for **SPDIT** prototype implementation.

## Rules, code of conduct

Though a prototype, make it clean. Ideally, it should act as some sort of model
to implement a real and performant `c++` implementation.

## Main topics to address

There are 2 topics that are of utmost importance so far:

1. seeded hashing
2. *SPD* peer-to-peer exchange

## Seeded hashing experiment

An idea I had reversing the point of view of *transcoding*: if a *message* is a
bunch of data to be hashed, one could see a *message* as an encoded data
against a specific *high SPD*.
Basically, in order to guarantee the same output for a specific *message*
hashing, the used *high SPD* needs to be deterministically generated.

Specific corner cases must be carefully studied such as:

- empty *message* hashing
- *message*'s size being smaller than *hash* size
- *message*'s size not being even

Critical constraints must also be fulfilled such as be not restricted to:

- collision resistance
- pre-image attacks resistance
- cascading effect even for tiny changes in the message
- performant

Below are case studies helping to design a test harness and benchmark to assess
correctness, performance and constraints respect.
Each case study rely on a deterministically generated *high SPD*

### General approach for the hashing algorithm

- Main idea: decode the message using a deterministically generated *high SPD*
- this general approach only consider message size that perfectly fits to get a
  correctly sized hash value. Specific cases will be described later on.
- let `M` be a message to hash.
- let `H` being the hash of `M`
- let `hbs` the *hash bit size* (power of 2, ranging from 64 to 1024)
- let `M`'s size be a multiple of `hbs` (other cases will be treated later on)

Below is the general approach:

1. repeatedly decode `M` up to `M'` until `M'`'s size is `hbs * 2`.
   There is an obvious collision issue here. Hashing `M` gives the same result
   as hashing *decoded* `M`. Due to the stochastic nature of a *high SPD*, it
   **SHOULD NOT** be a problem as there is no relation between `M` and *decoded*
   `M`. However, I **MUST** remove this obvious collision.
1. repeatedly decode `M'` to create `S` using the same algorithm until `S`'s
   size is 64 bits
1. shuffle `M'` deterministically at byte level using `S` as a *seed* creating
   `M''`
1. decode `M''` to get `H`

- `M` to `M'` leverages uses the *high SPD* content to somehow compress `M` to
  `M'`. This compression is lossy thus, no information could be extracted from
  `M'` to get information about `M`
- Obtaining the seed `S` from `M'` allow the final step of hashing to also
  depend on `M` and not only on the *high SPD* content and the *hasher*'s *seed*
- Shuffling `M'` at byte level breaks the address scheme of decoding and has
  the effect to ensure a good diffusion of resulting hash value even if two
  messages differ by a few

### Brief talk on odd sized messages

In this *SPDIT prototype*, *transcoding* relies on a dimensional factor of 2.
More simply, *encoding* takes one byte to give 2 bytes and *decoding* takes the
other way around
Thus, odd-sized messages must be treated accordingly because without
modification they cannot be fully transcoded.
One way to do so is by simply appending one byte at the end of the message but
it could create a collision with another message that would be the same.
Same thing if I choose to remove one byte.
*A possible solution* could be to keep the oddness as a state that alter the
hashing algorithm in a way collision do not occur with even-sized message
having one byte less and transcode the odd-size message ignoring the last byte.
As a result, no predictable collision occurs regarding the original and the
truncated message.

### Shi7: the class responsible to expose the hash function

- with a *seed* at construction
  - The *seed* is a key part to identify a *shi7* instance alongside its *hash
    bit size*. Must be immutable after initialization.
  - A default instantiation is possible to. In this case, the *hash bit size*
    is `256` and the *seed* is selected at random.
  - However, to make the pseudo random number generation not too predictable,
    keep track of a specific *splitmix64* instance initially instantiated with the
    *seed* then, use the next *seed* it could provide each time it is needed
    **within a hash call**, I mean, do not use the same *seed* to initialize a
    *splitmix64* instance several time.
- with a *hash bit size* in `[64, 128, 256, 512, 1024]`
- prepare for *high SPD* query on-demand, generated using a *seed* for
  performance reasons

### Hash case study: empty *message* hashing

- constant value, computed on demand then cached for performance purpose
- based on underlying *high SPD*
  - must be different of the explicit hash value of the underlying *high SPD*
    to ensure collision resistance for this case
  - shuffling may be a good way to diffuse
- must not influence the behavior of further hashing

### Hash case study: small messages in regard of *hash bit size* \*2

- By small, I mean under the *hash bit size* / 8 * 2 bytes
- ranges from 1 byte to *hash bit size* / 8 * 2 - 1 bytes
- first step is to build a seed by repeatedly encoding or decoding the original
  message until it reaches a size of 64 bits at most to get a *seed* value
  - if byte count needed to reach the 64 bits size *seed* is odd, encode up to
    56 bits and append a random byte to finish the *seed* build
- next step, by keeping the *PRNG* state used for *seed* computation, repeatedly
  encode the message up to *hash bit size* / 8 * 2 at most to get the
  *pre-hash*.
  - if byte count needed to reach the *hash bits size* / 8 * 2 is odd, encode
    up to one byte less and append a random byte to finish the *pre-hash* build
- next, shuffle the *pre-hash* with a *PRNG* seeded with *seed*
- then, decode the *pre-hash* to get the hash

### Hash case study: big messages in regard of *hash bit size* \* 2

- By big, I mean above the *hash bit size* \* 2
- ranging from *hash bit size* * 8 \* 2 to arbitrarily large
- therefore, could be even or odd sized
- decodes the message until it reaches a size lesser than or equal to *hash bit
  size* * 2
- if size equals *hash bit size* * 2
  - apply [general approach](#general-approach-for-the-hashing-algorithm)
- otherwise
  - pad the result until it reaches *hash bit size* * 2
  - then apply the [general approach](#general-approach-for-the-hashing-algorithm)

## *SPD* peer-to-peer exchange (postponed after hashing)

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
