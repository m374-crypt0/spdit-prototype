# glossary

- **cipher** see *encoding*
- **cryptography**, in its modern definition, is designed around cryptographic
  algorithms to enable secured communications in the presence of adversarial
  behavior. Regarding this definition *SPDIT* does not play in this field, it
  plays in the *information theoretically secured* scheme.
- **decipher** see *decoding*
- **decoding** is a *transcoding* operation. It consists simply in transforming
  an *address* from a *SPD* to a *value*. Put it simply, it is a *decipher*ing
  operation.
- **dimensional** is a proto-concept of *SPDIT*. It is of course prevalent, the
  transcoding scheme is clearly bi-dimensional here (at least, we can build a
  mental model relying on it). In this *SPDIT* prototype, *SPDIT* only use a
  bi-dimensional approach for all *transcoding* endeavors. It should be
  sufficient until the end of time actually due to the *information theoretically
  secured* characteristics of *SPDIT*. However, one should find increasing the
  dimensionality a not impossible task to further enhance the security of *SPDIT*
  beyond all reason. Keep in mind, however, that increasing dimensionality
  would cause larger *SPD* size and encoded data.
- **encoding** is a *transcoding* operation. It consists in transforming a
  *value* to an *address* *stochastic*ally chosen in a *SPD*. Put it simply, it
  is a *cipher*ing operation.
- **entropy**, in information theory, is a measure of the amount of information
  that is needed to describe the state of a variable considering the distribution
  of probability across all potential state. In other words, the less you can
  **guess** the next state of a variable regarding all its potential values, the
  more entropy you have. This is a core concept for *SPDIT* for both *SPD*
  creation and *encoding*
- **Grover's algorithm** is a *quantum algorithm* that, in *cryptography*,
  essentially solves the task of function inversion. In other words, it has the
  potential to facilitate attacks such as pre-image attacks or collision attacks.
  It directly relates to *hashing* function such as SHA implementations.
- **information theoretically secured** aka. unconditional security, is a
  system that is secured even in presence of adversarial behavior having
  unlimited computing resource and time. *SPDIT* plays in this category.
- **hashing** function are able to map data of arbitrary size to a fixed-size
  value. A good *hashing* function must have mandatory properties such as
  minimizing duplication of output values, producing output values uniformly
  regarding a probabilistic distribution. *Hash* function might be susceptible
  to be broken by an efficient implementation of the *Grover's algorithm*.
  *SPDIT* uses its own *hashing* function that is *information theoretically
  secured* named *shi7*
- **High SPD** pronounced *High Speed* is one type of *SPD*. It is a
  *transcoding* table that contains a high amount of *entropy* and is designed to
  *encode* any kind of data disregarding its size. A *high SPD* is 64kb in size
  and is able to encode *stochastic*ally any 8 bits byte value.
- **Low SPD** pronounced *Low Speed* is one type of *SPD*. It is a
  *transcoding* table that contains a low but sufficient amount of *entropy* to
  encode data that **has** a high amount of *entropy*. This type of *SPD* is
  especially designed to transcode *High SPD*. *Transcoding* *High SPD* allow
  them to be exchanged and establish communication between two parties at least.
- **Quantum algorithms** aiming to break *cryptography* primitives discussed
  here are *Shor's algorithm* and *Grover's Algorithm*
- **shi7** aka *seeded stochastic hashing by information transcoding* is the
  *SPDIT* implementation of a *hashing* function. It is an open research field
  and need to be implemented and evaluated regarding existing *hashing* function
  properties and *quantum algorithm* resistance such as the *Grover's
  algorithm*
- **Shor's Algorithm** is a *quantum algorithm* that is potentially able to
  resolve the factoring problem, the discrete logarithm problem and the period
  finding problem. Given a **sufficiently stable and powerful** quantum
  computer, it may break cryptography primitives such as the RSA scheme, the
  finite-field Diffie-Hellman key exchange and the elliptic-curve Diffie-Hellman
  key exchange. Those primitives are **widely** used in everyday information
  transfers.
- **SPD** pronounced *speed* is a **S**tochastic, **P**rivate, **D**imensional
  *transcoding* table. This is a core component of **SPDIT** and allow any data
  to be *transcoded*. It exists two types of *SPD*: *high SPD* and *low SPD*
- **SPDIT** pronounced *speed-it* is the name of this product. This is the
  acronym for **S**tochastic **P**rivate **D**imensional **I**nformation
  **T**ranscoding, a new way to securely and privately exchange information
  without relying on *cryptography*.
  **SPDIT** is inspired by work made by *Julian Cassin* aka. *CyborgUnicorn*
  named *ZOSCII*. It is designed to be immune to *quantum algorithms* aiming to
  break *cryptography* primitives. It is not a set of *cryptography* primitive
  but can be described as a *information theoretically secured* scheme.
- **Stochastic** can be understood as *random*. I'm talking more about
  *pseudo-random* here because *SPDIT* does not rely nor does not need true
  source of randomness. However, as *stochastic*ity is of utmost importance for
  *SPDIT*, thus, I included a minimal functioning set of pseudo random number
  generation in its code.
- **Transcoding** is a word englobing both *encoding* and *decoding*. This is a
  key concept in *SPDIT* for information interchange.
