import { useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import * as ImagePicker from 'expo-image-picker'
import { decodeBase64 } from 'tweetnacl-util'
import { localAiInfer, type LocalAiInferResult } from '../../lib/localAi'

const SAMPLE_REPORT =
  'Flooding has overtopped a riverbank in a dense urban area. Water is high and fast-moving near public buildings. Nearby families may need evacuation support, clean water, sanitation checks, and health screening. No injuries have been confirmed yet.'

export default function LocalAiTestScreen() {
  const [reportText, setReportText] = useState(SAMPLE_REPORT)
  const [imageBase64, setImageBase64] = useState<string | null>(null)
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<LocalAiInferResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function pickPhoto() {
    const selected = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 0.6,
      base64: true,
    })

    if (!selected.canceled && selected.assets[0]?.base64) {
      setImageBase64(selected.assets[0].base64)
    }
  }

  async function runLocalAi() {
    setRunning(true)
    setResult(null)
    setError(null)

    try {
      const image = imageBase64 ? decodeBase64(imageBase64) : undefined
      const response = await localAiInfer({ text: reportText, image })
      setResult(response)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Local AI inference failed')
    } finally {
      setRunning(false)
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Local AI Test</Text>
        <Text style={styles.subtitle}>Model path: /data/local/tmp/llm/local-ai.task</Text>

        <Text style={styles.label}>Written report</Text>
        <TextInput
          style={styles.textArea}
          multiline
          value={reportText}
          onChangeText={setReportText}
          textAlignVertical="top"
        />

        <View style={styles.row}>
          <Pressable style={styles.secondaryButton} onPress={pickPhoto}>
            <Text style={styles.secondaryButtonText}>{imageBase64 ? 'Replace Photo' : 'Attach Photo'}</Text>
          </Pressable>
          <Text style={styles.photoState}>{imageBase64 ? 'Photo ready' : 'Text only'}</Text>
        </View>

        <Pressable style={[styles.primaryButton, running && styles.disabledButton]} onPress={runLocalAi} disabled={running}>
          <Text style={styles.primaryButtonText}>{running ? 'Running local AI...' : 'Run local AI'}</Text>
        </Pressable>

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorTitle}>Error</Text>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {result ? (
          <View style={styles.resultBox}>
            <Text style={styles.resultTitle}>Parsed analysis</Text>
            {result.analysis.imageCheck ? (
              <Text style={styles.resultText}>Image check: {result.analysis.imageCheck}</Text>
            ) : null}
            <Text style={styles.resultText}>Severity: {result.analysis.severity}</Text>
            <Text style={styles.resultText}>Follow-up: {result.analysis.suggestedFollowUp}</Text>
            <Text style={styles.resultText}>
              Protection concern: {result.analysis.protectionConcernFlag ? 'yes' : 'no'}
            </Text>
            <Text style={styles.resultText}>Confidence: {result.analysis.confidenceScore}</Text>
            <Text style={styles.resultText}>Latency: {(result.latencyMs / 1000).toFixed(1)}s</Text>

            <Text style={styles.rawTitle}>Raw output</Text>
            <Text style={styles.rawText}>{result.rawOutput}</Text>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  scroll: { padding: 16, paddingBottom: 40 },
  title: { fontSize: 24, fontWeight: '700', color: '#111', marginBottom: 4 },
  subtitle: { fontSize: 13, color: '#666', marginBottom: 18 },
  label: { fontSize: 14, fontWeight: '600', color: '#333', marginBottom: 6 },
  textArea: {
    minHeight: 160,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    backgroundColor: '#fafafa',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 14 },
  secondaryButton: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8, backgroundColor: '#f0f0f0' },
  secondaryButtonText: { color: '#333', fontWeight: '600' },
  photoState: { color: '#666', fontSize: 14 },
  primaryButton: { marginTop: 18, padding: 15, borderRadius: 10, backgroundColor: '#007aff', alignItems: 'center' },
  disabledButton: { opacity: 0.6 },
  primaryButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  errorBox: { marginTop: 18, padding: 14, borderRadius: 10, backgroundColor: '#fff1f1' },
  errorTitle: { color: '#a00', fontWeight: '700', marginBottom: 4 },
  errorText: { color: '#a00' },
  resultBox: { marginTop: 18, padding: 14, borderRadius: 10, backgroundColor: '#f5f7fb' },
  resultTitle: { fontSize: 18, fontWeight: '700', color: '#111', marginBottom: 8 },
  resultText: { fontSize: 14, color: '#333', marginBottom: 5 },
  rawTitle: { fontSize: 15, fontWeight: '700', color: '#111', marginTop: 12, marginBottom: 4 },
  rawText: { fontSize: 12, color: '#444' },
})
