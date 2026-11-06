import { useEffect, useState } from 'react';
import { BackHandler, Pressable, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { Button, Screen } from '@/components/ui';
import { useToast } from '@/features/toast/hooks/useToast';

export default function RecoveryCodeScreen() {
  const router = useRouter();
  const toast = useToast();
  const { code, next } = useLocalSearchParams<{ code: string; next?: string }>();
  const [saved, setSaved] = useState(false);

  // This is the only time the code is shown, so back can't skip past it.
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => subscription.remove();
  }, []);

  const handleCopy = async () => {
    await Clipboard.setStringAsync(code);
    toast.success('Recovery code copied');
  };

  const handleContinue = () => {
    if (next) {
      router.replace(next as Href);
    } else {
      router.back();
    }
  };

  return (
    <Screen scrollable>
      <View style={{ paddingTop: 24, gap: 16 }}>
        <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center' }}>
          <MaterialCommunityIcons name="shield-key-outline" size={28} color="#2563EB" />
        </View>
        <Text style={{ fontSize: 24, fontWeight: '700', color: '#111827' }}>Save your recovery code</Text>
        <Text style={{ fontSize: 15, lineHeight: 22, color: '#4B5563' }}>
          If you forget your password, this code lets you reset it. We can only show it now, and nobody at
          FinTrack can recover it for you.
        </Text>

        <View style={{ backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: '#E5E7EB', padding: 20, alignItems: 'center' }}>
          <Text selectable style={{ fontSize: 19, fontWeight: '700', color: '#111827', letterSpacing: 1 }}>
            {code}
          </Text>
        </View>
        <Button title="Copy code" variant="outline" onPress={handleCopy} />

        <Text style={{ fontSize: 13, lineHeight: 19, color: '#6B7280' }}>
          Keep it somewhere safe outside this app, such as a password manager.
        </Text>

        <Pressable
          onPress={() => setSaved((value) => !value)}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: saved }}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 }}
        >
          <MaterialCommunityIcons
            name={saved ? 'checkbox-marked' : 'checkbox-blank-outline'}
            size={24}
            color={saved ? '#2563EB' : '#9CA3AF'}
          />
          <Text style={{ flex: 1, fontSize: 15, color: '#111827' }}>I saved my recovery code</Text>
        </Pressable>

        <Button title="Continue" onPress={handleContinue} disabled={!saved} />
      </View>
    </Screen>
  );
}
