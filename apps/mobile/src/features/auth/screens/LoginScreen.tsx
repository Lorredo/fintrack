import { View, Text, Pressable, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { loginSchema } from '../validation/login.schema';
import { useLogin } from '../hooks/useLogin';
import { Button, Input, FormError } from '@/components/ui';
import { useToast } from '@/features/toast/hooks/useToast';
import { getErrorMessage } from '@/shared/utils/apiErrors';

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('juan.delacruz@fintrack.ph');
  const [password, setPassword] = useState('');
  const [validationError, setValidationError] = useState('');

  const toast = useToast();

  const {
    loginAsync,
    loading,
    error: loginError,
  } = useLogin();

  async function handleSubmit() {
    const result = loginSchema.safeParse({ email, password });

    if (!result.success) {
      setValidationError(result.error.issues[0].message);
      return;
    }

    try {
      setValidationError('');
      await loginAsync({ email, password });
      router.replace('/');
    } catch (error) {
      // Error displayed inline via loginError state
    }
  }

  function handleBiometrics() {
    toast.info('Biometric login coming soon!');
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: '#F5F7FA' }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 40 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Branding */}
        <View style={{ alignItems: 'center', marginBottom: 40 }}>
          <View
            style={{
              width: 72,
              height: 72,
              borderRadius: 20,
              backgroundColor: '#2563EB',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 16,
              shadowColor: '#2563EB',
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 0.35,
              shadowRadius: 16,
              elevation: 8,
            }}
          >
            <MaterialCommunityIcons name="wallet" size={36} color="#fff" />
          </View>
          <Text style={{ fontSize: 28, fontWeight: '700', color: '#111827', letterSpacing: -0.5 }}>
            FinTrack
          </Text>
          <Text style={{ fontSize: 15, color: '#6B7280', marginTop: 6, textAlign: 'center' }}>
            Your smart personal finance companion
          </Text>
        </View>

        {/* Form Card */}
        <View
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: 24,
            padding: 24,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.06,
            shadowRadius: 12,
            elevation: 3,
          }}
        >
          <Text style={{ fontSize: 20, fontWeight: '700', color: '#111827', marginBottom: 20 }}>
            Welcome back
          </Text>

          <Input
            label="Email Address"
            value={email}
            onChangeText={setEmail}
            placeholder="Enter your email"
            autoCapitalize="none"
            keyboardType="email-address"
            autoCorrect={false}
          />

          <View>
            <Input
              label="Password"
              value={password}
              onChangeText={setPassword}
              placeholder="Enter your password"
              secureTextEntry
            />
            <Pressable
              style={{ alignSelf: 'flex-end', marginTop: -10, marginBottom: 16 }}
              onPress={() => router.push('/forgot-password')}
            >
              <Text style={{ fontSize: 13, fontWeight: '600', color: '#2563EB' }}>
                Forgot Password?
              </Text>
            </Pressable>
          </View>

          {Boolean(validationError) && <FormError message={validationError} />}
          {loginError && !validationError && (
            <FormError message={getErrorMessage(loginError)} />
          )}

          <Button
            title="Log In"
            onPress={handleSubmit}
            loading={loading}
          />

          {/* Divider */}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 20 }}>
            <View style={{ flex: 1, height: 1, backgroundColor: '#EDF0F5' }} />
            <Text style={{ marginHorizontal: 12, color: '#9CA3AF', fontSize: 13 }}>or</Text>
            <View style={{ flex: 1, height: 1, backgroundColor: '#EDF0F5' }} />
          </View>

          {/* Biometrics */}
          <Pressable
            onPress={handleBiometrics}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: 2,
              borderColor: '#EDF0F5',
              borderRadius: 14,
              paddingVertical: 14,
              gap: 10,
            }}
          >
            <MaterialCommunityIcons name="fingerprint" size={22} color="#6B7280" />
            <Text style={{ fontSize: 15, fontWeight: '600', color: '#6B7280' }}>
              Log In with Biometrics
            </Text>
          </Pressable>
        </View>

        {/* Register link */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 28 }}>
          <Text style={{ fontSize: 15, color: '#6B7280' }}>
            {`Don't have an account? `}
          </Text>
          <Pressable onPress={() => router.push('/register')}>
            <Text style={{ fontSize: 15, fontWeight: '700', color: '#2563EB' }}>Register</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}