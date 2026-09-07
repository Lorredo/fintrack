import { View, Text, Pressable, ScrollView } from 'react-native';
import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { Screen, Loader, Button, CategoryIcon, ExpandableFAB } from '@/components/ui';
import { useDashboardSummary } from '../hooks/useDashboard';
import { useAuthStore } from '@/features/auth/store/auth.store';
import { getGreeting, formatCurrency, formatDate, getCategoryIcon } from '@/shared/utils/categories';
import { WidgetSyncService } from '@/shared/services/widget-sync.service';
import type { Transaction } from '@/features/transactions/types';

export default function DashboardScreen() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const { data, isLoading, isError, refetch, isRefetching } = useDashboardSummary();

  // Sync data to native storage bridge for Home Screen Widgets
  useEffect(() => {
    if (data?.activeBudgets) {
      WidgetSyncService.syncActiveBudgets(data.activeBudgets);
    }
  }, [data?.activeBudgets]);

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
        <View className="flex-1 items-center justify-center p-4">
          <Text className="text-text-secondary mb-md">Failed to load dashboard</Text>
          <Button title="Retry" onPress={() => refetch()} />
        </View>
      </Screen>
    );
  }

  const summary = data!;
  const fullName = user ? `${user.firstName} ${user.lastName}` : 'there';

  return (
    <Screen 
      scrollable 
      refreshing={isRefetching} 
      onRefresh={refetch}
      floatingComponent={
        <ExpandableFAB
          actions={[
            {
              icon: 'wallet-outline',
              label: 'Add Budget',
              color: '#2563EB',
              onPress: () => {
                router.push('/budget-form');
              }
            },
            {
              icon: 'arrow-down-circle',
              label: 'Add Income',
              color: '#22C55E',
              onPress: () => {
                router.push({ pathname: '/transaction-form', params: { type: 'income' } });
              }
            },
            {
              icon: 'arrow-up-circle',
              label: 'Add Expense',
              color: '#EF4444',
              onPress: () => {
                router.push({ pathname: '/transaction-form', params: { type: 'expense' } });
              }
            }
          ]}
        />
      }
    >
      <View style={{ paddingTop: 8, paddingBottom: 20 }}>
        <Text style={{ fontSize: 13, color: '#6B7280', fontWeight: '500' }}>{getGreeting()},</Text>
        <Text style={{ fontSize: 24, fontWeight: '700', color: '#111827', letterSpacing: -0.3 }}>{fullName} 👋</Text>
      </View>

      {/* Hero Balance Card */}
      <View
        style={{
          borderRadius: 24,
          padding: 24,
          marginBottom: 16,
          backgroundColor: '#2563EB',
          shadowColor: '#2563EB',
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.3,
          shadowRadius: 20,
          elevation: 8,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', fontWeight: '500' }}>Total Balance</Text>
          <MaterialCommunityIcons name="wallet-outline" size={22} color="rgba(255,255,255,0.7)" />
        </View>
        <Text style={{ fontSize: 36, fontWeight: '700', color: '#fff', letterSpacing: -1, marginBottom: 12 }}>
          {formatCurrency(summary.balance)}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <MaterialCommunityIcons
            name={summary.balance >= 0 ? 'trending-up' : 'trending-down'}
            size={15}
            color="rgba(255,255,255,0.6)"
          />
          <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>
            {summary.balance >= 0 ? 'Positive' : 'Negative'} balance this month
          </Text>
        </View>
      </View>

      {/* Safe to Spend / Active Budgets */}
      {summary.activeBudgets?.length > 0 && (
        <View style={{ marginBottom: 20 }}>
          <Text style={{ fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 10, paddingHorizontal: 4 }}>
            Safe to Spend
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingRight: 20 }}>
            {summary.activeBudgets.map((budget) => {
              const remaining = Math.max(budget.remaining, 0);
              const isOver = budget.remaining < 0;
              return (
                <View
                  key={budget.id}
                  style={{
                    backgroundColor: '#fff',
                    borderRadius: 16,
                    padding: 16,
                    minWidth: 150,
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: 0.05,
                    shadowRadius: 4,
                    elevation: 2,
                    borderWidth: 1,
                    borderColor: isOver ? '#FEE2E2' : '#F3F4F6'
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <CategoryIcon category={budget.category} size="sm" />
                    <Text style={{ fontSize: 13, fontWeight: '600', color: '#4B5563' }} numberOfLines={1}>{budget.category}</Text>
                  </View>
                  <Text style={{ fontSize: 20, fontWeight: '700', color: isOver ? '#EF4444' : '#111827' }}>
                    {formatCurrency(remaining)}
                  </Text>
                  <Text style={{ fontSize: 11, color: isOver ? '#EF4444' : '#9CA3AF', marginTop: 4 }}>
                    {isOver ? 'Over budget' : 'remaining'}
                  </Text>
                </View>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* Metrics Row */}
      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20 }}>
        {/* Income */}
        <View style={{ flex: 1, backgroundColor: '#F0FDF4', borderRadius: 16, padding: 14 }}>
          <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: '#DCFCE7', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
            <MaterialCommunityIcons name="arrow-down-circle" size={20} color="#22C55E" />
          </View>
          <Text style={{ fontSize: 11, color: '#6B7280', marginBottom: 2 }}>Income</Text>
          <Text style={{ fontSize: 16, fontWeight: '700', color: '#16A34A' }} numberOfLines={1}>
            {formatCurrency(summary.totalIncome)}
          </Text>
        </View>
        {/* Expenses */}
        <View style={{ flex: 1, backgroundColor: '#FEF2F2', borderRadius: 16, padding: 14 }}>
          <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: '#FEE2E2', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
            <MaterialCommunityIcons name="arrow-up-circle" size={20} color="#EF4444" />
          </View>
          <Text style={{ fontSize: 11, color: '#6B7280', marginBottom: 2 }}>Expenses</Text>
          <Text style={{ fontSize: 16, fontWeight: '700', color: '#DC2626' }} numberOfLines={1}>
            {formatCurrency(summary.totalExpense)}
          </Text>
        </View>
        {/* Savings */}
        <View style={{ flex: 1, backgroundColor: '#EFF6FF', borderRadius: 16, padding: 14 }}>
          <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: '#DBEAFE', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
            <MaterialCommunityIcons name="piggy-bank" size={20} color="#2563EB" />
          </View>
          <Text style={{ fontSize: 11, color: '#6B7280', marginBottom: 2 }}>Savings</Text>
          <Text style={{ fontSize: 16, fontWeight: '700', color: '#2563EB' }} numberOfLines={1}>
            {formatCurrency(Math.max(summary.totalIncome - summary.totalExpense, 0))}
          </Text>
        </View>
      </View>

      {/* Spending Chart */}
      {summary.categoryBreakdown?.length > 0 && (
        <View
          style={{
            backgroundColor: '#fff',
            borderRadius: 20,
            padding: 20,
            marginBottom: 16,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.06,
            shadowRadius: 6,
            elevation: 2,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <Text style={{ fontSize: 16, fontWeight: '700', color: '#111827' }}>Monthly Spending</Text>
            <MaterialCommunityIcons name="chart-bar" size={18} color="#9CA3AF" />
          </View>
          <Text style={{ fontSize: 12, color: '#9CA3AF', marginBottom: 16 }}>By category</Text>
          <MonthlySpendingChart data={summary.categoryBreakdown} />
        </View>
      )}

      {/* Recent Transactions */}
      {summary.recentTransactions.length > 0 && (
        <View style={{ marginBottom: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <Text style={{ fontSize: 16, fontWeight: '700', color: '#111827' }}>Recent Transactions</Text>
            <Pressable onPress={() => router.push('/transactions')}>
              <Text style={{ fontSize: 13, fontWeight: '600', color: '#2563EB' }}>See All</Text>
            </Pressable>
          </View>
          <View style={{ gap: 8 }}>
            {summary.recentTransactions.map((transaction) => (
              <TransactionRow key={transaction.id} transaction={transaction} />
            ))}
          </View>
        </View>
      )}

      {/* Empty State */}
      {summary.totalIncome === 0 && summary.totalExpense === 0 && (
        <View style={{ alignItems: 'center', paddingVertical: 40 }}>
          <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
            <MaterialCommunityIcons name="wallet-outline" size={36} color="#2563EB" />
          </View>
          <Text style={{ fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 8 }}>Welcome to FinTrack</Text>
          <Text style={{ fontSize: 14, color: '#6B7280', textAlign: 'center', marginBottom: 20, lineHeight: 22 }}>
            Start tracking your finances by adding your first transaction.
          </Text>
           
        </View>
      )}
    </Screen>
  );
}

function MonthlySpendingChart({ data }: { data: { category: string; total: number }[] }) {
  const maxTotal = Math.max(...data.map((d) => d.total), 1);
  const colors = ['#2563EB', '#7C3AED', '#22C55E', '#F59E0B', '#EF4444', '#06B6D4'];

  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 120, gap: 8 }}>
      {data.slice(0, 6).map((item, index) => {
        const height = (item.total / maxTotal) * 90;
        const color = colors[index % colors.length];
        return (
          <View key={index} style={{ flex: 1, alignItems: 'center' }}>
            <Text style={{ fontSize: 9, color: '#9CA3AF', marginBottom: 4 }} numberOfLines={1}>
              {formatCurrency(item.total).replace('₱', '').replace('.00', '')}
            </Text>
            <View
              style={{
                width: '100%',
                borderRadius: 6,
                backgroundColor: color,
                opacity: 0.85,
                minHeight: 4,
                height: Math.max(height, 4),
              }}
            />
            <MaterialCommunityIcons
              name={getCategoryIcon(item.category)}
              size={13}
              color={color}
              style={{ marginTop: 6 }}
            />
          </View>
        );
      })}
    </View>
  );
}

function TransactionRow({ transaction }: { transaction: Transaction }) {
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
      <Text style={{ fontSize: 15, fontWeight: '700', color: isExpense ? '#EF4444' : '#22C55E' }}>
        {isExpense ? '-' : '+'}{formatCurrency(transaction.amount)}
      </Text>
    </View>
  );
}