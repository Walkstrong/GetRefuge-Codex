import { Stack } from 'expo-router'
import PanicButton from '../../components/PanicButton'

export default function AppLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerRight: () => <PanicButton />,
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Home' }} />
      <Stack.Screen name="form/incident" options={{ title: 'Incident Report' }} />
      <Stack.Screen name="form/beneficiary" options={{ title: 'Beneficiary Interview' }} />
      <Stack.Screen name="local-ai-test" options={{ title: 'Local AI Test' }} />
    </Stack>
  )
}
