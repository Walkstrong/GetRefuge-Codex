export interface EncryptedEnvelope {
  version: 1
  algorithm: 'nacl.box'
  ephemeralPublicKey: string
  nonce: string
  ciphertext: string
}

export function serializeEnvelope(envelope: EncryptedEnvelope): string {
  return JSON.stringify(envelope)
}

export function deserializeEnvelope(raw: string): EncryptedEnvelope {
  const parsed = JSON.parse(raw) as unknown

  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error('Invalid envelope: not an object')
  }

  const p = parsed as { [k: string]: unknown }

  if (p.version !== 1) {
    throw new Error('Unsupported envelope version')
  }
  if (p.algorithm !== 'nacl.box') {
    throw new Error('Unsupported envelope algorithm')
  }
  if (
    typeof p.ephemeralPublicKey !== 'string' ||
    typeof p.nonce !== 'string' ||
    typeof p.ciphertext !== 'string'
  ) {
    throw new Error('Invalid envelope structure')
  }

  return p as unknown as EncryptedEnvelope
}
