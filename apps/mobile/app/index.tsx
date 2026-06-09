import { Redirect } from 'expo-router'

// Default route redirects to decoy calculator screen
export default function Index() {
  return <Redirect href="/decoy" />
}
