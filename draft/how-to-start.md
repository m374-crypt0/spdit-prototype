# how to start

This is a draft helping me to go forward for **SPDIT** prototype implementation.

## Rules, code of conduct

Though a prototype, make it clean. Ideally, it should act as some sort of model
to implement a real and performant `c++` implementation.

## Main topics to address

There are 2 topics that are of utmost importance so far:

1. seeded hashing
2. *SPD* peer-to-peer exchange

## Seeded hashing

I've built a clear mental model about this one, I do not plan anymore
difficulty so I will work on that later on.

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
