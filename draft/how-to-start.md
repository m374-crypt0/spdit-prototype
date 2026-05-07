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

- [ ] Create a *Transcoder* class having responsibility to:
  - [x] make *encoding* and *decoding* performant operations (lookup for both)
  - handle a state composed of *high SPD* and *low SPD*, private
    - [x] *low SPD* is managed, both in its encoding and decoding form
    - [ ] *high SPD* is yet to be done for arbitrary data *transcoding*
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
  - [ ] encode and decode any content (need a *high SPD*)

### Fourth task: design the exchange protocol

- Leverage *SPD* and *Transcoder* classes capabilities to achieve exchange
- model parties who want to exchange
  - I think *Transcoder* is a good start, they each manage a *low SPD*
- Start with an easy case: each party share the same *low SPD*
- Then, generalize for any *low SPD*

#### Flow of the *high SPD* exchange

- Model a new concept for the *exchange*, a new class responsible of it
  - handles 2 parties, an *initiator* and a *recipient*
    - Could be mocked as a map with some sort of *identifier* key
  - The *initiator* ask for the exchange with the *recipient* and creates:
    - an *entropy* source in the form of a *high SPD*
    - a *low SPD* to encode this *entropy* source
    - a *seed* used for deterministic *entropy* source *encoding*
  - Then, the *initiator* deterministically encode the *entropy* source using
    the generated *high SPD* (the *entropy* source) and the *seed*
    - > [!NOTE]
      > deterministic encoding has catastrophic consequences on the security
      > of *SPDIT* if used more than once with the same *SPD*, either *low* or
      > *high*. In this case, we're safe as it is used only once here.
  - Then, the *initiator* sends both the *seed* and the encoded *entropy* source
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
      > However, it also is an edge for the *initiator* for deducing the
      > *recipient*'s *low SPD* by brute-forcing it thanks to information he's
      > the only one to have (*entropy* source and deduced parts of the
      > *recipient*'s *low SPD*)
  - Then, the *recipient* decodes the received encoded *entropy* and get some
    *payload*
    - > [!NOTE]
      > By somehow brute-forcing it
  - Then, the *recipient* deterministically encodes this *payload* using its
    *low SPD* and the received *seed*
    - > [!NOTE]
      > If the *recipient*'s *low SPD* is different from the *initiator*'s one
      > (highly likely), the is no security loss consequences regarding the
      > deterministic encoding
  - Then, the *recipient* sends this encoded *payload* to the *initiator*
  - With all information the initiator has:
    - *entropy* source
    - *initiator*'s *low SPD*
    - encoded *payload*
    - *seed*
    The *initiator* can rebuild the *recipient*'s *low SPD*
  - Then, the *initiator* generates a new *high SPD* (no correlation with the
    *entropy* source)
  - Then, the *initiator* encodes this new *high SPD* (non-deterministically
    this time) using the deduced *low SPD* of the *recipient*
  - Then, the *initiator* sends this encoded *high SPD* to the *recipient*
  - The recipient eventually receives the encoded *high SPD*
  - The *recipient* decodes it, and obtains the very same *high SPD* (same *low
    SPD* used for both encoding and decoding)
  - Finally, *initiator* and *recipient* can use *SPDIT*

## Seeded hashing

I've built a clear mental model about this one, I do not plan anymore
difficulty so I will work on that later on.
