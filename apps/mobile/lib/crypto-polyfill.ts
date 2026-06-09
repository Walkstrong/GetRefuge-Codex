// Wires expo-crypto's getRandomBytes into tweetnacl's PRNG slot.
// Required because tweetnacl ships no built-in randomness source for React Native.
// Must be imported BEFORE any tweetnacl call (e.g. nacl.box, nacl.randomBytes).
import * as Crypto from 'expo-crypto'
import nacl from 'tweetnacl'

nacl.setPRNG((x: Uint8Array, n: number) => {
  const random = Crypto.getRandomBytes(n)
  for (let i = 0; i < n; i++) {
    x[i] = random[i]
  }
})
