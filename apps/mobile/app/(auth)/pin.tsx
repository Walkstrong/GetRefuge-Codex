import { useState } from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'

const CODE = '159753'

export default function PinScreen() {
  const router = useRouter()
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')

  function pressDigit(d: string) {
    if (pin.length >= 6) return
    const next = pin + d
    setPin(next)
    setError('')
    if (next.length === 6) {
      if (next === CODE) {
        router.replace('/(auth)/login')
      } else {
        setError('Incorrect PIN')
        setPin('')
      }
    }
  }

  function pressBackspace() {
    setPin((prev) => prev.slice(0, -1))
    setError('')
  }

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Enter PIN</Text>
      <View style={styles.dots}>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <View
            key={i}
            style={[styles.dot, i < pin.length && styles.dotFilled]}
          />
        ))}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.pad}>
        <View style={styles.row}>
          <PinBtn label="1" onPress={() => pressDigit('1')} />
          <PinBtn label="2" onPress={() => pressDigit('2')} />
          <PinBtn label="3" onPress={() => pressDigit('3')} />
        </View>
        <View style={styles.row}>
          <PinBtn label="4" onPress={() => pressDigit('4')} />
          <PinBtn label="5" onPress={() => pressDigit('5')} />
          <PinBtn label="6" onPress={() => pressDigit('6')} />
        </View>
        <View style={styles.row}>
          <PinBtn label="7" onPress={() => pressDigit('7')} />
          <PinBtn label="8" onPress={() => pressDigit('8')} />
          <PinBtn label="9" onPress={() => pressDigit('9')} />
        </View>
        <View style={styles.row}>
          <View style={styles.spacer} />
          <PinBtn label="0" onPress={() => pressDigit('0')} />
          <Pressable style={styles.spacer} onPress={pressBackspace}>
            <Text style={styles.backspace}>⌫</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  )
}

function PinBtn({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable style={styles.button} onPress={onPress}>
      <Text style={styles.buttonText}>{label}</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', padding: 24 },
  title: { fontSize: 28, fontWeight: '600', marginBottom: 24, color: '#111' },
  dots: { flexDirection: 'row', gap: 16, marginBottom: 12 },
  dot: { width: 16, height: 16, borderRadius: 8, borderWidth: 1.5, borderColor: '#999', backgroundColor: 'transparent' },
  dotFilled: { backgroundColor: '#111', borderColor: '#111' },
  error: { color: '#c00', fontSize: 14, marginBottom: 12, minHeight: 20 },
  pad: { marginTop: 24, width: '100%', maxWidth: 320 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  button: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#f0f0f0', justifyContent: 'center', alignItems: 'center' },
  buttonText: { fontSize: 28, color: '#111' },
  spacer: { width: 80, height: 80, justifyContent: 'center', alignItems: 'center' },
  backspace: { fontSize: 24, color: '#555' },
})