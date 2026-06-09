import 'react-native-get-random-values'   // must be first - polyfills crypto.getRandomValues for uuid
import '../lib/crypto-polyfill'           // then tweetnacl PRNG
import { Stack } from 'expo-router'

export default function RootLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }} />
  )
}
