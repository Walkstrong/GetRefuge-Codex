import nacl from 'tweetnacl'
import { encodeBase64 } from 'tweetnacl-util'

export function generateNonce(): string {
  return encodeBase64(nacl.randomBytes(24))
}

export { encodeBase64, decodeBase64 } from 'tweetnacl-util'
