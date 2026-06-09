import { Pressable, StyleSheet, Text, View } from 'react-native'
import type { AiCheckNotice } from '../lib/localAi/aiCheckEvents'

interface AiCheckCardProps {
  notice: AiCheckNotice
  onDismiss: () => void
}

export default function AiCheckCard({ notice, onDismiss }: AiCheckCardProps) {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>AI check</Text>
        <Pressable onPress={onDismiss} hitSlop={8}>
          <Text style={styles.dismiss}>Dismiss</Text>
        </Pressable>
      </View>

      <View style={styles.row}>
        <Text style={styles.label}>Priority</Text>
        <Text style={styles.priority}>{notice.priority}</Text>
      </View>

      {notice.needsSupervisorReview ? (
        <View style={styles.reviewBox}>
          <Text style={styles.reviewText}>Supervisor review may be needed.</Text>
        </View>
      ) : null}

      {notice.imageCheck ? (
        <>
          <Text style={styles.label}>Image check</Text>
          <Text style={styles.body}>{notice.imageCheck}</Text>
        </>
      ) : null}

      <Text style={styles.label}>Suggested next step</Text>
      <Text style={styles.body}>{notice.suggestedNextStep}</Text>

      <Text style={styles.footer}>Processed on this device. Original report unchanged.</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#eef7f1',
    borderColor: '#b8dfc2',
    borderWidth: 1,
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: { fontSize: 18, fontWeight: '700', color: '#14351e' },
  dismiss: { fontSize: 13, fontWeight: '600', color: '#236b36' },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  label: { fontSize: 12, fontWeight: '700', color: '#45624c', textTransform: 'uppercase' },
  priority: { fontSize: 16, fontWeight: '700', color: '#14351e' },
  reviewBox: {
    backgroundColor: '#fff3e6',
    borderColor: '#ffd3a3',
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
  },
  reviewText: { fontSize: 14, fontWeight: '600', color: '#7a3d00' },
  body: { fontSize: 15, lineHeight: 21, color: '#1f2d23', marginTop: 6 },
  footer: { fontSize: 12, color: '#5f7465', marginTop: 12 },
})
