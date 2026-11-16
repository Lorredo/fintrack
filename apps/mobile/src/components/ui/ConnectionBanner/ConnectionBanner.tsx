import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useIsFetching, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';

import { useIsOnline } from '@/shared/hooks/useIsOnline';
import { useOutbox } from '@/features/transactions/offline/outbox';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Only refreshes slower than this show "Updating…", so normal refetches don't
// flash a banner. A sleeping server takes far longer.
const SLOW_REFRESH_MS = 2500;

function formatSavedAt(timestamp: number): string {
  const date = new Date(timestamp);
  const hours = date.getHours();
  const time = `${hours % 12 || 12}:${String(date.getMinutes()).padStart(2, '0')} ${hours < 12 ? 'AM' : 'PM'}`;
  if (date.toDateString() === new Date().toDateString()) return time;
  return `${MONTHS[date.getMonth()]} ${date.getDate()}, ${time}`;
}

export function ConnectionBanner() {
  const isOnline = useIsOnline();
  const queryClient = useQueryClient();
  const isFetching = useIsFetching() > 0;
  const [isSlow, setIsSlow] = useState(false);
  const router = useRouter();
  const pendingCount = useOutbox((state) => state.entries.filter((entry) => entry.status === 'pending').length);
  const failedCount = useOutbox((state) => state.entries.filter((entry) => entry.status === 'failed').length);

  useEffect(() => {
    if (!isFetching || !isOnline) return;
    const timer = setTimeout(() => setIsSlow(true), SLOW_REFRESH_MS);
    return () => {
      clearTimeout(timer);
      setIsSlow(false);
    };
  }, [isFetching, isOnline]);

  if (!isOnline) {
    const savedAt = Math.max(0, ...queryClient.getQueryCache().getAll().map((query) => query.state.dataUpdatedAt));
    return (
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: '#FEF3C7',
          borderRadius: 10,
          paddingVertical: 8,
          paddingHorizontal: 12,
          marginHorizontal: 20,
          marginBottom: 8,
        }}
      >
        <MaterialCommunityIcons name="cloud-off-outline" size={16} color="#92400E" />
        <Text style={{ marginLeft: 8, fontSize: 13, color: '#92400E', flexShrink: 1 }}>
          {pendingCount > 0
            ? `You're offline · ${pendingCount} ${pendingCount === 1 ? 'change' : 'changes'} waiting to sync`
            : savedAt > 0
              ? `Offline · showing data from ${formatSavedAt(savedAt)}`
              : "You're offline"}
        </Text>
      </View>
    );
  }

  if (failedCount > 0) {
    return (
      <Pressable
        onPress={() => router.push('/transactions')}
        accessibilityRole="button"
        className="active:opacity-70"
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: '#FEE2E2',
          borderRadius: 10,
          paddingVertical: 8,
          paddingHorizontal: 12,
          marginHorizontal: 20,
          marginBottom: 8,
        }}
      >
        <MaterialCommunityIcons name="alert-circle-outline" size={16} color="#B91C1C" />
        <Text style={{ marginLeft: 8, fontSize: 13, color: '#B91C1C', flex: 1 }}>
          {failedCount} {failedCount === 1 ? "change couldn't" : "changes couldn't"} sync · Tap to review
        </Text>
        <MaterialCommunityIcons name="chevron-right" size={16} color="#B91C1C" />
      </Pressable>
    );
  }

  if (pendingCount > 0) {
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingBottom: 6 }}>
        <MaterialCommunityIcons name="cloud-upload-outline" size={15} color="#6B7280" />
        <Text style={{ marginLeft: 6, fontSize: 12, color: '#6B7280' }}>
          {pendingCount} {pendingCount === 1 ? 'change' : 'changes'} waiting to sync
        </Text>
      </View>
    );
  }

  if (isSlow) {
    return (
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          paddingBottom: 6,
        }}
      >
        <ActivityIndicator size="small" color="#2563EB" />
        <Text style={{ marginLeft: 8, fontSize: 12, color: '#6B7280' }}>Updating…</Text>
      </View>
    );
  }

  return null;
}
