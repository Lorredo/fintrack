import React, { useCallback } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Screen } from '@/components/ui';
import TransactionForm from '@/features/transactions/components/TransactionForm';
import { useCreateTransaction, useUpdateTransaction } from '@/features/transactions/hooks/useTransactions';
import { useUIStore } from '@/shared/store/ui.store';
import type { CreateTransactionInput, UpdateTransactionInput } from '@/features/transactions/types';

export default function TransactionFormScreen() {
  const router = useRouter();
  const { type } = useLocalSearchParams<{ type?: 'expense' | 'income' }>();
  
  const editingTransaction = useUIStore((state) => state.editingTransaction);
  const setEditingTransaction = useUIStore((state) => state.setEditingTransaction);
  
  const createMutation = useCreateTransaction();
  const updateMutation = useUpdateTransaction();

  const handleClose = useCallback(() => {
    setEditingTransaction(null);
    router.back();
  }, [router, setEditingTransaction]);

  const handleSubmit = useCallback(
    (data: CreateTransactionInput | UpdateTransactionInput) => {
      if ('id' in data) {
        updateMutation.mutate(data as UpdateTransactionInput, {
          onSuccess: handleClose,
        });
      } else {
        createMutation.mutate(data as CreateTransactionInput, {
          onSuccess: handleClose,
        });
      }
    },
    [createMutation, updateMutation, handleClose]
  );

  const title = editingTransaction ? 'Edit Transaction' : 'Add Transaction';

  return (
    <Screen scrollable>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 16, paddingBottom: 24 }}>
        <Pressable onPress={handleClose} style={{ padding: 8, marginLeft: -8 }}>
          <MaterialCommunityIcons name="arrow-left" size={24} color="#111827" />
        </Pressable>
        <Text style={{ fontSize: 18, fontWeight: '700', color: '#111827' }}>{title}</Text>
        <View style={{ width: 40 }} />
      </View>

      <TransactionForm
        transaction={editingTransaction}
        initialType={type || 'expense'}
        onSubmit={handleSubmit}
        onCancel={handleClose}
        loading={createMutation.isPending || updateMutation.isPending}
      />
    </Screen>
  );
}
