import React, { useEffect, useState } from 'react';
import { Modal, View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

// After this long the server is probably cold-starting, so say so.
const SLOW_HINT_DELAY_MS = 8000;

interface AuthProgressOverlayProps {
  visible: boolean;
  message?: string;
}

export const AuthProgressOverlay: React.FC<AuthProgressOverlayProps> = ({
  visible,
  message = 'Signing you in…',
}) => {
  const [showSlowHint, setShowSlowHint] = useState(false);

  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(() => setShowSlowHint(true), SLOW_HINT_DELAY_MS);
    return () => {
      clearTimeout(timer);
      setShowSlowHint(false);
    };
  }, [visible]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      // Back can't cancel an in-flight sign-in.
      onRequestClose={() => {}}
    >
      <View style={styles.backdrop}>
        <View style={styles.card} accessibilityRole="progressbar" accessibilityLabel={message}>
          <ActivityIndicator size="large" color="#2563EB" />
          <Text style={styles.title}>{message}</Text>
          {showSlowHint && (
            <Animated.Text entering={FadeIn.duration(300)} style={styles.hint}>
              Waking up the server — this can take up to a minute.
            </Animated.Text>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  card: {
    width: '100%',
    maxWidth: 300,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingVertical: 28,
    paddingHorizontal: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 12,
  },
  title: {
    marginTop: 16,
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  hint: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 18,
    color: '#6B7280',
    textAlign: 'center',
  },
});
