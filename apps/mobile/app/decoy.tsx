import { useState } from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'

const CODE = '159753'

export default function DecoyScreen() {
  const router = useRouter()
  const [display, setDisplay] = useState('0')
  const [operand, setOperand] = useState<number | null>(null)
  const [operator, setOperator] = useState<string | null>(null)
  const [fresh, setFresh] = useState(true)
  const [sequence, setSequence] = useState('')

  function pressDigit(d: string) {
    setDisplay((prev) => {
      if (fresh || prev === '0') {
        setFresh(false)
        return d
      }
      return prev + d
    })
    setSequence((prev) => prev + d)
  }

  function pressDecimal() {
    setDisplay((prev) => {
      if (fresh) {
        setFresh(false)
        return '0.'
      }
      if (prev.includes('.')) return prev
      return prev + '.'
    })
    setSequence((prev) => prev + '.')
  }

  function compute(a: number, b: number, op: string): number {
    switch (op) {
      case '+': return a + b
      case '-': return a - b
      case '×': return a * b
      case '÷': return b === 0 ? NaN : a / b
      default: return b
    }
  }

  function pressOp(op: string) {
    const current = parseFloat(display)
    if (operand !== null && operator && !fresh) {
      const result = compute(operand, current, operator)
      setDisplay(String(result))
      setOperand(result)
    } else {
      setOperand(current)
    }
    setOperator(op)
    setFresh(true)
    setSequence((prev) => prev + op)
  }

  function pressEqual() {
    const current = parseFloat(display)

    if (sequence === CODE) {
      router.push('/(auth)/pin')
      return
    }

    if (operand !== null && operator) {
      const result = compute(operand, current, operator)
      setDisplay(String(result))
      setOperand(null)
      setOperator(null)
      setFresh(true)
    }
    setSequence('')
  }

  function pressClear() {
    setDisplay('0')
    setOperand(null)
    setOperator(null)
    setFresh(true)
    setSequence('')
  }

  function pressBackspace() {
    setDisplay((prev) => {
      if (prev.length <= 1 || (prev.length === 2 && prev[0] === '-')) {
        setFresh(true)
        return '0'
      }
      return prev.slice(0, -1)
    })
    setSequence((prev) => prev.slice(0, -1))
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.display}>
        <Text style={styles.displayText} numberOfLines={1} adjustsFontSizeToFit>
          {display}
        </Text>
      </View>

      <View style={styles.row}>
        <Key label="C" onPress={pressClear} s={styles.gray} />
        <Key label="⌫" onPress={pressBackspace} s={styles.gray} />
        <Key label="÷" onPress={() => pressOp('÷')} s={styles.orange} />
        <Key label="×" onPress={() => pressOp('×')} s={styles.orange} />
      </View>

      <View style={styles.row}>
        <Key label="7" onPress={() => pressDigit('7')} />
        <Key label="8" onPress={() => pressDigit('8')} />
        <Key label="9" onPress={() => pressDigit('9')} />
        <Key label="-" onPress={() => pressOp('-')} s={styles.orange} />
      </View>

      <View style={styles.row}>
        <Key label="4" onPress={() => pressDigit('4')} />
        <Key label="5" onPress={() => pressDigit('5')} />
        <Key label="6" onPress={() => pressDigit('6')} />
        <Key label="+" onPress={() => pressOp('+')} s={styles.orange} />
      </View>

      <View style={styles.row}>
        <Key label="1" onPress={() => pressDigit('1')} />
        <Key label="2" onPress={() => pressDigit('2')} />
        <Key label="3" onPress={() => pressDigit('3')} />
        <Key label="=" onPress={pressEqual} s={styles.equals} />
      </View>

      <View style={styles.row}>
        <Key label="0" onPress={() => pressDigit('0')} s={styles.zero} />
        <Key label="." onPress={pressDecimal} />
      </View>
    </SafeAreaView>
  )
}

function Key({ label, onPress, s }: { label: string; onPress: () => void; s?: any }) {
  return (
    <Pressable style={[styles.button, s]} onPress={onPress}>
      <Text style={[styles.buttonText, s?.text]}>{label}</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1c1c1c', padding: 8 },
  display: { flex: 1, justifyContent: 'flex-end', alignItems: 'flex-end', padding: 16, paddingBottom: 24 },
  displayText: { color: '#fff', fontSize: 72, fontWeight: '300' },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  button: {
    flex: 1, margin: 5, height: 76,
    backgroundColor: '#333', justifyContent: 'center', alignItems: 'center',
    borderRadius: 38,
  },
  buttonText: { color: '#fff', fontSize: 28, fontWeight: '500' },
  zero: { flex: 2.2, alignItems: 'flex-start', paddingLeft: 32 },
  orange: { backgroundColor: '#ff9500' },
  gray: { backgroundColor: '#a5a5a5' },
  equals: { backgroundColor: '#ff9500', flex: 1 },
})
