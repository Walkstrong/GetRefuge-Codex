import { useEffect, useState } from 'react'
import { ActivityIndicator, ScrollView, View, Text, Pressable, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import SyncStatus from '../../components/SyncStatus'
import AiCheckCard from '../../components/AiCheckCard'
import AiCheckRunningCard from '../../components/AiCheckRunningCard'
import { generateLocalBriefing, type LocalBriefingResult } from '../../lib/localBriefing'
import {
  subscribeToAiCheckNotices,
  subscribeToAiCheckRunning,
  type AiCheckNotice,
  type AiCheckRunningNotice,
} from '../../lib/localAi/aiCheckEvents'

export default function HomeScreen() {
  const router = useRouter()
  const [aiCheckNotice, setAiCheckNotice] = useState<AiCheckNotice | null>(null)
  const [runningNotice, setRunningNotice] = useState<AiCheckRunningNotice | null>(null)
  const [dismissedNoticeId, setDismissedNoticeId] = useState<string | null>(null)
  const [localBriefing, setLocalBriefing] = useState<LocalBriefingResult | null>(null)
  const [briefingLoading, setBriefingLoading] = useState(false)
  const [briefingError, setBriefingError] = useState<string | null>(null)

  useEffect(() => {
    return subscribeToAiCheckNotices((notice) => {
      setAiCheckNotice(notice)
      setDismissedNoticeId((previous) => (previous === notice?.id ? previous : null))
    })
  }, [])

  useEffect(() => {
    return subscribeToAiCheckRunning(setRunningNotice)
  }, [])

  const visibleAiCheck = aiCheckNotice?.id === dismissedNoticeId ? null : aiCheckNotice
  const showRunning = Boolean(runningNotice && !visibleAiCheck)

  async function handleLocalBriefing() {
    setBriefingLoading(true)
    setBriefingError(null)
    try {
      const result = await generateLocalBriefing()
      setLocalBriefing(result)
    } catch {
      setBriefingError('Local briefing is not available right now.')
    } finally {
      setBriefingLoading(false)
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>GetRefuge</Text>
          <SyncStatus />
        </View>
        <Text style={styles.subtitle}>Select a form to complete</Text>

        {visibleAiCheck ? (
          <AiCheckCard notice={visibleAiCheck} onDismiss={() => setDismissedNoticeId(visibleAiCheck.id)} />
        ) : null}

        {showRunning ? <AiCheckRunningCard /> : null}

        <Pressable
          style={[styles.card, styles.localBriefingCard]}
          onPress={handleLocalBriefing}
          disabled={briefingLoading}
        >
          <View style={styles.cardHeaderRow}>
            <View style={styles.cardHeaderText}>
              <Text style={styles.cardTitle}>Local Briefing</Text>
              <Text style={styles.cardDesc}>Review recent reports stored on this device</Text>
            </View>
            {briefingLoading ? <ActivityIndicator color="#155b39" /> : <Text style={styles.cardAction}>Open</Text>}
          </View>
        </Pressable>

        {briefingError ? (
          <View style={styles.briefingPanel}>
            <Text style={styles.briefingTitle}>Local briefing</Text>
            <Text style={styles.briefingBody}>{briefingError}</Text>
          </View>
        ) : null}

        {localBriefing ? (
          <View style={styles.briefingPanel}>
            <Text style={styles.briefingTitle}>{localBriefing.title}</Text>
            <Text style={styles.briefingLabel}>Based on records on this device</Text>
            <Text style={styles.briefingBody}>{localBriefing.evidenceText}</Text>
            <Text style={styles.briefingBody}>{localBriefing.freshnessText}</Text>
            <Text style={styles.briefingBody}>{localBriefing.needsText}</Text>
            <Text style={styles.briefingLabel}>Uncertainty</Text>
            <Text style={styles.briefingBody}>{localBriefing.uncertaintyText}</Text>
            <Text style={styles.briefingLabel}>Suggested next step</Text>
            <Text style={styles.briefingNextStep}>{localBriefing.suggestedNextStep}</Text>
            <Text style={styles.briefingFooter}>Processed on this device.</Text>
          </View>
        ) : null}

        <Pressable style={styles.card} onPress={() => router.push('/(app)/form/incident')}>
          <Text style={styles.cardTitle}>Incident Report</Text>
          <Text style={styles.cardDesc}>Document protection incidents and threats</Text>
        </Pressable>

        <Pressable style={styles.card} onPress={() => router.push('/(app)/form/beneficiary')}>
          <Text style={styles.cardTitle}>Beneficiary Interview</Text>
          <Text style={styles.cardDesc}>Record needs assessments and services</Text>
        </Pressable>

        <Pressable style={styles.card} onPress={() => router.push('./local-ai-test')}>
          <Text style={styles.cardTitle}>Local AI Test</Text>
          <Text style={styles.cardDesc}>Run local on-device analysis</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  scroll: { padding: 24, paddingBottom: 40 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  title: { fontSize: 32, fontWeight: '700', color: '#111' },
  subtitle: { fontSize: 16, color: '#666', marginBottom: 24 },
  card: { backgroundColor: '#f5f5f5', padding: 20, borderRadius: 12, marginBottom: 16 },
  localBriefingCard: { backgroundColor: '#eef7f1', borderColor: '#b8dfc2', borderWidth: 1 },
  cardHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  cardHeaderText: { flex: 1 },
  cardAction: { fontSize: 14, fontWeight: '700', color: '#236b36' },
  cardTitle: { fontSize: 18, fontWeight: '600', color: '#111', marginBottom: 4 },
  cardDesc: { fontSize: 14, color: '#666' },
  briefingPanel: {
    backgroundColor: '#fff',
    borderColor: '#d9e7dd',
    borderWidth: 1,
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  briefingTitle: { fontSize: 18, fontWeight: '700', color: '#14351e', marginBottom: 10 },
  briefingLabel: { fontSize: 12, fontWeight: '700', color: '#45624c', textTransform: 'uppercase', marginTop: 8 },
  briefingBody: { fontSize: 14, lineHeight: 20, color: '#1f2d23', marginTop: 4 },
  briefingNextStep: { fontSize: 15, lineHeight: 21, color: '#14351e', marginTop: 4, fontWeight: '600' },
  briefingFooter: { fontSize: 12, color: '#5f7465', marginTop: 12 },
})
