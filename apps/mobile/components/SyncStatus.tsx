import { View, Text, StyleSheet } from 'react-native'
import { useSync } from '../hooks/useSync'

export default function SyncStatus() {
  const { pendingCount, failedCount, lastSync, isSyncing, isOnline } = useSync()

  let statusText = 'Synced'
  if (isSyncing) statusText = 'Syncing...'
  else if (!isOnline) statusText = 'Offline'
  else if (failedCount > 0) statusText = `${failedCount} failed`
  else if (pendingCount > 0) statusText = `${pendingCount} pending`

  const dotStyle = !isOnline
    ? styles.offline
    : failedCount > 0
    ? styles.failed
    : styles.online

  return (
    <View style={styles.container}>
      <View style={[styles.dot, dotStyle]} />
      <Text style={styles.text}>{statusText}</Text>
      {lastSync ? (
        <Text style={styles.time}>
          Last: {new Date(lastSync).toLocaleTimeString()}
        </Text>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#f0f0f0',
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  online: { backgroundColor: '#34c759' },
  offline: { backgroundColor: '#ff3b30' },
  failed: { backgroundColor: '#ff9500' },
  text: { fontSize: 12, color: '#444', fontWeight: '500' },
  time: { fontSize: 11, color: '#888' },
})