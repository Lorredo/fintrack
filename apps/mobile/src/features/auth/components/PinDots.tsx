import React, { useEffect, useState } from 'react';
import { View, Animated, StyleSheet } from 'react-native';

interface PinDotsProps {
  length?: number;
  enteredLength: number;
  hasError?: boolean;
}

export const PinDots: React.FC<PinDotsProps> = ({
  length = 4,
  enteredLength,
  hasError = false,
}) => {
  const [shakeAnim] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (hasError) {
      Animated.sequence([
        Animated.timing(shakeAnim, { toValue: -12, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 12, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: -5, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
      ]).start();
    }
  }, [hasError, shakeAnim]);

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [{ translateX: shakeAnim }],
        },
      ]}
    >
      {Array.from({ length }).map((_, index) => {
        const isFilled = index < enteredLength;
        return (
          <View
            key={index}
            style={[
              styles.dot,
              isFilled && styles.dotFilled,
              hasError && isFilled && styles.dotError,
            ]}
          />
        );
      })}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
    marginVertical: 14,
  },
  dot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    backgroundColor: '#F8FAFC',
  },
  dotFilled: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
    transform: [{ scale: 1.15 }],
  },
  dotError: {
    backgroundColor: '#EF4444',
    borderColor: '#EF4444',
  },
});
