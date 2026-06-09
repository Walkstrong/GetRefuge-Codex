import { useState } from 'react'
import { ScrollView, View, Text, TextInput, Pressable, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { beneficiarySchema } from '@getrefuge/shared-schema'
import { encryptRecord } from '@getrefuge/crypto'
import { getOrgPublicKey } from '../../../lib/orgKey'
import { decodeBase64 } from 'tweetnacl-util'
import { database } from '../../../database'
import type RefugeRecord from '../../../model/Record'
import { persistLocalAiAnalysis } from '../../../lib/localAi/persistAnalysis'
import { saveBeneficiaryLocalBriefingFact } from '../../../lib/localBriefing'
import * as ImagePicker from 'expo-image-picker'
import { v4 as uuidv4 } from 'uuid'
import { useSync } from '../../../hooks/useSync'

export default function BeneficiaryForm() {
  const router = useRouter()
  const { triggerSync } = useSync()
  const [form, setForm] = useState({
    interviewerName: '',
    interviewDate: new Date().toISOString(),
    region: '',
    beneficiaryCode: '',
    ageRange: '0-5',
    gender: 'male',
    householdSize: '',
    primaryNeeds: [] as string[],
    primaryNeedsOther: '',
    currentSituation: '',
    servicesReceived: '',
    satisfactionLevel: '',
    protectionConcerns: false,
    protectionDetails: '',
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
      householdSize: form.householdSize ? parseInt(form.householdSize, 10) : undefined,
    }
    const parsed = beneficiarySchema.safeParse(payload)
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
          draft.form_type = 'beneficiary'
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
        saveBeneficiaryLocalBriefingFact({
          recordId: savedRecordId,
          data: parsed.data,
          createdAt,
        }).catch((e) => console.warn('[local-briefing] fact save failed:', e))
        persistLocalAiAnalysis({
          recordId: savedRecordId,
          formType: 'beneficiary',
          formData: { ...parsed.data },
          imageBase64: photoBase64,
          orgPublicKey,
          triggerSync,
        })
      }
      router.back()
    } catch (e) {
      console.error('save error', e)
    } finally {
      setSaving(false)
    }
  }

  const ageRanges = ['0-5', '6-12', '13-17', '18-25', '26-40', '41-60', '60+']
  const genders = ['male', 'female', 'other', 'prefer_not_to_say']
  const primaryNeedsOptions = [
    'food',
    'water',
    'shelter',
    'medical',
    'psychosocial',
    'education',
    'legal',
    'livelihood',
    'protection',
    'other',
  ]
  const satisfactionLevels = [
    'very_dissatisfied',
    'dissatisfied',
    'neutral',
    'satisfied',
    'very_satisfied',
  ]

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.header}>Beneficiary Interview</Text>

        <Label>Interviewer Name *</Label>
        <Input value={form.interviewerName} onChangeText={(t: string) => update('interviewerName', t)} />
        {errors.interviewerName ? <FieldError text={errors.interviewerName} /> : null}

        <Label>Interview Date *</Label>
        <Input value={form.interviewDate} onChangeText={(t: string) => update('interviewDate', t)} />

        <Label>Region *</Label>
        <Input value={form.region} onChangeText={(t: string) => update('region', t)} />
        {errors.region ? <FieldError text={errors.region} /> : null}

        <Label>Beneficiary Code *</Label>
        <Input value={form.beneficiaryCode} onChangeText={(t: string) => update('beneficiaryCode', t)} />

        <Label>Age Range *</Label>
        <Picker value={form.ageRange} options={ageRanges} onChange={(v) => update('ageRange', v)} />

        <Label>Gender *</Label>
        <Picker value={form.gender} options={genders} onChange={(v) => update('gender', v)} />

        <Label>Household Size</Label>
        <Input value={form.householdSize} onChangeText={(t: string) => update('householdSize', t)} keyboardType="numeric" />

        <Label>Primary Needs *</Label>
        <View style={styles.checkboxes}>
          {primaryNeedsOptions.map((need) => (
            <CheckBox
              key={need}
              label={need}
              value={form.primaryNeeds.includes(need)}
              onToggle={(checked) => {
                setForm((prev) => {
                  const needs = [...prev.primaryNeeds]
                  if (checked) {
                    if (!needs.includes(need)) needs.push(need)
                  } else {
                    const idx = needs.indexOf(need)
                    if (idx >= 0) needs.splice(idx, 1)
                  }
                  return { ...prev, primaryNeeds: needs }
                })
              }}
            />
          ))}
        </View>

        {form.primaryNeeds.includes('other') ? (
          <>
            <Label>Other Needs</Label>
            <Input value={form.primaryNeedsOther} onChangeText={(t: string) => update('primaryNeedsOther', t)} />
          </>
        ) : null}

        <Label>Current Situation *</Label>
        <TextArea value={form.currentSituation} onChangeText={(t: string) => update('currentSituation', t)} />

        <Label>Services Received</Label>
        <TextArea value={form.servicesReceived} onChangeText={(t: string) => update('servicesReceived', t)} />

        <Label>Satisfaction Level</Label>
        <Picker value={form.satisfactionLevel} options={satisfactionLevels} onChange={(v) => update('satisfactionLevel', v)} />

        <Label>Protection Concerns</Label>
        <Toggle value={form.protectionConcerns} onChange={(v) => update('protectionConcerns', v)} />

        {form.protectionConcerns ? (
          <>
            <Label>Protection Details</Label>
            <TextArea value={form.protectionDetails} onChangeText={(t: string) => update('protectionDetails', t)} />
          </>
        ) : null}

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

