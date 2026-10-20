import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { PinDots } from '../components/PinDots';
import { PinKeypad } from '../components/PinKeypad';
import { PinService } from '../services/pin.service';
import { BiometricsService, type BiometricAuthType } from '../services/biometrics.service';
import { useLockStore } from '../store/lock.store';
import { useToast } from '@/features/toast/hooks/useToast';
import { storage, StorageKeys } from '@/lib/storage';

export default function PinSetupScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ mode?: string }>();
  const toast = useToast();
  const unlock = useLockStore((state) => state.unlock);

  const hasExistingPin = PinService.hasPin();
  const isChanging = params.mode === 'change' || (hasExistingPin && params.mode !== 'new');

  const [step, setStep] = useState<'current' | 'create' | 'confirm'>(
    isChanging ? 'current' : 'create'
  );
  const [currentPin, setCurrentPin] = useState('');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [hasError, setHasError] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricType, setBiometricType] = useState<BiometricAuthType>('none');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    async function checkBiometrics() {
      const avail = await BiometricsService.isAvailable();
      setBiometricAvailable(avail);
      if (avail) {
        const type = await BiometricsService.getBiometricType();
        setBiometricType(type);
      }
    }
    checkBiometrics();
  }, []);

  const handleDigitPress = async (digit: string) => {
    if (isSubmitting) return;
    setHasError(false);

    if (step === 'current') {
      if (currentPin.length < 4) {
        const nextCurrent = currentPin + digit;
        setCurrentPin(nextCurrent);
        if (nextCurrent.length === 4) {
          setIsSubmitting(true);
          const isCorrect = await PinService.verifyPin(nextCurrent);
          setIsSubmitting(false);

          if (isCorrect) {
            setTimeout(() => {
              setStep('create');
            }, 180);
          } else {
            setHasError(true);
            toast.error('Incorrect current PIN');
            setTimeout(() => {
              setCurrentPin('');
              setHasError(false);
            }, 600);
          }
        }
      }
    } else if (step === 'create') {
      if (pin.length < 4) {
        const nextPin = pin + digit;
        setPin(nextPin);
        if (nextPin.length === 4) {
          setTimeout(() => {
            setStep('confirm');
          }, 180);
        }
      }
    } else {
      if (confirmPin.length < 4) {
        const nextConfirmPin = confirmPin + digit;
        setConfirmPin(nextConfirmPin);
        if (nextConfirmPin.length === 4) {
          handleVerify(nextConfirmPin);
        }
      }
    }
  };

  const handleDeletePress = () => {
    if (isSubmitting) return;
    setHasError(false);

    if (step === 'current') {
      setCurrentPin((prev) => prev.slice(0, -1));
    } else if (step === 'create') {
      if (pin.length === 0 && isChanging) {
        setStep('current');
        setCurrentPin('');
      } else {
        setPin((prev) => prev.slice(0, -1));
      }
    } else {
      if (confirmPin.length === 0) {
        setStep('create');
        setPin('');
      } else {
        setConfirmPin((prev) => prev.slice(0, -1));
      }
    }
  };

  const handleVerify = async (enteredConfirmPin: string) => {
    if (enteredConfirmPin !== pin) {
      setHasError(true);
      toast.error('PINs do not match. Please try again.');
      setTimeout(() => {
        setConfirmPin('');
        setPin('');
        setStep('create');
        setHasError(false);
      }, 700);
      return;
    }

    setIsSubmitting(true);
    try {
      await PinService.setPin(pin);

      if (isChanging) {
        unlock();
        toast.success('Security PIN changed successfully!');
        setIsSubmitting(false);
        router.back();
        return;
      }

      if (biometricAvailable) {
        const biometricLabel = biometricType === 'face' ? 'Face ID' : 'Fingerprint';
        Alert.alert(
          `Enable ${biometricLabel}?`,
          `Would you like to use ${biometricLabel} for instant unlock in FinTrack?`,
          [
            {
              text: 'Not Now',
              style: 'cancel',
              onPress: () => finishSetup(false),
            },
            {
              text: 'Enable',
              onPress: () => finishSetup(true),
            },
          ],
          {
            cancelable: true,
            onDismiss: () => finishSetup(false),
          },
        );
      } else {
        finishSetup(false);
      }
    } catch {
      toast.error('Failed to set PIN. Please try again.');
      setIsSubmitting(false);
    }
  };

  const finishSetup = (enableBio: boolean) => {
    storage.set(StorageKeys.PIN_SETUP_DISMISSED, 'true');
    if (enableBio) {
      BiometricsService.setEnabledInSettings(true);
    }
    unlock();
    toast.success('Security PIN configured successfully!');
    setIsSubmitting(false);
    router.replace('/');
  };

  const handleSkip = () => {
    if (isChanging) {
      router.back();
      return;
    }
    storage.set(StorageKeys.PIN_SETUP_DISMISSED, 'true');
    unlock();
    router.replace('/');
  };

  const currentLength =
    step === 'current'
      ? currentPin.length
      : step === 'create'
      ? pin.length
      : confirmPin.length;

  const title =
    step === 'current'
      ? 'Enter Current PIN'
      : step === 'create'
      ? isChanging
        ? 'Enter New 4-Digit PIN'
        : 'Create a 4-Digit PIN'
      : isChanging
      ? 'Confirm New PIN'
      : 'Confirm your PIN';

  const subtitle =
    step === 'current'
      ? 'Please enter your existing 4-digit PIN to verify your identity'
      : step === 'create'
      ? isChanging
        ? 'Choose a new 4-digit security PIN'
        : 'Set a PIN for quick, secure access without having to re-enter your password'
      : 'Re-enter your new 4-digit PIN to confirm';

  return (
    <SafeAreaView style={styles.container}>
      {/* Top Header with Back button if changing PIN */}
      {isChanging && (
        <View style={styles.topBar}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <MaterialCommunityIcons name="arrow-left" size={24} color="#0F172A" />
          </Pressable>
        </View>
      )}

      <View style={styles.header}>
        <View style={styles.iconCircle}>
          <MaterialCommunityIcons
            name={step === 'current' ? 'shield-account-outline' : 'shield-lock-outline'}
            size={36}
            color="#2563EB"
          />
        </View>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>

      <View style={styles.dotsSection}>
        <PinDots enteredLength={currentLength} hasError={hasError} />
      </View>

      <View style={styles.keypadSection}>
        <PinKeypad
          onDigitPress={handleDigitPress}
          onDeletePress={handleDeletePress}
          disabled={isSubmitting}
        />
      </View>

      <View style={styles.footer}>
        <Pressable onPress={handleSkip} disabled={isSubmitting}>
          <Text style={styles.skipText}>{isChanging ? 'Cancel' : 'Set up later'}</Text>
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
    paddingVertical: 20,
  },
  topBar: {
    paddingHorizontal: 16,
    height: 40,
    justifyContent: 'center',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    paddingHorizontal: 24,
    marginTop: 8,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
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
    lineHeight: 20,
    maxWidth: 280,
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
  skipText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6B7280',
    padding: 8,
  },
});
