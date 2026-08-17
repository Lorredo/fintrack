import { View, Text, Pressable, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { useState } from 'react';
import { useRouter } from 'expo-router';

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
          <Text className="text-3xl font-bold text-text">Create Account</Text>
          <Text className="text-base text-text-secondary mt-sm text-center">
            Start managing your budget smartly
          </Text>
        </View>

        {/* Form */}
        <View className="gap-md">
          <View className="flex-row gap-sm">
            <View className="flex-1">
              <Input
                label="First Name"
                value={firstName}
                onChangeText={setFirstName}
                placeholder="Juan"
                autoCapitalize="words"
              />
            </View>
            <View className="flex-1">
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

          <Button
            title="Create Account"
            onPress={handleSubmit}
            loading={loading}
          />
        </View>

        {/* Login link */}
        <View className="flex-row items-center justify-center mt-xl">
          <Text className="text-base text-text-secondary">
            {`Already have an account? `}
          </Text>
          <Pressable onPress={() => router.push('/login')}>
            <Text className="text-base font-bold text-primary">Log In</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}