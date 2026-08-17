import { useState, useCallback, useMemo } from 'react';
import { View, Text, FlatList, Alert, TextInput, Pressable, RefreshControl } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { Screen, Loader, EmptyState, Button, Modal, CategoryIcon } from '@/components/ui';
import { useTransactionList, useDeleteTransaction, useCreateTransaction, useUpdateTransaction } from '../hooks/useTransactions';
import TransactionForm from '../components/TransactionForm';
import type { Transaction, CreateTransactionInput, UpdateTransactionInput } from '../types';
import { formatCurrency, formatDate } from '@/shared/utils/categories';

type FilterTab = 'all' | 'income' | 'expense';

export default function TransactionListScreen() {
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all');
  const [refreshing, setRefreshing] = useState(false);

  const { data, isLoading, isError, refetch, isRefetching } = useTransactionList({
    page,
    limit: 20,
    type: activeFilter === 'all' ? '' : activeFilter,
  });
  const createMutation = useCreateTransaction();
  const updateMutation = useUpdateTransaction();
  const deleteMutation = useDeleteTransaction();

  const transactions = useMemo(() => {
    const list = data?.data ?? [];
    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter(
      (t) =>
        t.category.toLowerCase().includes(q) ||
        (t.description?.toLowerCase().includes(q) ?? false),
    );
  }, [data?.data, search]);

  const totalPages = data?.totalPages ?? 1;

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

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
              deleteMutation.mutate(id, {
                onError: () => {
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

  const filterTabs: { key: FilterTab; label: string; icon: 'view-list' | 'cash-plus' | 'cash-minus' }[] = [
    { key: 'all', label: 'All', icon: 'view-list' },
    { key: 'income', label: 'Income', icon: 'cash-plus' },
    { key: 'expense', label: 'Expense', icon: 'cash-minus' },
  ];

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
          <Button
            icon="plus"
            onPress={handleAddNew}
            style={{ width: 44, height: 44, paddingHorizontal: 5}}
          />
        </View>

        {/* Search Bar */}
        <View className="flex-row items-center bg-surface rounded-xl px-md py-sm border border-border mb-sm">
          <MaterialCommunityIcons name="magnify" size={20} color="#94A3B8" />
          <TextInput
            className="flex-1 text-body text-text ml-sm"
            placeholder="Search transactions, categories..."
            placeholderTextColor="#94A3B8"
            value={search}
            onChangeText={setSearch}
            autoCapitalize="none"
          />
          {search.length > 0 && (
            <Pressable onPress={() => setSearch('')}>
              <MaterialCommunityIcons name="close-circle" size={20} color="#94A3B8" />
            </Pressable>
          )}
        </View>

        {/* Filter Tabs */}
        <View className="flex-row gap-sm mb-md">
          {filterTabs.map((tab) => {
            const isActive = activeFilter === tab.key;
            return (
              <Pressable
                key={tab.key}
                className={`flex-row items-center px-md py-sm rounded-full gap-xs ${
                  isActive ? 'bg-primary' : 'bg-surface border border-border'
                }`}
                onPress={() => {
                  setActiveFilter(tab.key);
                  setPage(1);
                }}
              >
                <MaterialCommunityIcons
                  name={tab.icon}
                  size={16}
                  color={isActive ? '#fff' : '#64748B'}
                />
                <Text
                  className={`text-sm font-semibold ${
                    isActive ? 'text-white' : 'text-text-secondary'
                  }`}
                >
                  {tab.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Transaction list */}
        {transactions.length === 0 ? (
          <EmptyState
            title={search ? 'No results found' : 'No transactions yet'}
            description={
              search
                ? `No transactions match "${search}"`
                : 'Start tracking your finances by adding your first transaction.'
            }
            action={<Button title="Add Transaction" icon="plus" onPress={handleAddNew} />}
          />
        ) : (
          <FlatList
            data={transactions}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <TransactionRow
                transaction={item}
                onEdit={handleEdit}
                onDelete={handleDelete}
              />
            )}
            contentContainerClassName="gap-sm pb-lg"
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={refreshing || isRefetching} onRefresh={handleRefresh} />
            }
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

function TransactionRow({
  transaction,
  onEdit,
  onDelete,
}: {
  transaction: Transaction;
  onEdit: (transaction: Transaction) => void;
  onDelete: (id: string) => void;
}) {
  const isExpense = transaction.type === 'expense';
  const amountColor = isExpense ? 'text-danger' : 'text-success';
  const sign = isExpense ? '-' : '+';

  return (
    <View className="flex-row items-center bg-surface rounded-xl px-md py-sm border border-border">
      <CategoryIcon category={transaction.category} size="sm" />
      <View className="flex-1 ml-md">
        <Text className="text-sm font-semibold text-text" numberOfLines={1}>
          {transaction.category}
        </Text>
        {transaction.description && (
          <Text className="text-xs text-text-secondary mt-1" numberOfLines={1}>
            {transaction.description}
          </Text>
        )}
        <Text className="text-xs text-text-secondary mt-1">
          {formatDate(transaction.date)}
        </Text>
      </View>
      <View className="items-end ml-sm">
        <Text className={`text-base font-bold ${amountColor}`}>
          {sign}{formatCurrency(transaction.amount)}
        </Text>
        <View className="flex-row gap-sm mt-xs">
          <Pressable onPress={() => onEdit(transaction)} className="p-xs">
            <MaterialCommunityIcons name="pencil" size={16} color="#2563EB" />
          </Pressable>
          <Pressable onPress={() => onDelete(transaction.id)} className="p-xs">
            <MaterialCommunityIcons name="trash-can-outline" size={16} color="#EF4444" />
          </Pressable>
        </View>
      </View>
    </View>
  );
}