import { useState } from 'react';
import { View, Text, FlatList, Pressable, RefreshControl } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { Screen, Loader, EmptyState, Button, CategoryIcon } from '@/components/ui';
import { useAccounts } from '@/features/accounts/hooks/useAccounts';
import TransactionDetailsModal from '@/features/transactions/components/TransactionDetailsModal';
import TransactionRow from '@/features/transactions/components/TransactionRow';
import { useInfiniteTransactionList } from '@/features/transactions/hooks/useTransactions';
import type { Transaction } from '@/features/transactions/types';
import { formatCurrency, formatDateRange } from '@/shared/utils/categories';
import { useCategoryComparison } from '../hooks/useReports';

export default function CategoryTransactionsScreen() {
  const router = useRouter();
  const { category, startDate, endDate, accountId } = useLocalSearchParams<{
    category: string;
    startDate: string;
    endDate: string;
    accountId?: string;
  }>();
  const { data: accounts } = useAccounts();
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);

  const {
    data,
    isLoading,
    isError,
    refetch,
    isRefetching,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = useInfiniteTransactionList({
    type: 'expense',
    category,
    dateFrom: startDate,
    dateTo: endDate,
    accountId,
    limit: 20,
  });
  const { data: categories } = useCategoryComparison({ startDate, endDate, accountId });

  const transactions = data?.pages.flatMap((page) => page.data) ?? [];
  const count = data?.pages[0]?.total ?? 0;
  const total = categories?.find((c) => c.category === category && c.type === 'expense')?.currentMonthTotal ?? 0;

  return (
    <Screen>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 8, paddingBottom: 16 }}>
        <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Go back" hitSlop={8}>
          <MaterialCommunityIcons name="arrow-left" size={24} color="#111827" />
        </Pressable>
        <CategoryIcon category={category} size="sm" />
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 18, fontWeight: '700', color: '#111827' }} numberOfLines={1}>{category}</Text>
          <Text style={{ fontSize: 12, color: '#6B7280' }}>{formatDateRange(startDate, endDate)}</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={{ fontSize: 16, fontWeight: '700', color: '#DC2626' }}>{formatCurrency(total)}</Text>
          <Text style={{ fontSize: 12, color: '#6B7280' }}>
            {count} {count === 1 ? 'expense' : 'expenses'}
          </Text>
        </View>
      </View>

      {isLoading ? (
        <Loader />
      ) : isError && !data ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 40 }}>
          <Text style={{ fontSize: 15, color: '#6B7280', marginBottom: 12, textAlign: 'center' }}>
            Failed to load expenses
          </Text>
          <Button title="Retry" onPress={() => refetch()} />
        </View>
      ) : transactions.length === 0 ? (
        <EmptyState title="No expenses found" description={`No ${category} expenses in this period.`} />
      ) : (
        <FlatList
          data={transactions}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TransactionRow transaction={item} accounts={accounts} onPress={setSelectedTransaction} />
          )}
          contentContainerStyle={{ gap: 8, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={isRefetching && !isFetchingNextPage} onRefresh={refetch} tintColor="#2563EB" />
          }
          onEndReached={() => {
            if (hasNextPage && !isFetchingNextPage) fetchNextPage();
          }}
          onEndReachedThreshold={0.3}
          ListFooterComponent={isFetchingNextPage ? <Loader /> : null}
        />
      )}

      <TransactionDetailsModal
        transaction={selectedTransaction}
        accounts={accounts}
        onClose={() => setSelectedTransaction(null)}
      />
    </Screen>
  );
}
