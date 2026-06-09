import { useState } from 'react'
import { ScrollView, View, Text, TextInput, Pressable, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { incidentSchema } from '@getrefuge/shared-schema'
import { encryptRecord } from '@getrefuge/crypto'
import { getOrgPublicKey } from '../../../lib/orgKey'
import { decodeBase64 } from 'tweetnacl-util'
import { database } from '../../../database'
import type RefugeRecord from '../../../model/Record'
import { persistLocalAiAnalysis } from '../../../lib/localAi/persistAnalysis'
import { saveIncidentLocalBriefingFact } from '../../../lib/localBriefing'
import * as ImagePicker from 'expo-image-picker'
import { v4 as uuidv4 } from 'uuid'
import { useSync } from '../../../hooks/useSync'

export default function IncidentForm() {
  const router = useRouter()
  const { triggerSync } = useSync()
  const [form, setForm] = useState({
    reporterName: '',
    reporterRole: '',
    reportDate: new Date().toISOString(),
    region: '',
    location: '',
    incidentDate: new Date().toISOString(),
    incidentType: 'other',
    incidentTypeOther: '',
    severityLevel: 'medium',
    description: '',
    numberOfAffected: '',
    actionTaken: '',
    referralMade: false,
    referralDetails: '',
    followUpRequired: false,
    additionalNotes: '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [photoBase64, setPhotoBase64] = useState<string | null>(null)
  const [photoUri, setPhotoUri] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  function update(key: string, value: any) {
    setForm((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => ({ ...prev, [key]: '' }))
  }

  async function pickPhoto() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 0.7,
      base64: true,
    })
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0]
      setPhotoUri(asset.uri)
      setPhotoBase64(asset.base64 ?? null)
    }
  }

  async function handleSubmit() {
    setErrors({})
    const payload = {
      ...form,
      numberOfAffected: form.numberOfAffected ? parseInt(form.numberOfAffected, 10) : undefined,
    }
    const parsed = incidentSchema.safeParse(payload)
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {}
      parsed.error.issues.forEach((issue) => {
        const path = issue.path.join('.')
        fieldErrors[path] = issue.message
      })
      setErrors(fieldErrors)
      return
    }

    setSaving(true)
    try {
      const orgPublicKeyB64 = await getOrgPublicKey()
      if (!orgPublicKeyB64) throw new globalThis.Error('Org public key not found - please log in again')
      const orgPublicKey = decodeBase64(orgPublicKeyB64)
      const encryptedData = encryptRecord(parsed.data, orgPublicKey)

      let encryptedPhoto: string | null = null
      if (photoBase64) {
        const photoObject = { photo: photoBase64 }
        const encryptedPhotoEnvelope = await encryptRecord(photoObject, orgPublicKey)
        encryptedPhoto = JSON.stringify(encryptedPhotoEnvelope)
      }

      let savedRecordId: string | null = null
      const createdAt = Date.now()

      await database.write(async () => {
        const records = database.collections.get('records')
        const recordId = uuidv4()
        await records.create((record) => {
          const draft = record as RefugeRecord
          draft.record_id = recordId
          draft.form_type = 'incident'
          draft.encrypted_data = JSON.stringify(encryptedData)
          draft.has_photo = !!photoBase64
          draft.encrypted_photo = encryptedPhoto ?? undefined
          draft.sync_status = 'pending'
          draft.created_at = createdAt
          draft.updated_at = createdAt
        })
        savedRecordId = recordId
      })

      triggerSync().catch((e) => console.warn('[form] post-save sync failed:', e))

      if (savedRecordId) {
        saveIncidentLocalBriefingFact({
          recordId: savedRecordId,
          data: parsed.data,
          createdAt,
        }).catch((e) => console.warn('[local-briefing] fact save failed:', e))
        persistLocalAiAnalysis({
          recordId: savedRecordId,
          formType: 'incident',
          formData: { ...parsed.data },
          imageBase64: photoBase64,
          orgPublicKey,
          triggerSync,
        })
      }
      router.back()
    } catch (e) {
      console.error('Save error', e)
    } finally {
      setSaving(false)
    }
  }

  const types = ['harassment', 'detention', 'property_damage', 'threat', 'violence', 'displacement', 'restriction_of_movement', 'other']
  const severities = ['low', 'medium', 'high', 'critical']

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.header}>Incident Report</Text>

        <Label>Reporter Name *</Label>
        <Input value={form.reporterName} onChangeText={(t: string) => update('reporterName', t)} />
        {errors.reporterName ? <FieldError text={errors.reporterName} /> : null}

        <Label>Reporter Role</Label>
        <Input value={form.reporterRole} onChangeText={(t: string) => update('reporterRole', t)} />

        <Label>Report Date *</Label>
        <Input value={form.reportDate} onChangeText={(t: string) => update('reportDate', t)} />

        <Label>Region *</Label>
        <Input value={form.region} onChangeText={(t: string) => update('region', t)} />
        {errors.region ? <FieldError text={errors.region} /> : null}

        <Label>Location</Label>
        <Input value={form.location} onChangeText={(t: string) => update('location', t)} />

        <Label>Incident Date *</Label>
        <Input value={form.incidentDate} onChangeText={(t: string) => update('incidentDate', t)} />

        <Label>Incident Type *</Label>
        <Picker value={form.incidentType} options={types} onChange={(v) => update('incidentType', v)} />

        {form.incidentType === 'other' ? (
          <>
            <Label>Other Type</Label>
            <Input value={form.incidentTypeOther} onChangeText={(t: string) => update('incidentTypeOther', t)} />
          </>
        ) : null}

        <Label>Severity *</Label>
        <Picker value={form.severityLevel} options={severities} onChange={(v) => update('severityLevel', v)} />

        <Label>Description *</Label>
        <TextArea value={form.description} onChangeText={(t: string) => update('description', t)} />
        {errors.description ? <FieldError text={errors.description} /> : null}

        <Label>Number of Affected</Label>
        <Input value={form.numberOfAffected} onChangeText={(t: string) => update('numberOfAffected', t)} keyboardType="numeric" />

        <Label>Action Taken</Label>
        <TextArea value={form.actionTaken} onChangeText={(t: string) => update('actionTaken', t)} />

        <Label>Referral Made</Label>
        <Bool value={form.referralMade} onChange={(v) => update('referralMade', v)} />

        {form.referralMade ? (
          <>
            <Label>Referral Details</Label>
            <TextArea value={form.referralDetails} onChangeText={(t: string) => update('referralDetails', t)} />
          </>
        ) : null}

        <Label>Follow Up Required</Label>
        <Bool value={form.followUpRequired} onChange={(v) => update('followUpRequired', v)} />

        <Label>Additional Notes</Label>
        <TextArea value={form.additionalNotes} onChangeText={(t: string) => update('additionalNotes', t)} />

        <Pressable style={styles.photoBtn} onPress={pickPhoto}>
          <Text style={styles.photoText}>{photoBase64 ? 'Photo attached' : 'Attach Photo'}</Text>
        </Pressable>

        <Pressable style={styles.submit} onPress={handleSubmit} disabled={saving}>
          <Text style={styles.submitText}>{saving ? 'Saving...' : 'Save Record'}</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  )
}

