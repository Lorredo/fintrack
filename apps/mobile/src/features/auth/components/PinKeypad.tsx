import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import type { BiometricAuthType } from '../services/biometrics.service';

interface PinKeypadProps {
  onDigitPress: (digit: string) => void;
  onDeletePress: () => void;
  onBiometricPress?: () => void;
  showBiometrics?: boolean;
  biometricType?: BiometricAuthType;
  disabled?: boolean;
}

export const PinKeypad: React.FC<PinKeypadProps> = ({
  onDigitPress,
  onDeletePress,
  onBiometricPress,
  showBiometrics = false,
  biometricType = 'fingerprint',
  disabled = false,
}) => {
  const triggerHaptic = () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {
      // Ignore if haptics unavailable
    }
  };

  const handleDigit = (digit: string) => {
    if (disabled) return;
    triggerHaptic();
    onDigitPress(digit);
  };

  const handleDelete = () => {
    if (disabled) return;
    triggerHaptic();
    onDeletePress();
  };

  const handleBiometric = () => {
    if (disabled || !onBiometricPress) return;
    triggerHaptic();
    onBiometricPress();
  };

  const renderBiometricIcon = () => {
    const iconName = biometricType === 'face' ? 'face-recognition' : 'fingerprint';
    return <MaterialCommunityIcons name={iconName} size={32} color="#2563EB" />;
  };

  const keypadRows = [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
  ];

  return (
    <View style={styles.container}>
      {keypadRows.map((row, rowIndex) => (
        <View key={rowIndex} style={styles.row}>
          {row.map((digit) => (
            <Pressable
              key={digit}
              style={({ pressed }) => [
                styles.keyButton,
                pressed && styles.keyButtonPressed,
              ]}
              onPress={() => handleDigit(digit)}
              disabled={disabled}
            >
              <Text style={styles.digitText}>{digit}</Text>
            </Pressable>
          ))}
        </View>
      ))}

      {/* Bottom Row: Biometrics / Empty, 0, Backspace */}
      <View style={styles.row}>
        {showBiometrics && onBiometricPress ? (
          <Pressable
            style={({ pressed }) => [
              styles.keyButton,
              styles.auxButton,
              pressed && styles.keyButtonPressed,
            ]}
            onPress={handleBiometric}
            disabled={disabled}
          >
            {renderBiometricIcon()}
          </Pressable>
        ) : (
          <View style={[styles.keyButton, styles.emptySlot]} />
        )}

        <Pressable
          style={({ pressed }) => [
            styles.keyButton,
            pressed && styles.keyButtonPressed,
          ]}
          onPress={() => handleDigit('0')}
          disabled={disabled}
        >
          <Text style={styles.digitText}>0</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            styles.keyButton,
            styles.auxButton,
            pressed && styles.keyButtonPressed,
          ]}
          onPress={handleDelete}
          disabled={disabled}
        >
          <MaterialCommunityIcons name="backspace-outline" size={26} color="#4B5563" />
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    maxWidth: 290,
    alignSelf: 'center',
    gap: 12,
    paddingHorizontal: 4,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  keyButton: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F1F5F9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 5,
    elevation: 2,
  },
  keyButtonPressed: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
    transform: [{ scale: 0.94 }],
  },
  digitText: {
    fontSize: 26,
    fontWeight: '600',
    color: '#0F172A',
  },
  auxButton: {
    backgroundColor: 'transparent',
    borderWidth: 0,
    shadowOpacity: 0,
    elevation: 0,
  },
  emptySlot: {
    backgroundColor: 'transparent',
    borderWidth: 0,
    shadowOpacity: 0,
    elevation: 0,
  },
});
