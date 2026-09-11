import { View, Text, Pressable, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { registerSchema } from '../validation/register.schema';
import { AuthService } from '../services/auth.service';
import { Button, Input, FormError, Checkbox } from '@/components/ui';
import { useApiErrorHandler } from '@/hooks/useApiErrorHandler';
import { useToast } from '@/features/toast/hooks/useToast';

export default function RegisterScreen() {
  const router = useRouter();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [validationError, setValidationError] = useState('');
  const [loading, setLoading] = useState(false);

  const { handleError } = useApiErrorHandler();
  const toast = useToast();

  async function handleSubmit() {
    if (!agreeTerms) {
      setValidationError('Please agree to the Terms of Service & Privacy Policy');
      return;
    }

    const result = registerSchema.safeParse({
      firstName,
      lastName,
      email,
      password,
      confirmPassword,
    });

    if (!result.success) {
      setValidationError(result.error.issues[0].message);
      return;
    }

    try {
      setValidationError('');
      setLoading(true);
      await AuthService.register({
        firstName,
        lastName,
        email,
        password,
      });
      toast.success('Account created! Please log in.');
      router.replace('/login');
    } catch (error) {
      handleError(error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: '#F5F7FA' }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 40 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Branding */}
        <View style={{ alignItems: 'center', marginBottom: 32 }}>
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
            Create Account
          </Text>
          <Text style={{ fontSize: 15, color: '#6B7280', marginTop: 6, textAlign: 'center' }}>
            Start managing your budget smartly
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
          {/* Name row */}
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Input
                label="First Name"
                value={firstName}
                onChangeText={setFirstName}
                placeholder="Juan"
                autoCapitalize="words"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Input
                label="Last Name"
                value={lastName}
                onChangeText={setLastName}
                placeholder="Dela Cruz"
                autoCapitalize="words"
              />
            </View>
          </View>

          <Input
            label="Email Address"
            value={email}
            onChangeText={setEmail}
            placeholder="Enter your email"
            autoCapitalize="none"
            keyboardType="email-address"
            autoCorrect={false}
          />

          <Input
            label="Password"
            value={password}
            onChangeText={setPassword}
            placeholder="Min 8 characters"
            secureTextEntry
          />

          <Input
            label="Confirm Password"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder="Re-enter your password"
            secureTextEntry
          />

          <Checkbox
            checked={agreeTerms}
            onToggle={() => setAgreeTerms(!agreeTerms)}
            label="I agree to the Terms of Service & Privacy Policy"
          />

          {Boolean(validationError) && <FormError message={validationError} />}

          <View style={{ marginTop: 8 }}>
            <Button
              title="Create Account"
              onPress={handleSubmit}
              loading={loading}
            />
          </View>
        </View>

        {/* Login link */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 28 }}>
          <Text style={{ fontSize: 15, color: '#6B7280' }}>
            {`Already have an account? `}
          </Text>
          <Pressable onPress={() => router.push('/login')}>
            <Text style={{ fontSize: 15, fontWeight: '700', color: '#2563EB' }}>Log In</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}