function Label({ children }: { children: string }) {
  return <Text style={styles.label}>{children}</Text>
}

function Input(props: any) {
  return <TextInput style={styles.input} {...props} />
}

function TextArea(props: any) {
  return <TextInput style={[styles.input, styles.textArea]} multiline numberOfLines={4} {...props} />
}

function FieldError({ text }: { text: string }) {
  return <Text style={styles.error}>{text}</Text>
}

function Picker({ value, options, onChange }: { value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <View style={styles.pickerRow}>
      {options.map((opt) => (
        <Pressable
          key={opt}
          style={[styles.pill, value === opt && styles.pillActive]}
          onPress={() => onChange(opt)}
        >
          <Text style={[styles.pillText, value === opt && styles.pillTextActive]}>{opt}</Text>
        </Pressable>
      ))}
    </View>
  )
}

function Bool({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={styles.boolRow}>
      <Pressable style={[styles.boolBtn, value && styles.boolActive]} onPress={() => onChange(true)}>
        <Text style={styles.boolText}>Yes</Text>
      </Pressable>
      <Pressable style={[styles.boolBtn, !value && styles.boolActive]} onPress={() => onChange(false)}>
        <Text style={styles.boolText}>No</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  scroll: { padding: 16, paddingBottom: 40 },
  header: { fontSize: 24, fontWeight: '700', marginBottom: 16, color: '#111' },
  label: { fontSize: 14, fontWeight: '500', color: '#444', marginTop: 12, marginBottom: 4 },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 12, fontSize: 16, backgroundColor: '#fafafa' },
  textArea: { height: 80, textAlignVertical: 'top' },
  error: { color: '#c00', fontSize: 12, marginTop: 2 },
  pickerRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  pill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: '#f0f0f0' },
  pillActive: { backgroundColor: '#007aff' },
  pillText: { fontSize: 13, color: '#444' },
  pillTextActive: { color: '#fff' },
  boolRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  boolBtn: { flex: 1, padding: 10, borderRadius: 8, backgroundColor: '#f0f0f0', alignItems: 'center' },
  boolActive: { backgroundColor: '#007aff' },
  boolText: { color: '#fff', fontWeight: '600' },
  photoBtn: { marginTop: 20, padding: 14, borderRadius: 10, backgroundColor: '#f0f0f0', alignItems: 'center' },
  photoText: { fontSize: 16, color: '#444' },
  submit: { marginTop: 20, padding: 16, borderRadius: 10, backgroundColor: '#007aff', alignItems: 'center' },
  submitText: { color: '#fff', fontSize: 16, fontWeight: '600' },
})
