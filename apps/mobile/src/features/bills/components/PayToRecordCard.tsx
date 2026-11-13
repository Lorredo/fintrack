import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { useAccounts } from '@/features/accounts/hooks/useAccounts';
import { useDeleteTransaction } from '@/features/transactions/hooks/useTransactions';
import type { Transaction } from '@/features/transactions/types';
import { useToast } from '@/features/toast/hooks/useToast';
import { storage } from '@/lib/storage';
import { getErrorMessage } from '@/shared/utils/apiErrors';
import { formatCurrency, getLocalISODate } from '@/shared/utils/categories';
import { usePendingPay, useRecordPay, useSkipPay } from '../hooks/useBills';
import type { PayItem } from '../types';
import { formatShortDate } from '../utils/billLabels';
import RecordPayModal from './RecordPayModal';

// The day "Not yet" was tapped; the card stays hidden for the rest of it.
const SNOOZE_KEY = 'pay_card_snoozed_on';

function readSnooze(): string | null {
  try {
    return storage.get(SNOOZE_KEY) ?? null;
  } catch {
    return null;
  }
}

interface Recorded {
  item: PayItem;
  transactionId: string;
}

function itemId(item: PayItem) {
  return `${item.key}|${item.date}`;
}

/**
 * Asks the user to record their salary and allowances when they're due, in
 * one tap. Nothing is added until they tap Record.
 */
export function PayToRecordCard() {
  const toast = useToast();
  const today = getLocalISODate();
  const { data } = usePendingPay();
  const { data: accounts } = useAccounts();
  const recordPay = useRecordPay();
  const skipPay = useSkipPay();
  const deleteTransaction = useDeleteTransaction();

  const [snoozedOn, setSnoozedOn] = useState(readSnooze);
  const [editing, setEditing] = useState<PayItem | null>(null);
  // Recorded while the card is open, so Undo stays in reach.
  const [recorded, setRecorded] = useState<Recorded[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const pending = data?.pending ?? [];
  if (snoozedOn === today || (pending.length === 0 && recorded.length === 0)) return null;

  const walletName = (id: string | null) => accounts?.find((account) => account.id === id)?.name;

  const handleRecorded = (item: PayItem, transaction: Transaction) => {
    setRecorded((current) => [...current, { item, transactionId: transaction.id }]);
    toast.success(`${item.name} recorded`);
  };

  const handleRecord = (item: PayItem) => {
    // Without a wallet, ask for one first.
    if (!item.accountId || !walletName(item.accountId)) {
      setEditing(item);
      return;
    }
    setBusy(itemId(item));
    recordPay.mutate(
      { key: item.key, payDate: item.date, date: item.date },
      {
        onSuccess: (transaction) => handleRecorded(item, transaction),
        onError: (err: unknown) => toast.error(getErrorMessage(err) || "Couldn't record your pay"),
        onSettled: () => setBusy(null),
      },
    );
  };

  const handleAlreadyAdded = (item: PayItem) => {
    setBusy(itemId(item));
    skipPay.mutate(
      { key: item.key, payDate: item.date },
      {
        onSuccess: () => toast.info(`${item.name} marked as already added`),
        onError: (err: unknown) => toast.error(getErrorMessage(err) || "Couldn't update this"),
        onSettled: () => setBusy(null),
      },
    );
  };

  const handleUndo = (entry: Recorded) => {
    setBusy(itemId(entry.item));
    deleteTransaction.mutate(entry.transactionId, {
      onSuccess: () => {
        setRecorded((current) => current.filter((item) => item.transactionId !== entry.transactionId));
        toast.info(`${entry.item.name} removed`);
      },
      onError: (err: unknown) => toast.error(getErrorMessage(err) || "Couldn't undo"),
      onSettled: () => setBusy(null),
    });
  };

  const handleNotYet = () => {
    try {
      storage.set(SNOOZE_KEY, today);
    } catch {
      // Hiding for the session is enough.
    }
    setSnoozedOn(today);
  };

  const allDone = pending.length === 0;

  return (
    <View style={{ backgroundColor: '#ECFDF5', borderRadius: 20, padding: 16, marginBottom: 16, gap: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <MaterialCommunityIcons name="cash-plus" size={22} color="#047857" />
        <Text style={{ flex: 1, fontSize: 16, fontWeight: '700', color: '#065F46' }}>
          {allDone ? 'Pay recorded' : 'Payday! Record your pay'}
        </Text>
        <Pressable
          onPress={allDone ? () => setRecorded([]) : handleNotYet}
          hitSlop={8}
          accessibilityRole="button"
          className="active:opacity-70"
        >
          <Text style={{ fontSize: 13, fontWeight: '600', color: '#047857' }}>{allDone ? 'Done' : 'Not yet'}</Text>
        </Pressable>
      </View>

      {pending.map((item) => {
        const wallet = walletName(item.accountId);
        const isBusy = busy === itemId(item);
        return (
          <View key={itemId(item)} style={{ backgroundColor: '#FFFFFF', borderRadius: 14, padding: 12, gap: 10 }}>
            <Pressable onPress={() => setEditing(item)} accessibilityRole="button" accessibilityLabel={`Edit ${item.name}`}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={{ flex: 1, fontSize: 15, fontWeight: '600', color: '#111827' }} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={{ fontSize: 15, fontWeight: '700', color: '#111827' }}>{formatCurrency(item.amount)}</Text>
                <MaterialCommunityIcons name="pencil-outline" size={16} color="#6B7280" />
              </View>
              <Text style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>
                {item.date < today ? `Due ${formatShortDate(item.date)}` : 'Today'} · {wallet ? `to ${wallet}` : 'Choose a wallet'}
              </Text>
            </Pressable>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Pressable
                onPress={() => handleRecord(item)}
                disabled={isBusy}
                accessibilityRole="button"
                className="active:opacity-70"
                style={{ flex: 1, alignItems: 'center', backgroundColor: '#059669', borderRadius: 10, paddingVertical: 10, opacity: isBusy ? 0.6 : 1 }}
              >
                <Text style={{ fontSize: 14, fontWeight: '700', color: '#FFFFFF' }}>{isBusy ? 'Saving…' : 'Record'}</Text>
              </Pressable>
              <Pressable
                onPress={() => handleAlreadyAdded(item)}
                disabled={isBusy}
                accessibilityRole="button"
                className="active:opacity-70"
                style={{ alignItems: 'center', justifyContent: 'center', borderRadius: 10, paddingHorizontal: 14, borderWidth: 1, borderColor: '#D1D5DB' }}
              >
                <Text style={{ fontSize: 13, fontWeight: '600', color: '#4B5563' }}>Already added</Text>
              </Pressable>
            </View>
          </View>
        );
      })}

      {recorded.map((entry) => (
        <View key={entry.transactionId} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 4 }}>
          <MaterialCommunityIcons name="check-circle" size={18} color="#059669" />
          <Text style={{ flex: 1, fontSize: 14, color: '#065F46' }} numberOfLines={1}>
            {entry.item.name} recorded
          </Text>
          <Pressable
            onPress={() => handleUndo(entry)}
            disabled={busy === itemId(entry.item)}
            hitSlop={8}
            accessibilityRole="button"
            className="active:opacity-70"
          >
            <Text style={{ fontSize: 13, fontWeight: '700', color: '#2563EB' }}>Undo</Text>
          </Pressable>
        </View>
      ))}

      <RecordPayModal item={editing} onClose={() => setEditing(null)} onRecorded={handleRecorded} />
    </View>
  );
}
