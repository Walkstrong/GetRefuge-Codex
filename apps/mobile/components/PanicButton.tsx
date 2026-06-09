import { Pressable, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'

export default function PanicButton() {
  const router = useRouter()

  return (
    <Pressable
      style={styles.btn}
      onPress={() => {
        // Replace to decoy so back button can't return to app
        router.replace('/decoy')
      }}
      accessibilityLabel="Menu"
    />
  )
}

const styles = StyleSheet.create({
  btn: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#ccc',
    marginRight: 16,
  },
})
