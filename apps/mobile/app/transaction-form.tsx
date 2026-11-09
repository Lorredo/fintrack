import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Screen } from '@/components/ui';
import TransactionForm from '@/features/transactions/components/TransactionForm';
import { useCreateTransaction, useUpdateTransaction } from '@/features/transactions/hooks/useTransactions';
import { useUIStore } from '@/shared/store/ui.store';
import type { CreateTransactionInput, UpdateTransactionInput } from '@/features/transactions/types';
import { useToast } from '@/features/toast/hooks/useToast';
import { getErrorMessage } from '@/shared/utils/apiErrors';
import { pickReceiptImage } from '@/features/receipts/services/scanReceipt';

export default function TransactionFormScreen() {
  const router = useRouter();
  const { type, accountId, fromReceipt, amount, date, description, category } = useLocalSearchParams<{
    type?: 'expense' | 'income' | 'transfer';
    accountId?: string;
    fromReceipt?: string;
    amount?: string;
    date?: string;
    description?: string;
    category?: string;
  }>();
  const prefill = fromReceipt === '1' ? { amount, date, description, category } : undefined;
  
  // Read once: this screen edits whatever was selected when it opened.
  const [editingTransaction] = useState(() => useUIStore.getState().editingTransaction);
  const setEditingTransaction = useUIStore((state) => state.setEditingTransaction);

  // Every exit lands here, including the phone's back button and gesture, so
  // the selection can't leak into the next form.
  useEffect(() => () => setEditingTransaction(null), [setEditingTransaction]);
  
  const createMutation = useCreateTransaction();
  const updateMutation = useUpdateTransaction();

  const [formType, setFormType] = useState(editingTransaction?.type || type || 'expense');

  const handleClose = useCallback(() => {
    router.back();
  }, [router]);

  const toast = useToast();

  const handleSubmit = useCallback(
    (data: CreateTransactionInput | UpdateTransactionInput) => {
      // The form stays open with what was entered, so it can be saved again.
      const onError = (err: unknown) => toast.error(getErrorMessage(err) || "Couldn't save the transaction");
      if ('id' in data) {
        updateMutation.mutate(data as UpdateTransactionInput, {
          onSuccess: handleClose,
          onError,
        });
      } else {
        createMutation.mutate(data as CreateTransactionInput, {
          onSuccess: handleClose,
          onError,
        });
      }
    },
    [createMutation, updateMutation, handleClose, toast]
  );

  const getTitle = () => {
    if (editingTransaction) return 'Edit ' + (formType.charAt(0).toUpperCase() + formType.slice(1));
    if (formType === 'transfer') return 'Transfer Money';
    return 'Add ' + (formType.charAt(0).toUpperCase() + formType.slice(1));
  };
  const title = getTitle();

  return (
    <Screen scrollable>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 16, paddingBottom: 24 }}>
        <Pressable onPress={handleClose} style={{ padding: 8, marginLeft: -8 }}>
          <MaterialCommunityIcons name="arrow-left" size={24} color="#111827" />
        </Pressable>
        <Text style={{ fontSize: 18, fontWeight: '700', color: '#111827' }}>{title}</Text>
        <View style={{ width: 40 }} />
      </View>

      {!editingTransaction && formType !== 'transfer' && !prefill && (
        <Pressable
          onPress={async () => {
            const uri = await pickReceiptImage();
            if (uri) router.replace({ pathname: '/scan-receipt', params: { uri } });
          }}
          accessibilityRole="button"
          className="active:opacity-70"
          style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#FFFFFF', borderRadius: 14, borderWidth: 1.5, borderStyle: 'dashed', borderColor: '#93C5FD', padding: 14, marginBottom: 20 }}
        >
          <MaterialCommunityIcons name="receipt" size={22} color="#2563EB" />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 15, fontWeight: '600', color: '#1E3A8A' }}>Scan a receipt</Text>
            <Text style={{ fontSize: 12, color: '#3B82F6', marginTop: 2 }}>Fill this in from a GCash, Maya or bank screenshot</Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={20} color="#93C5FD" />
        </Pressable>
      )}

      <TransactionForm
        transaction={editingTransaction}
        initialType={type || 'expense'}
        initialAccountId={accountId}
        prefill={prefill}
        onTypeChange={setFormType}
        onSubmit={handleSubmit}
        onCancel={handleClose}
        loading={createMutation.isPending || updateMutation.isPending}
      />
    </Screen>
  );
}
