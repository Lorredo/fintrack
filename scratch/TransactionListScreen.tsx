import { useState, useCallback, useMemo, useEffect } from 'react';
import { View, Text, FlatList, Alert, TextInput, Pressable, RefreshControl, ScrollView } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { Screen, Loader, EmptyState, Button, CategoryIcon, ExpandableFAB, Modal } from '@/components/ui';
import { useTransactionList, useDeleteTransaction, useTransactionCategories } from '../hooks/useTransactions';
import { useAccounts } from '@/features/accounts/hooks/useAccounts';
import { useUIStore } from '@/shared/store/ui.store';
import type { Transaction } from '../types';
import { formatCurrency, formatDate } from '@/shared/utils/categories';

type FilterTab = 'all' | 'income' | 'expense';

export default function TransactionListScreen() {
  const router = useRouter();
  const setEditingTransaction = useUIStore((state) => state.setEditingTransaction);
  const deleteMutation = useDeleteTransaction();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all');
  const [refreshing, setRefreshing] = useState(false);

  // Advanced Filters
  const [showFilters, setShowFilters] = useState(false);
  const [filterAccountId, setFilterAccountId] = useState<string>('');
  const [filterCategory, setFilterCategory] = useState<string>('');
  const [filterDateRange, setFilterDateRange] = useState<'this_month' | 'last_month' | 'all_time'>('this_month');

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1); // Reset page on search
    }, 500);
    return () => clearTimeout(timer);
  }, [search]);

  const now = new Date();
  let dateFrom: string | undefined;
  let dateTo: string | undefined;
  
  if (filterDateRange === 'this_month') {
    dateFrom = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    dateTo = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
  } else if (filterDateRange === 'last_month') {
    dateFrom = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0];
    dateTo = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0];
  }

  const { data: userCategories } = useTransactionCategories();
  const { data: accounts } = useAccounts();
  const { data, isLoading, isError, refetch, isRefetching } = useTransactionList({
    page,
    limit: 20,
    type: activeFilter === 'all' ? undefined : activeFilter,
    search: debouncedSearch || undefined,
    accountId: filterAccountId || undefined,
    category: filterCategory || undefined,
    dateFrom,
    dateTo,
  });

  const transactions = data?.data || [];
  const totalPages = data?.pagination?.totalPages || 1;

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    refetch().finally(() => setRefreshing(false));
  }, [refetch]);

  const handleEdit = (transaction: Transaction) => {
    setEditingTransaction(transaction);
    router.push('/transaction-form');
  };

  const handleDelete = (id: string) => {
    Alert.alert('Delete Transaction', 'Are you sure you want to delete this transaction?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteMutation.mutate(id) },
    ]);
  };

  const filterTabs: { label: string; key: FilterTab }[] = [
    { label: 'All', key: 'all' },
    { label: 'Income', key: 'income' },
    { label: 'Expense', key: 'expense' },
  ];

  const hasActiveFilters = filterAccountId !== '' || filterCategory !== '' || filterDateRange !== 'this_month';

  return (
    <Screen edges={['top']}>
      <View style={{ flex: 1, paddingHorizontal: 20 }}>
        {/* Header */}
        <View style={{ paddingTop: 16, paddingBottom: 12 }}>
          <Text style={{ fontSize: 26, fontWeight: '700', color: '#111827', letterSpacing: -0.5 }}>Transactions</Text>
        </View>

        {/* Search Bar & Filter */}
        <View style={{ marginBottom: 12 }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: '#fff',
              borderRadius: 16,
              paddingHorizontal: 14,
              paddingVertical: 10,
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
              <Pressable onPress={() => setSearch('')} style={{ marginRight: 8 }}>
                <MaterialCommunityIcons name="close-circle" size={18} color="#D1D5DB" />
              </Pressable>
            )}
            
            <Pressable
              onPress={() => setShowFilters(true)}
              style={{
                padding: 6,
                backgroundColor: hasActiveFilters ? '#EFF6FF' : 'transparent',
                borderRadius: 8,
              }}
            >
              <MaterialCommunityIcons name="tune-variant" size={20} color={hasActiveFilters ? '#2563EB' : '#6B7280'} />
              {hasActiveFilters && (
                <View style={{ position: 'absolute', top: 4, right: 4, width: 6, height: 6, borderRadius: 3, backgroundColor: '#EF4444' }} />
              )}
            </Pressable>
          </View>
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
                accounts={accounts}
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

      {/* Filter Modal */}
      <Modal visible={showFilters} onClose={() => setShowFilters(false)} title="Advanced Filters">
        <View style={{ padding: 20 }}>
          {/* Date Range */}
          <View style={{ marginBottom: 24 }}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: '#111827', marginBottom: 12 }}>Time Period</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {[
                { label: 'This Month', value: 'this_month' },
                { label: 'Last Month', value: 'last_month' },
                { label: 'All Time', value: 'all_time' },
              ].map((opt) => (
                <Pressable
                  key={opt.value}
                  onPress={() => { setFilterDateRange(opt.value as any); setPage(1); }}
                  style={{
                    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999,
                    backgroundColor: filterDateRange === opt.value ? '#2563EB' : '#F3F4F6',
                  }}
                >
                  <Text style={{ fontSize: 13, fontWeight: '500', color: filterDateRange === opt.value ? '#fff' : '#4B5563' }}>{opt.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Wallet */}
          <View style={{ marginBottom: 24 }}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: '#111827', marginBottom: 12 }}>Wallet</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              <Pressable
                onPress={() => { setFilterAccountId(''); setPage(1); }}
                style={{
                  paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999,
                  backgroundColor: filterAccountId === '' ? '#2563EB' : '#F3F4F6',
                }}
              >
                <Text style={{ fontSize: 13, fontWeight: '500', color: filterAccountId === '' ? '#fff' : '#4B5563' }}>All Wallets</Text>
              </Pressable>
              {accounts?.map((acc) => (
                <Pressable
                  key={acc.id}
                  onPress={() => { setFilterAccountId(acc.id); setPage(1); }}
                  style={{
                    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999,
                    backgroundColor: filterAccountId === acc.id ? '#2563EB' : '#F3F4F6',
                  }}
                >
                  <Text style={{ fontSize: 13, fontWeight: '500', color: filterAccountId === acc.id ? '#fff' : '#4B5563' }}>{acc.name}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Category */}
          <View style={{ marginBottom: 32 }}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: '#111827', marginBottom: 12 }}>Category</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              <Pressable
                onPress={() => { setFilterCategory(''); setPage(1); }}
                style={{
                  paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999,
                  backgroundColor: !filterCategory ? '#2563EB' : '#F3F4F6',
                }}
              >
                <Text style={{ fontSize: 13, fontWeight: '500', color: !filterCategory ? '#fff' : '#4B5563' }}>All Categories</Text>
              </Pressable>
              {(userCategories || []).map((cat) => (
                <Pressable
                  key={cat}
                  onPress={() => { setFilterCategory(cat); setPage(1); }}
                  style={{
                    flexDirection: 'row', alignItems: 'center', gap: 6,
                    paddingLeft: 8, paddingRight: 16, paddingVertical: 6, borderRadius: 999,
                    backgroundColor: filterCategory === cat ? '#2563EB' : '#F3F4F6',
                  }}
                >
                  <View style={{ transform: [{ scale: 0.8 }] }}>
                    <CategoryIcon category={cat} size="sm" />
                  </View>
                  <Text style={{ fontSize: 13, fontWeight: '500', color: filterCategory === cat ? '#fff' : '#4B5563' }}>{cat}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          <Button 
            title="Reset Filters" 
            variant="outline" 
            onPress={() => {
              setFilterAccountId('');
              setFilterCategory('');
              setFilterDateRange('this_month');
              setPage(1);
            }} 
          />
        </View>
      </Modal>

    </Screen>
  );
}

function TransactionRow({
  transaction,
  accounts,
  onEdit,
  onDelete,
}: {
  transaction: Transaction;
  accounts?: any[];
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
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={{ fontSize: 14, fontWeight: '600', color: '#111827' }} numberOfLines={1}>
            {transaction.category}
          </Text>
          {accounts && (
            <View style={{ backgroundColor: '#F3F4F6', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
              <Text style={{ fontSize: 9, fontWeight: '600', color: '#6B7280' }}>
                {transaction.type === 'transfer' ? `${accounts.find(a => a.id === transaction.accountId)?.name || 'Wallet'} → ${accounts.find(a => a.id === transaction.transferAccountId)?.name || 'Wallet'}` : (accounts.find(a => a.id === transaction.accountId)?.name || 'Wallet')}
              </Text>
            </View>
          )}
        </View>
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
