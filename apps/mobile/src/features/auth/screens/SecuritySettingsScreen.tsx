import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, Switch, Alert, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { PinService } from '../services/pin.service';
import { BiometricsService, type BiometricAuthType } from '../services/biometrics.service';
import { storage, StorageKeys } from '@/lib/storage';
import { useToast } from '@/features/toast/hooks/useToast';

export default function SecuritySettingsScreen() {
  const router = useRouter();
  const toast = useToast();

  const [hasPin, setHasPin] = useState(() => PinService.hasPin());
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricType, setBiometricType] = useState<BiometricAuthType>('none');
  const [biometricEnabled, setBiometricEnabled] = useState(() => BiometricsService.isEnabledInSettings());
  const [autoLockTimeout, setAutoLockTimeout] = useState(() => {
    return storage.get(StorageKeys.AUTO_LOCK_TIMEOUT) || '30s';
  });

  useEffect(() => {
    async function init() {
      const avail = await BiometricsService.isAvailable();
      setBiometricAvailable(avail);
      if (avail) {
        const type = await BiometricsService.getBiometricType();
        setBiometricType(type);
      }
      setHasPin(PinService.hasPin());
    }
    init();
  }, []);

  const handleToggleBiometrics = async (value: boolean) => {
    if (value) {
      if (!hasPin) {
        Alert.alert(
          'PIN Required',
          'Please set up a 4-digit security PIN before enabling biometric unlock.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Set Up PIN', onPress: () => router.push('/pin-setup') },
          ]
        );
        return;
      }

      const verified = await BiometricsService.authenticate('Confirm to enable biometric unlock');
      if (verified) {
        BiometricsService.setEnabledInSettings(true);
        setBiometricEnabled(true);
        toast.success(`${biometricType === 'face' ? 'Face ID' : 'Fingerprint'} unlock enabled!`);
      } else {
        setBiometricEnabled(false);
      }
    } else {
      BiometricsService.setEnabledInSettings(false);
      setBiometricEnabled(false);
      toast.info('Biometric unlock disabled');
    }
  };

  const handleSelectTimeout = (timeout: string) => {
    setAutoLockTimeout(timeout);
    storage.set(StorageKeys.AUTO_LOCK_TIMEOUT, timeout);
    toast.success('Auto-lock timeout updated');
  };

  const biometricName = biometricType === 'face' ? 'Face ID' : 'Fingerprint';
  const biometricIcon = biometricType === 'face' ? 'face-recognition' : 'fingerprint';

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Top Header */}
      <View style={styles.topHeader}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <MaterialCommunityIcons name="arrow-left" size={24} color="#0F172A" />
        </Pressable>
        <Text style={styles.headerTitle}>Security & PIN</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Section 1: 4-Digit Security PIN */}
        <Text style={styles.sectionHeader}>APP PASSCODE</Text>
        <View style={styles.card}>
          <View style={styles.cardRow}>
            <View style={[styles.iconBox, { backgroundColor: '#EEF2FF' }]}>
              <MaterialCommunityIcons name="shield-key-outline" size={24} color="#4F46E5" />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.cardTitle}>4-Digit Security PIN</Text>
              <Text style={styles.cardSubtitle}>
                {hasPin
                  ? 'Configured • Protects your app and transactions'
                  : 'Not set up • Fast unlock without passwords'}
              </Text>
            </View>
            {hasPin && (
              <View style={styles.badgeActive}>
                <MaterialCommunityIcons name="check-circle" size={14} color="#16A34A" />
                <Text style={styles.badgeText}>Active</Text>
              </View>
            )}
          </View>

          <View style={styles.divider} />

          {hasPin ? (
            <Pressable
              style={({ pressed }) => [styles.actionButton, pressed && { opacity: 0.7 }]}
              onPress={() => router.push({ pathname: '/pin-setup', params: { mode: 'change' } })}
            >
              <MaterialCommunityIcons name="lock-reset" size={18} color="#2563EB" />
              <Text style={styles.actionButtonText}>Change Security PIN</Text>
              <MaterialCommunityIcons name="chevron-right" size={20} color="#94A3B8" style={{ marginLeft: 'auto' }} />
            </Pressable>
          ) : (
            <Pressable
              style={({ pressed }) => [styles.primaryButton, pressed && { opacity: 0.8 }]}
              onPress={() => router.push('/pin-setup')}
            >
              <Text style={styles.primaryButtonText}>Set Up 4-Digit PIN</Text>
            </Pressable>
          )}
        </View>

        {/* Section 2: Biometrics */}
        <Text style={styles.sectionHeader}>BIOMETRIC UNLOCK</Text>
        <View style={styles.card}>
          <View style={styles.cardRow}>
            <View style={[styles.iconBox, { backgroundColor: '#F0FDF4' }]}>
              <MaterialCommunityIcons name={biometricIcon} size={24} color="#16A34A" />
            </View>
            <View style={{ flex: 1, marginLeft: 12, marginRight: 8 }}>
              <Text style={styles.cardTitle}>{biometricName}</Text>
              <Text style={styles.cardSubtitle}>
                {biometricAvailable
                  ? `Unlock instantly using ${biometricName}`
                  : 'Biometric hardware not available on this device'}
              </Text>
            </View>
            {biometricAvailable && (
              <Switch
                value={biometricEnabled}
                onValueChange={handleToggleBiometrics}
                trackColor={{ false: '#CBD5E1', true: '#93C5FD' }}
                thumbColor={biometricEnabled ? '#2563EB' : '#F8FAFC'}
              />
            )}
          </View>
        </View>

        {/* Section 3: Auto-Lock Timing */}
        <Text style={styles.sectionHeader}>AUTO-LOCK TIMEOUT</Text>
        <View style={styles.card}>
          <Text style={[styles.cardSubtitle, { marginBottom: 12 }]}>
            FinTrack will require PIN unlock when returning from background:
          </Text>

          {[
            { label: 'Immediately', value: '0s' },
            { label: 'After 30 seconds', value: '30s' },
            { label: 'After 1 minute', value: '1m' },
            { label: 'After 5 minutes', value: '5m' },
          ].map((item, idx, arr) => {
            const isSelected = autoLockTimeout === item.value;
            return (
              <React.Fragment key={item.value}>
                <Pressable
                  style={styles.timeoutRow}
                  onPress={() => handleSelectTimeout(item.value)}
                >
                  <Text style={[styles.timeoutLabel, isSelected && { color: '#2563EB', fontWeight: '600' }]}>
                    {item.label}
                  </Text>
                  {isSelected && (
                    <MaterialCommunityIcons name="check" size={20} color="#2563EB" />
                  )}
                </Pressable>
                {idx < arr.length - 1 && <View style={styles.subDivider} />}
              </React.Fragment>
            );
          })}
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
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
  },
  content: {
    padding: 20,
  },
  sectionHeader: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
    marginBottom: 8,
    marginTop: 16,
    letterSpacing: 0.5,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0F172A',
  },
  cardSubtitle: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
    lineHeight: 18,
  },
  badgeActive: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#16A34A',
  },
  divider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 14,
  },
  subDivider: {
    height: 1,
    backgroundColor: '#F8FAFC',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    gap: 8,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2563EB',
  },
  primaryButton: {
    backgroundColor: '#2563EB',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  timeoutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  timeoutLabel: {
    fontSize: 14,
    color: '#334155',
  },
});
