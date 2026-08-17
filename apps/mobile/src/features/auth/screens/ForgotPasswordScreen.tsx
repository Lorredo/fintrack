import { View, Text, Pressable, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { useState } from 'react';
import { useRouter } from 'expo-router';

import { Button, Input } from '@/components/ui';
import { useToast } from '@/features/toast/hooks/useToast';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('juan.delacruz@fintrack.ph');
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  function handleSendResetLink() {
    if (!email || !email.includes('@')) {
      toast.error('Please enter a valid email address');
      return;
    }

    setLoading(true);
    // Mocked for now - will integrate with API later
    setTimeout(() => {
      setLoading(false);
      toast.success('Password reset link sent to your email!');
    }, 1000);
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
          <Text className="text-3xl font-bold text-text">Forgot Password?</Text>
          <Text className="text-base text-text-secondary mt-sm text-center px-lg">
            {`Enter your email address and we'll send you a link to reset your password`}
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

          <Button
            title="Send Reset Link"
            onPress={handleSendResetLink}
            loading={loading}
          />
        </View>

        {/* Back to login */}
        <View className="flex-row items-center justify-center mt-xl">
          <Text className="text-base text-text-secondary">
            {`Remember your password? `}
          </Text>
          <Pressable onPress={() => router.push('/login')}>
            <Text className="text-base font-bold text-primary">Log In</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}