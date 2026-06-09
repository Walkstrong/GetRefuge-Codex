import nacl from 'tweetnacl'
import { decodeUTF8 } from 'tweetnacl-util'

export function generateOrgKeyPair(): { publicKey: Uint8Array; secretKey: Uint8Array } {
  const seed = nacl.randomBytes(32)
  const keyPair = nacl.box.keyPair.fromSecretKey(seed)
  return {
    publicKey: keyPair.publicKey,
    secretKey: keyPair.secretKey,
  }
}

export function deriveKeyFromPassphrase(passphrase: string): { publicKey: Uint8Array; secretKey: Uint8Array } {
  const digest = nacl.hash(decodeUTF8(passphrase))
  const secretKey = digest.slice(0, 32)
  const keyPair = nacl.box.keyPair.fromSecretKey(secretKey)
  return {
    publicKey: keyPair.publicKey,
    secretKey: keyPair.secretKey,
  }
}