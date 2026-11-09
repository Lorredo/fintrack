import { useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { Button, EmptyState, FloatingAddButton, Loader, ProgressBar, Screen } from '@/components/ui';
import { formatCurrency } from '@/shared/utils/categories';
import { formatShortDate } from '@/features/bills/utils/billLabels';
import PaluwaganFormModal from '../components/PaluwaganFormModal';
import { usePaluwagans } from '../hooks/useUtang';
import type { Paluwagan } from '../types';
import { FREQUENCY_LABELS } from '../utils/labels';

function PaluwaganCard({ paluwagan, onPress }: { paluwagan: Paluwagan; onPress: () => void }) {
  const next = paluwagan.nextContribution;
  const myRound = paluwagan.rounds.find((round) => round.isMyTurn);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      className="active:opacity-70"
      style={{ backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, gap: 10, opacity: paluwagan.active ? 1 : 0.6 }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <MaterialCommunityIcons name="account-group-outline" size={22} color="#7C3AED" />
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 16, fontWeight: '700', color: '#111827' }} numberOfLines={1}>{paluwagan.name}</Text>
          <Text style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>
            {formatCurrency(paluwagan.contribution)} · {FREQUENCY_LABELS[paluwagan.frequency]} · {paluwagan.members} members
          </Text>
        </View>
        <MaterialCommunityIcons name="chevron-right" size={20} color="#9CA3AF" />
      </View>
      <View style={{ gap: 4 }}>
        <ProgressBar progress={(paluwagan.contributedCount / paluwagan.members) * 100} color="#7C3AED" />
        <Text style={{ fontSize: 12, color: '#6B7280' }}>
          {paluwagan.contributedCount} of {paluwagan.members} rounds paid · {formatCurrency(paluwagan.totalContributed)} in
        </Text>
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <View style={{ flex: 1, backgroundColor: paluwagan.overdueCount > 0 ? '#FEF2F2' : '#F9FAFB', borderRadius: 10, padding: 10 }}>
          <Text style={{ fontSize: 11, color: '#6B7280' }}>Next contribution</Text>
          <Text style={{ fontSize: 13, fontWeight: '700', color: paluwagan.overdueCount > 0 ? '#B91C1C' : '#111827', marginTop: 2 }}>
            {next ? `Round ${next.round} · ${formatShortDate(next.date)}` : 'All paid'}
          </Text>
        </View>
        <View style={{ flex: 1, backgroundColor: '#F5F3FF', borderRadius: 10, padding: 10 }}>
          <Text style={{ fontSize: 11, color: '#6B7280' }}>Your payout</Text>
          <Text style={{ fontSize: 13, fontWeight: '700', color: '#5B21B6', marginTop: 2 }}>
            {myRound?.payoutReceived ? 'Received' : `${formatShortDate(paluwagan.myPayoutDate)} · ${formatCurrency(paluwagan.payoutAmount)}`}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

export default function PaluwaganScreen() {
  const router = useRouter();
  const { data, isLoading, isError, refetch, isRefetching } = usePaluwagans();
  const [adding, setAdding] = useState(false);

  return (
    <Screen>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 8, paddingBottom: 16 }}>
        <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Go back" hitSlop={8}>
          <MaterialCommunityIcons name="arrow-left" size={24} color="#111827" />
        </Pressable>
        <Text style={{ flex: 1, fontSize: 18, fontWeight: '700', color: '#111827' }}>Paluwagan</Text>
      </View>

      {!data && isLoading ? (
        <Loader />
      ) : isError && !data ? (
        <View style={{ alignItems: 'center', paddingVertical: 32 }}>
          <Text style={{ fontSize: 15, color: '#6B7280', marginBottom: 12 }}>Failed to load paluwagan</Text>
          <Button title="Retry" onPress={() => refetch()} />
        </View>
      ) : (
        <FlatList
          data={data ?? []}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          refreshing={isRefetching}
          onRefresh={refetch}
          contentContainerStyle={{ gap: 12, paddingBottom: 110 }}
          renderItem={({ item }) => (
            <PaluwaganCard paluwagan={item} onPress={() => router.push({ pathname: '/paluwagan-details', params: { id: item.id } })} />
          )}
          ListEmptyComponent={
            <EmptyState
              title="No paluwagan yet"
              description="Track your contributions each round and when you get the pot. FinTrack sets contributions aside in Safe to Spend."
              action={<Button title="Add Paluwagan" icon="plus" onPress={() => setAdding(true)} />}
            />
          }
        />
      )}

      {data && data.length > 0 && <FloatingAddButton label="Add Paluwagan" onPress={() => setAdding(true)} />}
      <PaluwaganFormModal visible={adding} paluwagan={null} onClose={() => setAdding(false)} />
    </Screen>
  );
}