function CheckBox({ label, value, onToggle }: { label: string; value: boolean; onToggle: (checked: boolean) => void }) {
  return (
    <Pressable style={styles.checkboxRow} onPress={() => onToggle(!value)}>
      <View style={[styles.checkbox, value && styles.checkboxChecked]}>
        {value ? <View style={styles.checkboxInner} /> : null}
      </View>
      <Text style={styles.checkboxLabel}>{label}</Text>
    </Pressable>
  )
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

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={styles.toggleRow}>
      <Pressable style={[styles.toggleBtn, value && styles.toggleActive]} onPress={() => onChange(true)}>
        <Text style={styles.toggleText}>Yes</Text>
      </Pressable>
      <Pressable style={[styles.toggleBtn, !value && styles.toggleActive]} onPress={() => onChange(false)}>
        <Text style={styles.toggleText}>No</Text>
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
  checkboxes: { marginTop: 4 },
  checkboxRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  checkbox: { width: 18, height: 18, borderWidth: 2, borderColor: '#ddd', borderRadius: 4, marginRight: 8 },
  checkboxChecked: { borderColor: '#007aff' },
  checkboxInner: { width: 12, height: 12, backgroundColor: '#007aff', borderRadius: 2 },
  checkboxLabel: { fontSize: 16 },
  pickerRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  pill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: '#f0f0f0' },
  pillActive: { backgroundColor: '#007aff' },
  pillText: { fontSize: 13, color: '#444' },
  pillTextActive: { color: '#fff' },
  toggleRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  toggleBtn: { flex: 1, padding: 10, borderRadius: 8, backgroundColor: '#f0f0f0', alignItems: 'center' },
  toggleActive: { backgroundColor: '#007aff' },
  toggleText: { color: '#fff', fontWeight: '600' },
  photoBtn: { marginTop: 20, padding: 14, borderRadius: 10, backgroundColor: '#f0f0f0', alignItems: 'center' },
  photoText: { fontSize: 16, color: '#444' },
  submit: { marginTop: 20, padding: 16, borderRadius: 10, backgroundColor: '#007aff', alignItems: 'center' },
  submitText: { color: '#fff', fontSize: 16, fontWeight: '600' },
})
