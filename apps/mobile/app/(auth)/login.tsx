import { useEffect, useState } from 'react'
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { supabase } from '../../lib/supabase'
import { storeOrgPublicKey } from '../../lib/orgKey'

export default function LoginScreen() {
  const router = useRouter()
  const [email, updateEmail] = useState('')
  const [password, updatePassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [checkingSession, setCheckingSession] = useState(true)

  // If a Supabase session already exists, skip login entirely
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        router.replace('/(app)')
      } else {
        setCheckingSession(false)
      }
    })
  }, [])

  async function handleLogin() {
    setError('')
    if (!email || !password) {
      setError('Please enter both email and password')
      return
    }
    setLoading(true)

    try {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      console.log('[login] auth result:', JSON.stringify({
        userId: authData?.user?.id,
        hasSession: !!authData?.session,
        authError: authError?.message,
      }))

      if (authError || !authData.user) {
        setError(authError?.message || 'Login failed')
        return
      }

      // Fetch user profile to get org_id
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('org_id')
        .eq('id', authData.user.id)
        .single()

      console.log('[login] users query:', JSON.stringify({
        userData,
        userError: userError?.message,
        userErrorCode: userError?.code,
        userErrorDetails: userError?.details,
      }))

      if (userError || !userData?.org_id) {
        setError(`Could not retrieve organization: ${userError?.message ?? 'no row returned'}`)
        return
      }

      // Fetch org public key
      const { data: orgData, error: orgError } = await supabase
        .from('organizations')
        .select('public_key')
        .eq('id', userData.org_id)
        .single()

      console.log('[login] orgs query:', JSON.stringify({
        hasPublicKey: !!orgData?.public_key,
        orgError: orgError?.message,
        orgErrorCode: orgError?.code,
      }))

      if (orgError || !orgData?.public_key) {
        setError(`Could not retrieve organization key: ${orgError?.message ?? 'no row returned'}`)
        return
      }

      await storeOrgPublicKey(orgData.public_key)
      router.replace('/(app)')
    } catch (e: any) {
      console.log('[login] caught exception:', e?.message, e)
      setError(e.message || 'Unexpected error')
    } finally {
      setLoading(false)
    }
  }

  // Brief blank state while checking for existing session — avoids login flash
  if (checkingSession) {
    return <SafeAreaView style={styles.container} />
  }

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>GetRefuge</Text>
      <Text style={styles.subtitle}>Secure Humanitarian Data</Text>

      <View style={styles.form}>
        <Text style={styles.label}>Email</Text>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={updateEmail}
          placeholder="you@example.com"
          autoCapitalize="none"
          keyboardType="email-address"
        />

        <Text style={styles.label}>Password</Text>
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={updatePassword}
          placeholder="•••••••"
          secureTextEntry
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable style={styles.button} onPress={handleLogin} disabled={loading}>
          <Text style={styles.buttonText}>{loading ? 'Signing in…' : 'Sign In'}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 24, justifyContent: 'center' },
  title: { fontSize: 32, fontWeight: '700', color: '#111', textAlign: 'center', marginBottom: 4 },
  subtitle: { fontSize: 16, color: '#666', textAlign: 'center', marginBottom: 32 },
  form: { gap: 12 },
  label: { fontSize: 14, fontWeight: '500', color: '#444', marginBottom: 4 },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 12, fontSize: 16, backgroundColor: '#fafafa' },
  error: { color: '#c00', fontSize: 14, textAlign: 'center' },
  button: { backgroundColor: '#007aff', padding: 14, borderRadius: 10, alignItems: 'center', marginTop: 8 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
})