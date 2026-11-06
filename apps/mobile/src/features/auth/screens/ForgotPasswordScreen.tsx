import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { Button, Input, PasswordField } from '@/components/ui';
import { useToast } from '@/features/toast/hooks/useToast';
import { getErrorMessage } from '@/shared/utils/apiErrors';
import { GoogleButton, isGoogleConfigured } from '../components/SocialAuthButtons';
import { AuthService } from '../services/auth.service';

type Step = 'choose' | 'code' | 'google';

const MIN_PASSWORD_LENGTH = 8;

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const toast = useToast();

  const [step, setStep] = useState<Step>('choose');
  const [email, setEmail] = useState(() => AuthService.getRememberedEmail() ?? '');
  const [code, setCode] = useState('');
  const [idToken, setIdToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);

  const validatePassword = () => {
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
      return false;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return false;
    }
    setError(undefined);
    return true;
  };

  const handleRecoverWithCode = async () => {
    if (!email.includes('@') || !code.trim()) {
      setError('Enter your email and recovery code');
      return;
    }
    if (!validatePassword()) return;

    setLoading(true);
    try {
      const { recoveryCode } = await AuthService.recover({
        email: email.trim(),
        code: code.trim(),
        newPassword,
      });
      toast.success('Password updated');
      router.replace({ pathname: '/recovery-code', params: { code: recoveryCode, next: '/login' } });
    } catch (err: unknown) {
      toast.error(getErrorMessage(err) || "Couldn't reset your password");
    } finally {
      setLoading(false);
    }
  };

  const handleRecoverWithGoogle = async () => {
    if (!validatePassword()) return;

    setLoading(true);
    try {
      await AuthService.recoverWithGoogle({ idToken, newPassword });
      toast.success('Password updated. Please sign in.');
      router.replace('/login');
    } catch (err: unknown) {
      toast.error(getErrorMessage(err) || "Couldn't reset your password");
    } finally {
      setLoading(false);
    }
  };

  const passwordFields = (
    <>
      <PasswordField label="New Password" value={newPassword} onChangeText={setNewPassword} />
      <PasswordField label="Confirm New Password" value={confirmPassword} onChangeText={setConfirmPassword} />
      {error && <Text style={{ fontSize: 13, color: '#DC2626' }}>{error}</Text>}
    </>
  );

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: '#F5F7FA' }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 48, gap: 16 }}
        keyboardShouldPersistTaps="handled"
      >
        <Pressable
          onPress={() => (step === 'choose' ? router.back() : setStep('choose'))}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={8}
          style={{ alignSelf: 'flex-start' }}
        >
          <MaterialCommunityIcons name="arrow-left" size={24} color="#111827" />
        </Pressable>

        <Text style={{ fontSize: 26, fontWeight: '700', color: '#111827' }}>Reset your password</Text>

        {step === 'choose' && (
          <>
            <Text style={{ fontSize: 15, lineHeight: 22, color: '#4B5563' }}>
              {"Choose how to confirm it's you."}
            </Text>
            {isGoogleConfigured && (
              <GoogleButton
                label="Continue with Google"
                disabled={false}
                onIdToken={(token) => {
                  setIdToken(token);
                  setStep('google');
                }}
                onError={(message) => toast.error(message)}
              />
            )}
            <Button title="Use recovery code" variant="outline" onPress={() => setStep('code')} />
            <Text style={{ fontSize: 13, lineHeight: 19, color: '#6B7280' }}>
              Google works when your FinTrack email is the same as your Google account.
            </Text>
          </>
        )}

        {step === 'code' && (
          <>
            <Input
              label="Email"
              placeholder="you@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              value={email}
              onChangeText={setEmail}
            />
            <Input
              label="Recovery Code"
              placeholder="XXXX-XXXX-XXXX-XXXX"
              autoCapitalize="characters"
              autoCorrect={false}
              value={code}
              onChangeText={setCode}
            />
            {passwordFields}
            <Button title="Reset Password" onPress={handleRecoverWithCode} loading={loading} />
          </>
        )}

        {step === 'google' && (
          <>
            <Text style={{ fontSize: 15, lineHeight: 22, color: '#4B5563' }}>
              Google confirmed your account. Choose a new password.
            </Text>
            {passwordFields}
            <Button title="Reset Password" onPress={handleRecoverWithGoogle} loading={loading} />
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
