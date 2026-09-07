import { useState, useCallback, useMemo } from 'react';
import { View, Text, FlatList, Alert, TextInput, Pressable, RefreshControl } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { Screen, Loader, EmptyState, Button, CategoryIcon, ExpandableFAB } from '@/components/ui';
import { useTransactionList, useDeleteTransaction } from '../hooks/useTransactions';
import { useUIStore } from '@/shared/store/ui.store';
import type { Transaction } from '../types';
import { formatCurrency, formatDate } from '@/shared/utils/categories';

type FilterTab = 'all' | 'income' | 'expense';

export default function TransactionListScreen() {
  const router = useRouter();
  const setEditingTransaction = useUIStore((state) => state.setEditingTransaction);

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all');
  const [refreshing, setRefreshing] = useState(false);

  const { data, isLoading, isError, refetch, isRefetching } = useTransactionList({
    page,
    limit: 20,
    type: activeFilter === 'all' ? undefined : activeFilter,
  });

  const deleteMutation = useDeleteTransaction();

  const transactions = useMemo(() => data?.data || [], [data]);
  const totalPages = data?.totalPages || 1;

  const handleEdit = useCallback(
    (transaction: Transaction) => {
      setEditingTransaction(transaction);
      router.push('/transaction-form');
    },
    [setEditingTransaction, router]
  );

  const handleDelete = useCallback(
    (id: string) => {
      Alert.alert('Delete Transaction', 'Are you sure you want to delete this transaction?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => deleteMutation.mutate(id) },
      ]);
    },
    [deleteMutation]
  );


  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    setPage(1);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const filterTabs: { key: FilterTab; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'income', label: 'Income' },
    { key: 'expense', label: 'Expense' },
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
      <View style={{ flex: 1 }}>
        {/* Header */}
        <View style={{ paddingTop: 16, paddingBottom: 12 }}>
          <Text style={{ fontSize: 26, fontWeight: '700', color: '#111827', letterSpacing: -0.5 }}>Transactions</Text>
        </View>

        {/* Search Bar */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: '#fff',
            borderRadius: 16,
            paddingHorizontal: 14,
            paddingVertical: 10,
            marginBottom: 12,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.06,
            shadowRadius: 6,
            elevation: 2,
          }}
        >
          <MaterialCommunityIcons name="magnify" size={20} color="#9CA3AF" />
          <TextInput
            style={{ flex: 1, fontSize: 15, color: '#111827', marginLeft: 10 }}
            placeholder="Search transactions..."
            placeholderTextColor="#9CA3AF"
            value={search}
            onChangeText={setSearch}
            autoCapitalize="none"
          />
          {search.length > 0 && (
            <Pressable onPress={() => setSearch('')}>
              <MaterialCommunityIcons name="close-circle" size={18} color="#D1D5DB" />
            </Pressable>
          )}
        </View>

        {/* Filter Tabs */}
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
          {filterTabs.map((tab) => {
            const isActive = activeFilter === tab.key;
            return (
              <Pressable
                key={tab.key}
                style={{
                  paddingHorizontal: 18,
                  paddingVertical: 8,
                  borderRadius: 999,
                  backgroundColor: isActive ? '#2563EB' : '#fff',
                  borderWidth: isActive ? 0 : 1.5,
                  borderColor: '#EDF0F5',
                }}
                onPress={() => {
                  setActiveFilter(tab.key);
                  setPage(1);
                }}
              >
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: '600',
                    color: isActive ? '#fff' : '#6B7280',
                  }}
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
            contentContainerStyle={{ gap: 8, paddingBottom: 100 }}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={refreshing || isRefetching} onRefresh={handleRefresh} tintColor="#2563EB" />
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

      {/* Floating Action Button */}
      {activeFilter === 'all' ? (
        <ExpandableFAB
          actions={[
            {
              icon: 'arrow-up-circle',
              label: 'Add Expense',
              color: '#EF4444',
              onPress: () => {
                setEditingTransaction(null);
                router.push({ pathname: '/transaction-form', params: { type: 'expense' } });
              }
            },
            {
              icon: 'arrow-down-circle',
              label: 'Add Income',
              color: '#22C55E',
              onPress: () => {
                setEditingTransaction(null);
                router.push({ pathname: '/transaction-form', params: { type: 'income' } });
              }
            }
          ]}
        />
      ) : (
        <Pressable
          onPress={() => {
            setEditingTransaction(null);
            router.push({ pathname: '/transaction-form', params: { type: activeFilter } });
          }}
          style={{
            position: 'absolute',
            bottom: 24,
            right: 0,
            width: 56,
            height: 56,
            borderRadius: 28,
            backgroundColor: '#2563EB',
            alignItems: 'center',
            justifyContent: 'center',
            shadowColor: '#2563EB',
            shadowOffset: { width: 0, height: 6 },
            shadowOpacity: 0.4,
            shadowRadius: 12,
            elevation: 8,
          }}
        >
          <MaterialCommunityIcons name="plus" size={28} color="#fff" />
        </Pressable>
      )}

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

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 14,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 1,
      }}
    >
      <CategoryIcon category={transaction.category} size="sm" />
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text style={{ fontSize: 14, fontWeight: '600', color: '#111827' }} numberOfLines={1}>
          {transaction.category}
        </Text>
        {transaction.description && (
          <Text style={{ fontSize: 12, color: '#9CA3AF', marginTop: 1 }} numberOfLines={1}>
            {transaction.description}
          </Text>
        )}
        <Text style={{ fontSize: 11, color: '#9CA3AF', marginTop: 1 }}>
          {formatDate(transaction.date)}
        </Text>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={{ fontSize: 15, fontWeight: '700', color: isExpense ? '#EF4444' : '#22C55E' }}>
          {isExpense ? '-' : '+'}{formatCurrency(transaction.amount)}
        </Text>
        <View style={{ flexDirection: 'row', gap: 4, marginTop: 4 }}>
          <Pressable
            onPress={() => onEdit(transaction)}
            style={{ padding: 4, borderRadius: 6, backgroundColor: '#EFF6FF' }}
          >
            <MaterialCommunityIcons name="pencil" size={14} color="#2563EB" />
          </Pressable>
          <Pressable
            onPress={() => onDelete(transaction.id)}
            style={{ padding: 4, borderRadius: 6, backgroundColor: '#FEF2F2' }}
          >
            <MaterialCommunityIcons name="trash-can-outline" size={14} color="#EF4444" />
          </Pressable>
        </View>
      </View>
    </View>
  );
}