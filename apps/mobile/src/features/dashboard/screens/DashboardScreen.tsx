import { View, Text, ScrollView, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';

import { Screen, Loader, Button, Card } from '@/components/ui';
import { useDashboardSummary } from '../hooks/useDashboard';
import TransactionItem from '@/features/transactions/components/TransactionItem';

export default function DashboardScreen() {
  const router = useRouter();
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
        <View className="flex-1 items-center justify-center">
          <Text className="text-text-secondary mb-md">Failed to load dashboard</Text>
          <Button title="Retry" onPress={() => refetch()} />
        </View>
      </Screen>
    );
  }

  const summary = data!;
  const incomeRatio = summary.totalIncome + summary.totalExpense > 0
    ? (summary.totalIncome / (summary.totalIncome + summary.totalExpense)) * 100
    : 0;
  const expenseRatio = summary.totalIncome + summary.totalExpense > 0
    ? (summary.totalExpense / (summary.totalIncome + summary.totalExpense)) * 100
    : 0;

  return (
    <Screen>
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
        }
      >
        {/* Header */}
        <View className="flex-row items-center justify-between mb-md">
          <Text className="text-2xl font-bold text-text">Dashboard</Text>
        </View>

        {/* Balance Card */}
        <Card style={{ marginBottom: 16 }}>
          <Text className="text-sm text-text-secondary mb-xs">Current Balance</Text>
          <Text className={`text-3xl font-bold ${summary.balance >= 0 ? 'text-success' : 'text-danger'}`}>
            ${Math.abs(summary.balance).toFixed(2)}
          </Text>
          {summary.balance < 0 && (
            <Text className="text-xs text-danger mt-xs">{`You're in the red`}</Text>
          )}
        </Card>

        {/* Income & Expense Cards */}
        <View className="flex-row gap-sm mb-md">
          <View className="flex-1 bg-success/10 rounded-xl px-md py-sm">
            <Text className="text-xs text-text-secondary">Income</Text>
            <Text className="text-xl font-bold text-success">
              ${summary.totalIncome.toFixed(2)}
            </Text>
            {summary.totalIncome + summary.totalExpense > 0 && (
              <View className="h-1 bg-success/30 rounded-full mt-xs">
                <View
                  className="h-full bg-success rounded-full"
                  style={{ width: `${incomeRatio}%` }}
                />
              </View>
            )}
          </View>
          <View className="flex-1 bg-danger/10 rounded-xl px-md py-sm">
            <Text className="text-xs text-text-secondary">Expenses</Text>
            <Text className="text-xl font-bold text-danger">
              ${summary.totalExpense.toFixed(2)}
            </Text>
            {summary.totalIncome + summary.totalExpense > 0 && (
              <View className="h-1 bg-danger/30 rounded-full mt-xs">
                <View
                  className="h-full bg-danger rounded-full"
                  style={{ width: `${expenseRatio}%` }}
                />
              </View>
            )}
          </View>
        </View>

        {/* Quick Actions */}
        <View className="flex-row gap-sm mb-md">
          <View className="flex-1">
            <Button
              title="Add Transaction"
              onPress={() => router.push('/transactions')}
            />
          </View>
        </View>

        {/* Category Breakdown */}
        {summary.categoryBreakdown.length > 0 && (
          <View className="mb-md">
            <Text className="text-lg font-bold text-text mb-sm">Category Breakdown</Text>
            {summary.categoryBreakdown.map((cat, index) => (
              <CategoryBar key={`${cat.category}-${index}`} {...cat} />
            ))}
          </View>
        )}

        {/* Recent Transactions */}
        {summary.recentTransactions.length > 0 && (
          <View className="mb-lg">
            <View className="flex-row items-center justify-between mb-sm">
              <Text className="text-lg font-bold text-text">Recent Transactions</Text>
              <Button
                title="View All"
                variant="outline"
                onPress={() => router.push('/transactions')}
              />
            </View>
            {summary.recentTransactions.map((transaction) => (
              <View key={transaction.id} className="mb-sm">
                <TransactionItem
                  transaction={transaction}
                  onEdit={() => {}}
                  onDelete={() => {}}
                />
              </View>
            ))}
          </View>
        )}

        {/* Empty State */}
        {summary.totalIncome === 0 && summary.totalExpense === 0 && (
          <View className="items-center py-xl">
            <Text className="text-lg font-semibold text-text mb-sm">Welcome to Finance Tracker</Text>
            <Text className="text-base text-text-secondary text-center mb-md px-lg">
              Start tracking your finances by adding your first transaction.
            </Text>
            <Button
              title="Add Transaction"
              onPress={() => router.push('/transactions')}
            />
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

function CategoryBar({ category, type, total, count }: {
  category: string;
  type: 'income' | 'expense';
  total: number;
  count: number;
}) {
  const isIncome = type === 'income';
  const color = isIncome ? 'bg-success' : 'bg-danger';
  const barColor = isIncome ? 'bg-success/20' : 'bg-danger/20';

  return (
    <View className="mb-sm">
      <View className="flex-row items-center justify-between mb-xs">
        <Text className="text-sm text-text flex-1">{getCategoryEmoji(category)} {category}</Text>
        <Text className={`text-sm font-semibold ${isIncome ? 'text-success' : 'text-danger'}`}>
          {isIncome ? '+' : '-'}${total.toFixed(2)}
        </Text>
      </View>
      <View className={`h-2 rounded-full ${barColor}`}>
        <View
          className={`h-full rounded-full ${color}`}
          style={{ width: `${Math.min((total / 1000) * 100, 100)}%` }}
        />
      </View>
      <Text className="text-xs text-text-secondary mt-xs">{count} transaction{count !== 1 ? 's' : ''}</Text>
    </View>
  );
}

function getCategoryEmoji(category: string): string {
  const emojiMap: Record<string, string> = {
    'Food & Drinks': '🍔',
    Transportation: '🚗',
    Shopping: '🛍️',
    Entertainment: '🎬',
    'Bills & Utilities': '📄',
    Housing: '🏠',
    Health: '💊',
    Education: '📚',
    Salary: '💰',
    Freelance: '💻',
    Investment: '📈',
  };
  return emojiMap[category] || '💳';
}