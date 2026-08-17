import { View, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { Screen, Loader, Button, Card, CategoryIcon } from '@/components/ui';
import { useDashboardSummary } from '../hooks/useDashboard';
import { useAuthStore } from '@/features/auth/store/auth.store';
import { getGreeting, formatCurrency, formatDate, getCategoryIcon } from '@/shared/utils/categories';
import type { Transaction } from '@/features/transactions/types';

export default function DashboardScreen() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const { data, isLoading, isError, refetch, isRefetching } = useDashboardSummary();

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
  const savingsGoal = 12500;

  return (
    <Screen scrollable refreshing={isRefetching} onRefresh={refetch}>
      <View className="pt-1 pb-4">
        <Text className="text-sm text-text-secondary">{getGreeting()},</Text>
        <Text className="text-2xl font-bold text-text">{fullName}</Text>
      </View>

      {/* Balance Card */}
      <Card style={{ marginBottom: 16, backgroundColor: '#2563EB' }}>
        <View className="flex-row items-center justify-between mb-xs">
          <Text className="text-sm text-white/80">Total Available Balance</Text>
          <MaterialCommunityIcons name="wallet" size={24} color="rgba(255,255,255,0.8)" />
        </View>
        <Text className="text-3xl font-bold text-white">
          {formatCurrency(summary.balance)}
        </Text>
        <View className="flex-row items-center mt-sm">
          <MaterialCommunityIcons
            name={summary.balance >= 0 ? 'trending-up' : 'trending-down'}
            size={16}
            color="rgba(255,255,255,0.6)"
          />
          <Text className="text-xs text-white/60 ml-xs">
            {summary.balance >= 0 ? 'Positive' : 'Negative'} balance
          </Text>
        </View>
      </Card>

      {/* Metrics Row */}
      <View className="flex-row gap-sm mb-md">
        <View className="flex-1 bg-success/10 rounded-xl px-md py-sm">
          <MaterialCommunityIcons name="cash-plus" size={20} color="#22C55E" />
          <Text className="text-xs text-text-secondary mt-xs">Monthly Income</Text>
          <Text className="text-lg font-bold text-success">
            {formatCurrency(summary.totalIncome)}
          </Text>
        </View>
        <View className="flex-1 bg-danger/10 rounded-xl px-md py-sm">
          <MaterialCommunityIcons name="cash-minus" size={20} color="#EF4444" />
          <Text className="text-xs text-text-secondary mt-xs">Expenses</Text>
          <Text className="text-lg font-bold text-danger">
            {formatCurrency(summary.totalExpense)}
          </Text>
        </View>
        <View className="flex-1 bg-secondary/10 rounded-xl px-md py-sm">
          <MaterialCommunityIcons name="target" size={20} color="#7C3AED" />
          <Text className="text-xs text-text-secondary mt-xs">Savings Goal</Text>
          <Text className="text-lg font-bold text-secondary">
            {formatCurrency(savingsGoal)}
          </Text>
        </View>
      </View>

      {/* Monthly Spending Chart */}
      <Card style={{ marginBottom: 16 }}>
        <View className="flex-row items-center justify-between mb-sm">
          <Text className="text-lg font-bold text-text">Monthly Spending</Text>
          <MaterialCommunityIcons name="chart-bar" size={20} color="#64748B" />
        </View>
        <Text className="text-xs text-text-secondary mb-md">Jan - Jun</Text>
        <MonthlySpendingChart data={summary.categoryBreakdown} />
      </Card>

      {/* Quick Actions */}
      <View className="flex-row gap-sm mb-md">
        <View className="flex-1">
          <Button
            title="Add Transaction"
            icon="plus"
            onPress={() => router.push('/transactions')}
          />
        </View>
        <View className="flex-1">
          <Button
            title="Budgets"
            variant="outline"
            icon="wallet"
            onPress={() => router.push('/budgets')}
          />
        </View>
      </View>

      {/* Recent Transactions */}
      {summary.recentTransactions.length > 0 && (
        <View className="mb-lg pb-8">
          <View className="flex-row items-center justify-between mb-sm">
            <Text className="text-lg font-bold text-text">Recent Transactions</Text>
            <Pressable onPress={() => router.push('/transactions')}>
              <Text className="text-sm font-semibold text-primary">See All</Text>
            </Pressable>
          </View>
          {summary.recentTransactions.map((transaction) => (
            <View key={transaction.id} className="mb-sm">
              <TransactionRow transaction={transaction} />
            </View>
          ))}
        </View>
      )}

      {/* Empty State */}
      {summary.totalIncome === 0 && summary.totalExpense === 0 && (
        <View className="items-center py-xl pb-8">
          <MaterialCommunityIcons name="wallet-outline" size={48} color="#94A3B8" />
          <Text className="text-lg font-semibold text-text mt-md mb-sm">Welcome to FinTrack</Text>
          <Text className="text-base text-text-secondary text-center mb-md px-lg">
            Start tracking your finances by adding your first transaction.
          </Text>
          <Button
            title="Add Transaction"
            icon="plus"
            onPress={() => router.push('/transactions')}
          />
        </View>
      )}
    </Screen>
  );
}

function MonthlySpendingChart({ data }: { data: { category: string; total: number }[] }) {
  const maxTotal = Math.max(...data.map((d) => d.total), 1);

  return (
    <View className="flex-row items-end h-32 gap-sm">
      {data.slice(0, 6).map((item, index) => {
        const height = (item.total / maxTotal) * 100;
        const colors = ['#2563EB', '#7C3AED', '#22C55E', '#F59E0B', '#EF4444', '#06B6D4'];
        return (
          <View key={index} className="flex-1 items-center">
            <Text className="text-[10px] text-text-secondary mb-xs">
              {formatCurrency(item.total).replace('.00', '')}
            </Text>
            <View
              className="w-full rounded-t-sm"
              style={{
                height: `${Math.max(height, 4)}%`,
                backgroundColor: colors[index % colors.length],
              }}
            />
            <MaterialCommunityIcons
              name={getCategoryIcon(item.category)}
              size={14}
              color={colors[index % colors.length]}
              style={{ marginTop: 4 }}
            />
          </View>
        );
      })}
    </View>
  );
}

function TransactionRow({ transaction }: { transaction: Transaction }) {
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
      <Text className={`text-base font-bold ${amountColor}`}>
        {sign}{formatCurrency(transaction.amount)}
      </Text>
    </View>
  );
}