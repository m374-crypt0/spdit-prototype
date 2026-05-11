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

- Model a new concept for the *exchange*, a new class responsible of it
  - Involves 2 peers, an *initiator* and a *recipient*
  - represents a *flow* with steps depending on each other
  - The *initiator* ask for the exchange with the *recipient* and creates:
    - an *entropy* source in the form of a *high SPD*
      - > [!NOTE]
        > A *high SPD* is the most certain way to get sufficient entropy and
        > data for further steps of the flow. It *may* be possible to use less
        > data for the entropy but measures and tests are necessary to asses
        > this fact.
    - a *low SPD* to encode this *entropy* source
      - > [!NOTE]
        > So far, a *low SPD* can only encode a *high SPD*. This fact is
        > important to keep in mind in the case the entropy source becomes
        > something else than a *high SPD*
    - a *seed* used to deterministic encode the *entropy* source
  - Then, the *initiator* deterministically encode the *entropy* source using
    the generated *high SPD* (the *entropy* source) and the *seed*
    - > [!NOTE]
      > deterministic encoding has catastrophic consequences on the security
      > of *SPDIT* if used more than once with the same *SPD*, either *low* or
      > *high*. In this case, we're safe as it is used only once here.
  - Then, the *initiator* sends both the *seed* and the encoded *entropy* source
    - > [!NOTE]
      > An entropy source smaller than the *high SPD* could be desirable here.
      > 128kb is kind of hefty to transfer
    - > [!NOTE]
      > At this point, considering the network has an adversarial behavior, the
      > only information an *attacker* gets is both the *seed* and the encoded
      > *high SPD*. Nothing could be retrieved to reconstruct the *initiator*'s
      > *low SPD*.
  - Eventually, the *recipient* receives both the *seed* and the encoded
    *entropy* source
  - Then, the *recipient* generates its own *low SPD* totally unrelated to the
    *initiator*'s one
    - > [!NOTE]
      > A very specific test will be designed using the very same *low SPD* for
      > both the *initiator* and the *recipient*. It will emphasize the security
      > loss consequences of using deterministic encoding with the same *SPD*.
      > To put it shortly, thanks to deterministic encoding, if encoded
      > *entropy* source issued by the *initiator* is the same as the encoded
      > *payload* issued by the *recipient*, one can deduce they share the same
      > *low SPD*
  - Then, the *recipient* decodes the received encoded *entropy* and get some
    *payload*
  - Then, the *recipient* deterministically encodes this *payload* using its
    *low SPD* and the received *seed*
    - > [!NOTE]
      > If the *recipient*'s *low SPD* is different from the *initiator*'s one
      > (highly likely), the is no security loss consequences regarding the
      > deterministic encoding that is used only once.
  - Then, the *recipient* sends this encoded *payload* to the *initiator*
  - Eventually, the *initiator* receives this encoded *payload*
  - Below are all information the *initiator* has:
    - encoded *entropy* source
    - *initiator*'s *low SPD*
    - encoded *payload*
    - the knowledge the *entropy* source and the *recipient*'s *payload* have been
      deterministically encoded using the *initiator*'s provided *seed*
  - Then, the *initiator* build a *common alphabet*, that is, addresses values
    and positions that are shared by bot the *initiator* and the *recipient*.
    - As the *entropy* source is big related to the *low SPD* there is a
      substantial chance there are common addresses in the same position in both
      the encoded *entropy* source issued by the *initiator* and the encoded
      *payload* issued by the *recipient*
      - This fundamental property is key to build a *common alphabet* between the
        *initiator* and the *recipient*
        - > [!NOTE]
          > I have the intuition I could formalize the thing using the
          > *Pigeon-Hole Principle*, I could use some help to build it. I've also
          > the intuition it could help me to create an *entropy* source having
          > an optimal size regarding the size of the *common alphabet* I need.
          > Talking about this *common alphabet*, it needs to be sufficiently
          > large to encode a 64-bits sized integer
  - Then, the *initiator* compute a 64-bits sized *seed* (not related to the
    *seed* mentioned earlier)
  - Then, the *initiator* encodes this *seed* using the *common alphabet*
    (degraded *low SPD* somehow)
    - > [!NOTE]
      > Determistic encoding introduces security holes if used more than once
      > with the same known *seed*, for sure. But using this kind of *degraded low
      > SPD* to encode a data that small as a 64-bits sized *seed* is a concern
      > too. That being said, it is used only once and, even in a network
      > presenting adversarial behavior, an attacker could not establish any
      > correlation between the encoded seed and the actual seed value. The best
      > it could do is randomly guessing. I have the intuition it is *information
      > theoritically secured*. I could use some help to confirm. As a
      > mitigation measure, it may be possible to encode the *seed* several times
      > in a row to further enhance the entropy of the transferred payload
  - Then, the *initiator* generates a new *low SPD* deterministically using
    this new *seed*
    - > [!NOTE]
      > On deterministic *SPD* generation:
      > Unless for public usage such as the future seeded hashing algorithm, it
      > is discouraged to use such a *SPD* more than once for secrets encoding.
      > Indeed, a deterministically generated *SPD* is as strong as the
      > underlying *seed* used to generate it (here 64-bits sized integer, way
      > less than 128-bytes sized or 64kb-sized *SPD*). Using such a *SPD* only
      > once though is OK.
  - Then, the *initiator* sends this encoded seed to the *recipient*
  - Eventually, the *recipient* receives the encoded *seed*
    - Thanks to the *common alphabet* (degraded *low SPD*), both the
      *initiator* and the *recipient* and only them can decode the encoded *seed*
      to the same value.
  - Then, the *recipient* can generate the same *low SPD* as the *initiator* as
    they share the same *seed*
  - Then, the *initiator* generates a new *high SPD* (no correlation with the
    *entropy* source)
  - Then, the *initiator* encodes this new *high SPD* (non-deterministically
    this time) using the deterministically generated *low SPD*
  - Then, the *initiator* sends this encoded *high SPD* to the *recipient*
  - The recipient eventually receives the encoded *high SPD*
  - The *recipient* decodes it using the deterministically generated *low SPD*,
    and obtains the very same *high SPD* (same *low SPD* used for both encoding
    and decoding)
  - Finally, *initiator* and *recipient* can use *SPDIT*

## Seeded / Universal / Information theoritically secured hashing

I've built a clear mental model about this one, I do not plan anymore
difficulty so I will work on that later on.
