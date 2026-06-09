import * as SecureStore from 'expo-secure-store'

const ORG_PUBLIC_KEY = 'org_public_key'

export async function storeOrgPublicKey(base64Key: string): Promise<void> {
  await SecureStore.setItemAsync(ORG_PUBLIC_KEY, base64Key)
}

export async function getOrgPublicKey(): Promise<string | null> {
  return await SecureStore.getItemAsync(ORG_PUBLIC_KEY)
}
