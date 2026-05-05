# glossary

- **cipher** see *encoding*
- **decipher** see *decoding*
- **decoding** is a *transcoding* operation. It consists simply in transforming
  an *address* from a *SPD* to a *value*. Put it simply, it is a *decipher*ing
  operation.
- **encoding** is a *transcoding* operation. It consists in transforming a
  *value* to an *address* *stochastic*ally chosen in a *SPD*. Put it simply, it
  is a *cipher*ing operation.
- **entropy**, in information theory, is a measure of the amount of information
  that is needed to describe the state of a variable considering the distribution
  of probability across all potential state. In other words, the less you can
  **guess** the next state of a variable regarding all its potential values, the
  more entropy you have. This is a core concept for *SPDIT* for both *SPD*
  creation and *encoding*
- **High SPD** pronounced *High Speed* is one type of *SPD*. It is a
  *transcoding* table that contains a high amount of *entropy* and is designed to
  *encode* any kind of data disregarding its size. A *high SPD* is 64kb in size
  and is able to encode *stochastic*ally any 8 bits byte value.
- **Low SPD** pronounced *Low Speed* is one type of *SPD*. It is a
  *transcoding* table that contains a low but sufficient amount of *entropy* to
  encode data that **has** a high amount of *entropy*. This type of *SPD* is
  especially designed to transcode *High SPD*. *Transcoding* *High SPD* allow
  them to be exchanged and establish communication between two parties at least.
- **SPD** pronounced *speed* is a **S**tochastic, **P**rivate, **D**imensional
  *transcoding* table. This is a core component of **SPDIT** and allow any data
  to be *transcoded*. It exists two types of *SPD*: *high SPD* and *low SPD*
- **SPDIT** pronounced *speed-it* is the name of this product. This is the
  acronym for **S**tochastic **P**rivate **D**imensional **I**nformation
  **T**ranscoding, a new way to securely and privately exchange information
  without relying on *cryptography*.
  **SPDIT** is inspired by work made by *Julian Cassin* aka. *CyborgUnicorn*
  named *ZOSCII*
- **Stochastic** can be understood as *random*. I'm talking more about
  *pseudo-random* here because *SPDIT* does not rely nor does not need true
  source of randomness. However, as *stochastic*ity is of utmost importance for
  *SPDIT*, thus, I included a minimal functioning set of pseudo random number
  generation in its code.
- **Transcoding** is a word englobing both *encoding* and *decoding*. This is a
  key concept in *SPDIT* for information interchange.
