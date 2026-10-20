import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { PinDots } from '../components/PinDots';
import { PinKeypad } from '../components/PinKeypad';
import { PinService } from '../services/pin.service';
import { BiometricsService, type BiometricAuthType } from '../services/biometrics.service';
import { AuthService } from '../services/auth.service';
import { useAuthStore } from '../store/auth.store';
import { useLockStore } from '../store/lock.store';
import { useToast } from '@/features/toast/hooks/useToast';

export default function PinLockScreen() {
  const router = useRouter();
  const toast = useToast();
  const user = useAuthStore((state) => state.user);
  const unlock = useLockStore((state) => state.unlock);

  const [pin, setPin] = useState('');
  const [hasError, setHasError] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricType, setBiometricType] = useState<BiometricAuthType>('none');
  const [isVerifying, setIsVerifying] = useState(false);

  const handleUnlockSuccess = useCallback(() => {
    unlock();
    router.replace('/');
  }, [unlock, router]);

  const triggerBiometrics = useCallback(async () => {
    if (!BiometricsService.isEnabledInSettings()) return;

    const available = await BiometricsService.isAvailable();
    if (!available) return;

    const success = await BiometricsService.authenticate('Unlock FinTrack');
    if (success) {
      handleUnlockSuccess();
    }
  }, [handleUnlockSuccess]);

  useEffect(() => {
    async function initBiometrics() {
      const avail = await BiometricsService.isAvailable();
      setBiometricAvailable(avail && BiometricsService.isEnabledInSettings());
      if (avail) {
        const type = await BiometricsService.getBiometricType();
        setBiometricType(type);
        // Prompt biometrics on screen mount if enabled
        if (BiometricsService.isEnabledInSettings()) {
          setTimeout(() => {
            triggerBiometrics();
          }, 300);
        }
      }
    }
    initBiometrics();
  }, [triggerBiometrics]);

  const handleDigitPress = async (digit: string) => {
    if (isVerifying || pin.length >= 4) return;
    setHasError(false);

    const nextPin = pin + digit;
    setPin(nextPin);

    if (nextPin.length === 4) {
      setIsVerifying(true);
      const isValid = await PinService.verifyPin(nextPin);

      if (isValid) {
        handleUnlockSuccess();
      } else {
        setHasError(true);
        toast.error('Incorrect PIN');
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

  const handleLogout = () => {
    Alert.alert(
      'Log Out',
      'Are you sure you want to log out? You will need to log in again with your account.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log Out',
          style: 'destructive',
          onPress: async () => {
            unlock();
            await AuthService.logout(true);
            router.replace('/login');
          },
        },
      ],
    );
  };

  const userName = user?.firstName ? `${user.firstName}` : 'there';

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.iconCircle}>
          <MaterialCommunityIcons name="lock-outline" size={36} color="#2563EB" />
        </View>
        <Text style={styles.title}>Welcome back, {userName}</Text>
        <Text style={styles.subtitle}>Enter your 4-digit PIN to unlock</Text>
      </View>

      <View style={styles.dotsSection}>
        <PinDots enteredLength={pin.length} hasError={hasError} />
      </View>

      <View style={styles.keypadSection}>
        <PinKeypad
          onDigitPress={handleDigitPress}
          onDeletePress={handleDeletePress}
          onBiometricPress={triggerBiometrics}
          showBiometrics={biometricAvailable}
          biometricType={biometricType}
          disabled={isVerifying}
        />
      </View>

      <View style={styles.footer}>
        <Pressable onPress={handleLogout} disabled={isVerifying}>
          <Text style={styles.logoutText}>Forgot PIN? Log Out</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FA',
    justifyContent: 'space-between',
    paddingVertical: 24,
  },
  header: {
    alignItems: 'center',
    paddingHorizontal: 24,
    marginTop: 20,
  },
  iconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 8,
  },
  dotsSection: {
    alignItems: 'center',
  },
  keypadSection: {
    paddingHorizontal: 16,
  },
  footer: {
    alignItems: 'center',
    paddingBottom: 8,
  },
  logoutText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#EF4444',
    padding: 8,
  },
});
