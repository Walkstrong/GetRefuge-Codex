import { encryptRecord, decryptRecord, generateOrgKeyPair, deriveKeyFromPassphrase } from '../src/index'

describe('crypto module', () => {
  const plaintext = { message: 'hello', count: 42, tags: ['a', 'b'] }

  test('encrypt then decrypt returns original object', () => {
    const keyPair = generateOrgKeyPair()
    const envelope = encryptRecord(plaintext, keyPair.publicKey)
    const decrypted = decryptRecord(envelope, keyPair.secretKey)
    expect(decrypted).toEqual(plaintext)
  })

  test('different nonces per call', () => {
    const keyPair = generateOrgKeyPair()
    const envelope1 = encryptRecord(plaintext, keyPair.publicKey)
    const envelope2 = encryptRecord(plaintext, keyPair.publicKey)
    expect(envelope1.nonce).not.toBe(envelope2.nonce)
  })

  test('tampered ciphertext throws', () => {
    const keyPair = generateOrgKeyPair()
    const envelope = encryptRecord(plaintext, keyPair.publicKey)

    // Tamper with the ciphertext by flipping some base64 characters
    envelope.ciphertext = envelope.ciphertext
      .split('')
      .map((char, i) => (i === 0 ? (char === 'A' ? 'B' : 'A') : char))
      .join('')

    expect(() => decryptRecord(envelope, keyPair.secretKey)).toThrow('Decryption failed')
  })

  test('deriveKeyFromPassphrase produces consistent keypair', () => {
    const key1 = deriveKeyFromPassphrase('my secret')
    const key2 = deriveKeyFromPassphrase('my secret')
    expect(Array.from(key1.publicKey)).toEqual(Array.from(key2.publicKey))
    expect(Array.from(key1.secretKey)).toEqual(Array.from(key2.secretKey))
  })

  test('deriveKeyFromPassphrase different passphrases produce different keys', () => {
    const key1 = deriveKeyFromPassphrase('my secret')
    const key2 = deriveKeyFromPassphrase('my other secret')
    expect(Array.from(key1.publicKey)).not.toEqual(Array.from(key2.publicKey))
  })
})
