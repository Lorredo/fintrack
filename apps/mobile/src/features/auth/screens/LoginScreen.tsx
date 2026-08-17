import { View, Text, Pressable, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { useState } from 'react';
import { useRouter } from 'expo-router';

import { loginSchema } from '../validation/login.schema';
import { useLogin } from '../hooks/useLogin';
import { Button, Input, FormError } from '@/components/ui';
import { useApiErrorHandler } from '@/hooks/useApiErrorHandler';
import { useToast } from '@/features/toast/hooks/useToast';

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('juan.delacruz@fintrack.ph');
  const [password, setPassword] = useState('');
  const [validationError, setValidationError] = useState('');

  const { handleError } = useApiErrorHandler();
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
      handleError(error);
    }
  }

  function handleBiometrics() {
    toast.info('Biometric login coming soon!');
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-background"
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        className="flex-1"
        contentContainerClassName="flex-grow justify-center px-lg py-xl"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View className="items-center mb-xl">
          <View className="w-20 h-20 rounded-2xl bg-primary items-center justify-center mb-md shadow-lg">
            <Text className="text-4xl font-bold text-white">F</Text>
          </View>
          <Text className="text-3xl font-bold text-text">FinTrack</Text>
          <Text className="text-base text-text-secondary mt-sm text-center">
            Your smart personal finance companion
          </Text>
        </View>

        {/* Form */}
        <View className="gap-md">
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
              className="self-end -mt-sm"
              onPress={() => router.push('/forgot-password')}
            >
              <Text className="text-sm font-semibold text-primary">
                Forgot Password?
              </Text>
            </Pressable>
          </View>

          {Boolean(validationError) && <FormError message={validationError} />}
          {loginError && !validationError && (
            <FormError message={loginError?.message} />
          )}

          <Button
            title="Log In"
            onPress={handleSubmit}
            loading={loading}
          />

          <Button
            title="Log In with Biometrics"
            variant="outline"
            onPress={handleBiometrics}
          />
        </View>

        {/* Register link */}
        <View className="flex-row items-center justify-center mt-xl">
          <Text className="text-base text-text-secondary">
            {`Don't have an account? `}
          </Text>
          <Pressable onPress={() => router.push('/register')}>
            <Text className="text-base font-bold text-primary">Register</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}