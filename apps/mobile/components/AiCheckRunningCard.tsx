import { StyleSheet, Text, View } from 'react-native'

export default function AiCheckRunningCard() {
  return (
    <View style={styles.card}>
      <View style={styles.dot} />
      <View style={styles.textWrap}>
        <Text style={styles.title}>AI check running on this device</Text>
        <Text style={styles.body}>You can continue working. The original report is already saved.</Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#f2f7ff',
    borderColor: '#c5dbff',
    borderWidth: 1,
    padding: 14,
    borderRadius: 12,
    marginBottom: 16,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#2f7df6',
  },
  textWrap: { flex: 1 },
  title: { fontSize: 14, fontWeight: '700', color: '#15386f' },
  body: { fontSize: 13, color: '#49617f', marginTop: 2 },
})
