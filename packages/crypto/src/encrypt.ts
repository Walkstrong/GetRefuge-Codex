import nacl from 'tweetnacl'
import { decodeBase64, encodeBase64 } from 'tweetnacl-util'
import { EncryptedEnvelope } from './envelope'

export function encryptRecord(
  plaintext: { [k: string]: unknown },
  orgPublicKey: Uint8Array
): EncryptedEnvelope {
  const ephemeralKeyPair = nacl.box.keyPair()
  const nonceBytes = nacl.randomBytes(24)
  const plaintextBytes = new TextEncoder().encode(JSON.stringify(plaintext))

  const ciphertext = nacl.box(
    plaintextBytes,
    nonceBytes,
    orgPublicKey,
    ephemeralKeyPair.secretKey
  )

  const envelope: EncryptedEnvelope = {
    version: 1,
    algorithm: 'nacl.box',
    ephemeralPublicKey: encodeBase64(ephemeralKeyPair.publicKey),
    nonce: encodeBase64(nonceBytes),
    ciphertext: encodeBase64(ciphertext),
  }

  return envelope
}

export function decryptRecord(
  envelope: EncryptedEnvelope,
  orgSecretKey: Uint8Array
): { [k: string]: unknown } {
  const ephemeralPublicKey = decodeBase64(envelope.ephemeralPublicKey)
  const nonce = decodeBase64(envelope.nonce)
  const ciphertext = decodeBase64(envelope.ciphertext)

  const plaintext = nacl.box.open(
    ciphertext,
    nonce,
    ephemeralPublicKey,
    orgSecretKey
  )

  if (!plaintext) {
    throw new Error('Decryption failed: invalid ciphertext or tampered envelope')
  }

  const plaintextJson = new TextDecoder().decode(plaintext)
  return JSON.parse(plaintextJson) as { [k: string]: unknown }
}
