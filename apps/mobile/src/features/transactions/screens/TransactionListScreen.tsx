import { useState, useCallback } from 'react';
import { View, Text, FlatList, Alert } from 'react-native';

import { Screen, Loader, EmptyState, Button, Modal } from '@/components/ui';
import { useTransactionList, useDeleteTransaction, useCreateTransaction, useUpdateTransaction } from '../hooks/useTransactions';
import TransactionItem from '../components/TransactionItem';
import TransactionForm from '../components/TransactionForm';
import type { Transaction, CreateTransactionInput, UpdateTransactionInput } from '../types';

export default function TransactionListScreen() {
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);

  const { data, isLoading, isError, refetch } = useTransactionList({ page, limit: 20 });
  const createMutation = useCreateTransaction();
  const updateMutation = useUpdateTransaction();
  const deleteMutation = useDeleteTransaction();

  const transactions = data?.data ?? [];
  const totalPages = data?.totalPages ?? 1;

  const handleCreate = useCallback(
    (input: CreateTransactionInput) => {
      createMutation.mutate(input, {
        onSuccess: () => {
          setShowForm(false);
          setPage(1);
        },
        onError: () => {
          Alert.alert('Error', 'Failed to create transaction');
        },
      });
    },
    [createMutation],
  );

  const handleUpdate = useCallback(
    (input: UpdateTransactionInput) => {
      updateMutation.mutate(input, {
        onSuccess: () => {
          setEditingTransaction(null);
          setShowForm(false);
        },
        onError: () => {
          Alert.alert('Error', 'Failed to update transaction');
        },
      });
    },
    [updateMutation],
  );

  const handleDelete = useCallback(
    (id: string) => {
      Alert.alert(
        'Delete Transaction',
        'Are you sure you want to delete this transaction?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: () => {
  console.log('[delete] confirmed for id:', id);
  deleteMutation.mutate(id, {
    onError: (err) => {
      console.log('[delete] error:', err);
      Alert.alert('Error', 'Failed to delete transaction');
    },
  });
},
          },
        ],
      );
    },
    [deleteMutation],
  );

  const handleEdit = useCallback((transaction: Transaction) => {
    setEditingTransaction(transaction);
    setShowForm(true);
  }, []);

  const handleAddNew = useCallback(() => {
    setEditingTransaction(null);
    setShowForm(true);
  }, []);

  const handleCloseForm = useCallback(() => {
    setShowForm(false);
    setEditingTransaction(null);
  }, []);

  const handleSubmit = useCallback(
    (data: CreateTransactionInput | UpdateTransactionInput) => {
      if ('id' in data) {
        handleUpdate(data as UpdateTransactionInput);
      } else {
        handleCreate(data as CreateTransactionInput);
      }
    },
    [handleCreate, handleUpdate],
  );

  if (isLoading) {
    return (
      <Screen>
        <Loader />
      </Screen>
    );
  }

  if (isError) {
    return (
      <Screen>
        <View className="flex-1 items-center justify-center">
          <Text className="text-text-secondary mb-md">Failed to load transactions</Text>
          <Button title="Retry" onPress={() => refetch()} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <View className="flex-1">
        {/* Header */}
        <View className="flex-row items-center justify-between mb-md">
          <Text className="text-2xl font-bold text-text">Transactions</Text>
          <Button title="Add" onPress={handleAddNew} />
        </View>

        {/* Summary bar */}
        <View className="flex-row gap-sm mb-md">
          <View className="flex-1 bg-success/10 rounded-xl px-md py-sm">
            <Text className="text-xs text-text-secondary">Income</Text>
            <Text className="text-base font-bold text-success">
              ${data?.data?.reduce((sum, t) => (t.type === 'income' ? sum + t.amount : sum), 0).toFixed(2) || '0.00'}
            </Text>
          </View>
          <View className="flex-1 bg-danger/10 rounded-xl px-md py-sm">
            <Text className="text-xs text-text-secondary">Expenses</Text>
            <Text className="text-base font-bold text-danger">
              ${data?.data?.reduce((sum, t) => (t.type === 'expense' ? sum + t.amount : sum), 0).toFixed(2) || '0.00'}
            </Text>
          </View>
        </View>

        {/* Transaction list */}
        {transactions.length === 0 ? (
          <EmptyState
            title="No transactions yet"
            description="Start tracking your finances by adding your first transaction."
            action={<Button title="Add Transaction" onPress={handleAddNew} />}
          />
        ) : (
          <FlatList
            data={transactions}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <TransactionItem
                transaction={item}
                onEdit={handleEdit}
                onDelete={handleDelete}
              />
            )}
            contentContainerClassName="gap-sm pb-lg"
            showsVerticalScrollIndicator={false}
            onEndReached={() => {
              if (page < totalPages) {
                setPage((prev) => prev + 1);
              }
            }}
            onEndReachedThreshold={0.5}
            ListFooterComponent={
              page < totalPages ? <Loader /> : null
            }
          />
        )}
      </View>

      {/* Add/Edit Modal */}
      <Modal
        visible={showForm}
        onClose={handleCloseForm}
        title={editingTransaction ? 'Edit Transaction' : 'Add Transaction'}
      >
        <TransactionForm
          transaction={editingTransaction}
          onSubmit={handleSubmit}
          onCancel={handleCloseForm}
          loading={createMutation.isPending || updateMutation.isPending}
        />
      </Modal>
    </Screen>
  );
}