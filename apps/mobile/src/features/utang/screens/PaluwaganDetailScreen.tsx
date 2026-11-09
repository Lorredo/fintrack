import { useState } from 'react';
import { Alert, FlatList, Pressable, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { Button, DateField, Loader, Modal, Screen } from '@/components/ui';
import { useAccounts } from '@/features/accounts/hooks/useAccounts';
import { ChoicePills } from '@/features/bills/components/ChoicePills';
import { formatShortDate } from '@/features/bills/utils/billLabels';
import { useToast } from '@/features/toast/hooks/useToast';
import { getErrorMessage } from '@/shared/utils/apiErrors';
import { formatCurrency, getLocalISODate } from '@/shared/utils/categories';
import PaluwaganFormModal from '../components/PaluwaganFormModal';
import { useContribute, useDeletePaluwagan, usePaluwagans, useReceivePayout, useUpdatePaluwagan } from '../hooks/useUtang';
import type { Paluwagan, PaluwaganRound } from '../types';
import { FREQUENCY_LABELS } from '../utils/labels';

type Recording = { round: PaluwaganRound; kind: 'contribution' | 'payout' };

function RecordRoundSheet({ paluwagan, recording, onClose }: { paluwagan: Paluwagan; recording: Recording; onClose: () => void }) {
  const toast = useToast();
  const { data: accounts } = useAccounts();
  const contribute = useContribute();
  const payout = useReceivePayout();
  const [accountId, setAccountId] = useState<string | null>(paluwagan.accountId ?? accounts?.[0]?.id ?? null);
  const [date, setDate] = useState<string | null>(getLocalISODate());
  const isPayout = recording.kind === 'payout';
  const amount = isPayout ? paluwagan.payoutAmount : paluwagan.contribution;
  const wallet = accounts?.find((account) => account.id === accountId);
  const mutation = isPayout ? payout : contribute;

  const handleSave = () => {
    if (!accountId) return;
    mutation.mutate(
      { id: paluwagan.id, round: recording.round.round, date: date ?? getLocalISODate(), accountId },
      {
        onSuccess: () => {
          onClose();
          toast.success(isPayout ? 'Payout recorded' : `Round ${recording.round.round} paid`);
        },
        onError: (err: unknown) => toast.error(getErrorMessage(err) || "Couldn't record this round"),
      },
    );
  };

  return (
    <View style={{ gap: 16 }}>
      <Text className="text-sm text-text-secondary">
        {isPayout ? 'Your payout' : 'Contribution'} for round {recording.round.round} ({formatShortDate(recording.round.date)}):{' '}
        {formatCurrency(amount)}
      </Text>
      <ChoicePills
        label={isPayout ? 'Received into' : 'Paid from'}
        choices={(accounts ?? []).map((account) => ({ value: account.id as string | null, label: account.name }))}
        value={accountId}
        onChange={setAccountId}
      />
      {wallet && (
        <Text style={{ fontSize: 13, color: '#6B7280' }}>
          {wallet.name} balance after: {formatCurrency(wallet.balance + (isPayout ? amount : -amount))}
        </Text>
      )}
      <DateField label="Date" value={date} onChange={setDate} maximumDate={new Date()} />
      <Button title={isPayout ? 'Record Payout' : 'Record Contribution'} onPress={handleSave} disabled={!accountId} loading={mutation.isPending} />
    </View>
  );
}

function RoundRow({ round, onPay, onPayout }: { round: PaluwaganRound; onPay: () => void; onPayout: () => void }) {
  const overdue = !round.contributed && round.isPast;
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        backgroundColor: round.isMyTurn ? '#F5F3FF' : '#FFFFFF',
        borderRadius: 12,
        borderWidth: round.isMyTurn ? 1.5 : 0,
        borderColor: '#C4B5FD',
        padding: 12,
      }}
    >
      <View
        style={{
          width: 32,
          height: 32,
          borderRadius: 16,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: round.contributed ? '#DCFCE7' : overdue ? '#FEE2E2' : '#F3F4F6',
        }}
      >
        {round.contributed ? (
          <MaterialCommunityIcons name="check" size={18} color="#15803D" />
        ) : (
          <Text style={{ fontSize: 13, fontWeight: '700', color: overdue ? '#B91C1C' : '#4B5563' }}>{round.round}</Text>
        )}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 14, fontWeight: '600', color: '#111827' }}>
          Round {round.round} · {formatShortDate(round.date)}
        </Text>
        <Text style={{ fontSize: 12, color: overdue ? '#B91C1C' : '#6B7280', marginTop: 2 }}>
          {round.contributed ? 'Paid' : overdue ? 'Overdue' : 'Not paid yet'}
          {round.isMyTurn ? (round.payoutReceived ? ' · Your payout received' : ' · Your turn to receive') : ''}
        </Text>
      </View>
      <View style={{ gap: 6, alignItems: 'flex-end' }}>
        {!round.contributed && (
          <Pressable onPress={onPay} hitSlop={6} accessibilityRole="button" style={{ backgroundColor: '#EFF6FF', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 }}>
            <Text style={{ fontSize: 12, fontWeight: '700', color: '#2563EB' }}>Pay</Text>
          </Pressable>
        )}
        {round.isMyTurn && !round.payoutReceived && (
          <Pressable onPress={onPayout} hitSlop={6} accessibilityRole="button" style={{ backgroundColor: '#EDE9FE', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 }}>
            <Text style={{ fontSize: 12, fontWeight: '700', color: '#6D28D9' }}>Received</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

export default function PaluwaganDetailScreen() {
  const router = useRouter();
  const toast = useToast();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, isLoading } = usePaluwagans();
  const update = useUpdatePaluwagan();
  const remove = useDeletePaluwagan();
  const [recording, setRecording] = useState<Recording | null>(null);
  const [editing, setEditing] = useState(false);

  const paluwagan = data?.find((item) => item.id === id);

  if (!paluwagan) {
    return (
      <Screen>
        {isLoading ? (
          <Loader />
        ) : (
          <View style={{ alignItems: 'center', paddingVertical: 40, gap: 12 }}>
            <Text style={{ color: '#6B7280' }}>This paluwagan isn’t available.</Text>
            <Button title="Go Back" variant="outline" onPress={() => router.back()} />
          </View>
        )}
      </Screen>
    );
  }

  const handleDelete = () => {
    Alert.alert('Delete Paluwagan', 'This also removes its contributions and payout from your wallets.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () =>
          remove.mutate(paluwagan.id, {
            onSuccess: () => {
              toast.success('Paluwagan deleted');
              router.back();
            },
            onError: (err: unknown) => toast.error(getErrorMessage(err) || "Couldn't delete this paluwagan"),
          }),
      },
    ]);
  };

  return (
    <Screen>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 8, paddingBottom: 16 }}>
        <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Go back" hitSlop={8}>
          <MaterialCommunityIcons name="arrow-left" size={24} color="#111827" />
        </Pressable>
        <Text style={{ flex: 1, fontSize: 18, fontWeight: '700', color: '#111827' }} numberOfLines={1}>{paluwagan.name}</Text>
        <Pressable onPress={() => setEditing(true)} accessibilityRole="button" accessibilityLabel="Edit paluwagan" hitSlop={8}>
          <MaterialCommunityIcons name="pencil-outline" size={22} color="#111827" />
        </Pressable>
      </View>

      <FlatList
        data={paluwagan.rounds}
        keyExtractor={(round) => String(round.round)}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ gap: 8, paddingBottom: 40 }}
        ListHeaderComponent={
          <View style={{ backgroundColor: '#7C3AED', borderRadius: 20, padding: 18, marginBottom: 12, gap: 6 }}>
            <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.85)' }}>
              {formatCurrency(paluwagan.contribution)} · {FREQUENCY_LABELS[paluwagan.frequency]} · {paluwagan.members} members
            </Text>
            <Text style={{ fontSize: 26, fontWeight: '800', color: '#FFFFFF' }}>{formatCurrency(paluwagan.payoutAmount)}</Text>
            <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.9)' }}>
              Your payout on {formatShortDate(paluwagan.myPayoutDate)} (round {paluwagan.myTurn})
            </Text>
            <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 4 }}>
              You’ve put in {formatCurrency(paluwagan.totalContributed)} over {paluwagan.contributedCount} round
              {paluwagan.contributedCount === 1 ? '' : 's'}
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <RoundRow
            round={item}
            onPay={() => setRecording({ round: item, kind: 'contribution' })}
            onPayout={() => setRecording({ round: item, kind: 'payout' })}
          />
        )}
        ListFooterComponent={
          <View style={{ gap: 8, marginTop: 16 }}>
            <Button
              title={paluwagan.active ? 'Pause' : 'Resume'}
              variant="outline"
              onPress={() => update.mutate({ id: paluwagan.id, active: !paluwagan.active })}
            />
            <Button title="Delete" variant="danger" onPress={handleDelete} loading={remove.isPending} />
          </View>
        }
      />

      <Modal
        visible={recording !== null}
        onClose={() => setRecording(null)}
        title={recording?.kind === 'payout' ? 'Record Your Payout' : 'Pay Contribution'}
      >
        {recording && (
          <RecordRoundSheet
            key={`${recording.kind}-${recording.round.round}`}
            paluwagan={paluwagan}
            recording={recording}
            onClose={() => setRecording(null)}
          />
        )}
      </Modal>
      <PaluwaganFormModal visible={editing} paluwagan={paluwagan} onClose={() => setEditing(false)} />
    </Screen>
  );
}
