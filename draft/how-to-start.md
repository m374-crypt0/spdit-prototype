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

### First tasks: pseudo random number generation

1. seed generator (`splitmix64`)
2. Uniform Bit Random Generator (`xoroshiro128+`)
3. Uniform unsigned integer distribution (`unsigned integer 64 bits size`)
