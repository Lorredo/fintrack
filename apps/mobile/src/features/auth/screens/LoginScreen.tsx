import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, Image, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PinDots } from '../components/PinDots';
import { PinKeypad } from '../components/PinKeypad';
import { SocialAuthButtons } from '../components/SocialAuthButtons';
import LoginForm from '../components/LoginForm';
import { PinService } from '../services/pin.service';
import { AuthService } from '../services/auth.service';
import { useAuthStore } from '../store/auth.store';
import { useLockStore } from '../store/lock.store';
import { storage, StorageKeys } from '@/lib/storage';
import { useToast } from '@/features/toast/hooks/useToast';
import { getErrorMessage } from '@/shared/utils/apiErrors';

export default function LoginScreen() {
  const router = useRouter();
  const toast = useToast();
  const user = useAuthStore((state) => state.user);
  const unlock = useLockStore((state) => state.unlock);

  const [pin, setPin] = useState('');
  const [hasError, setHasError] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [email] = useState(() => AuthService.getRememberedEmail() || '');
  const [firstName] = useState(() => AuthService.getSavedFirstName());
  // PIN login needs to know which account it's unlocking, so without a
  // remembered email or an active session fall back to email & password.
  const [mode, setMode] = useState<'pin' | 'password'>(() =>
    email || storage.get(StorageKeys.ACCESS_TOKEN) ? 'pin' : 'password',
  );

  const handleUnlockSuccess = useCallback(() => {
    unlock();
    router.replace('/');
  }, [unlock, router]);

  // Handle keypad digit press
  const handleDigitPress = async (digit: string) => {
    if (isVerifying || pin.length >= 4) return;
    setHasError(false);

    const nextPin = pin + digit;
    setPin(nextPin);

    if (nextPin.length === 4) {
      setIsVerifying(true);

      const hasLocalHash = !!storage.get(StorageKeys.PIN_HASH);
      const hasSession = !!storage.get(StorageKeys.ACCESS_TOKEN);

      // 1. If device has a local PIN hash AND an active session, verify instantly offline (0ms)
      if (hasSession && hasLocalHash) {
        const isMatch = await PinService.verifyPin(nextPin);
        if (isMatch) {
          unlock();
          toast.success('Welcome back!');
          router.replace('/');
          return;
        } else {
          setHasError(true);
          toast.error('Incorrect PIN');
          setTimeout(() => {
            setPin('');
            setHasError(false);
            setIsVerifying(false);
          }, 600);
          return;
        }
      }

      // 2. If device has an active authenticated session but no PIN saved yet, save this as their PIN!
      if (hasSession && !hasLocalHash) {
        await PinService.setPin(nextPin);
        unlock();
        toast.success('Security PIN configured successfully!');
        router.replace('/');
        return;
      }

      // 3. If logged out or local hash missing, authenticate via pin-login
      try {
        await AuthService.pinLogin(nextPin, email);
        unlock();
        toast.success('Welcome back!');
        router.replace('/');
      } catch (err: unknown) {
        setHasError(true);
        const errMsg = getErrorMessage(err);
        toast.error(errMsg || 'Incorrect PIN');
        setTimeout(() => {
          setPin('');
          setHasError(false);
          setIsVerifying(false);
        }, 600);
      }
    }
  };

  const handleDeletePress = () => {
    if (isVerifying) return;
    setHasError(false);
    setPin((prev) => prev.slice(0, -1));
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <View style={styles.contentContainer}>
          {/* Brand / Welcome Header */}
          <View style={styles.header}>
            {user?.avatarUrl ? (
              <Image
                source={{ uri: user.avatarUrl }}
                style={{
                  width: 54,
                  height: 54,
                  borderRadius: 27,
                  marginBottom: 8,
                  backgroundColor: '#E2E8F0',
                }}
              />
            ) : (
              <Image
                source={require('../../../../assets/logo.jpg')}
                style={styles.logo}
              />
            )}
            <Text style={styles.welcomeTitle}>
              {firstName
                ? `Welcome back, ${firstName}!`
                : email
                  ? 'Welcome back!'
                  : mode === 'password'
                    ? 'Welcome to FinTrack'
                    : 'FinTrack Security PIN'}
            </Text>
            <Text style={styles.welcomeSubtitle}>
              {mode === 'password'
                ? 'Sign in with your email and password'
                : 'Enter your 4-digit PIN to unlock'}
            </Text>
          </View>

          {mode === 'password' ? (
            <View style={styles.formWrapper}>
              <LoginForm onSuccess={handleUnlockSuccess} />
              <View style={styles.linkRow}>
                <Text style={styles.linkHint}>{"Don't have an account? "}</Text>
                <Pressable onPress={() => router.push('/register')}>
                  <Text style={styles.linkText}>Register</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <>
              {/* PIN Dots Display */}
              <View style={styles.dotsWrapper}>
                <PinDots enteredLength={pin.length} hasError={hasError} />
              </View>

              {/* PIN Keypad */}
              <View style={styles.keypadWrapper}>
                <PinKeypad
                  onDigitPress={handleDigitPress}
                  onDeletePress={handleDeletePress}
                  disabled={isVerifying}
                />
              </View>

              <Pressable onPress={() => setMode('password')} disabled={isVerifying}>
                <Text style={styles.linkText}>Use email & password instead</Text>
              </Pressable>
            </>
          )}

          {/* Divider */}
          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or continue with</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Google / Apple Sign-In Action Buttons */}
          <View style={styles.socialWrapper}>
            <SocialAuthButtons
              onSuccess={handleUnlockSuccess}
              disabled={isVerifying}
            />
          </View>

          {/* Footer Disclaimer */}
          <Text style={styles.termsFooter}>
            {"By signing in, you agree to FinTrack's Terms & Privacy Policy"}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  contentContainer: {
    flex: 1,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  header: {
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 4,
  },
  logo: {
    width: 48,
    height: 48,
    borderRadius: 14,
    marginBottom: 8,
  },
  welcomeTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0F172A',
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  welcomeSubtitle: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 3,
    textAlign: 'center',
  },
  formWrapper: {
    width: '100%',
    maxWidth: 360,
  },
  linkRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 4,
  },
  linkHint: {
    fontSize: 13,
    color: '#64748B',
  },
  linkText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2563EB',
  },
  dotsWrapper: {
    alignItems: 'center',
    marginVertical: 4,
  },
  keypadWrapper: {
    width: '100%',
    alignItems: 'center',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    maxWidth: 320,
    marginVertical: 8,
    paddingHorizontal: 4,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E2E8F0',
  },
  dividerText: {
    fontSize: 12,
    color: '#94A3B8',
    marginHorizontal: 12,
    fontWeight: '500',
  },
  socialWrapper: {
    width: '100%',
    maxWidth: 320,
    alignItems: 'center',
  },
  termsFooter: {
    fontSize: 11,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 10,
    paddingHorizontal: 20,
  },
});