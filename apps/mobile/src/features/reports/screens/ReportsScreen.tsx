import { useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, RefreshControl, Alert, Share, Platform } from 'react-native';

import { Screen, Loader, Button, Card } from '@/components/ui';
import { useTrends, useCategoryComparison } from '../hooks/useReports';
import { ReportsApi } from '../api/reports.api';
import type { MonthlyTrend, CategoryComparison } from '../types';

type Tab = 'trends' | 'categories' | 'export';

export default function ReportsScreen() {
  const [activeTab, setActiveTab] = useState<Tab>('trends');
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));

  const { data: trends, isLoading: trendsLoading, isError: trendsError, refetch: refetchTrends, isRefetching: trendsRefetching } = useTrends(6);
  const { data: categories, isLoading: categoriesLoading, isError: categoriesError, refetch: refetchCategories, isRefetching: categoriesRefetching } = useCategoryComparison(selectedMonth);

  const isRefetching = trendsRefetching || categoriesRefetching;
  const handleRefresh = useCallback(() => {
    refetchTrends();
    refetchCategories();
  }, [refetchTrends, refetchCategories]);

  const handleExport = useCallback(async () => {
    try {
      const response = await ReportsApi.exportCSV(selectedMonth);
      const csvData = typeof response === 'string' ? response : (response as any).data;

      if (Platform.OS === 'web') {
        const blob = new Blob([csvData], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `transactions_${selectedMonth}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        await Share.share({
          message: csvData,
          title: `Transactions ${selectedMonth}`,
        });
      }
    } catch {
      Alert.alert('Error', 'Failed to export transactions');
    }
  }, [selectedMonth]);

  const navigateMonth = useCallback((direction: -1 | 1) => {
    const [year, month] = selectedMonth.split('-').map(Number);
    const date = new Date(year, month - 1 + direction, 1);
    setSelectedMonth(date.toISOString().slice(0, 7));
  }, [selectedMonth]);

  const tabs: { key: Tab; label: string }[] = [
    { key: 'trends', label: 'Trends' },
    { key: 'categories', label: 'Categories' },
    { key: 'export', label: 'Export' },
  ];

  return (
    <Screen>
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={handleRefresh} />
        }
      >
        {/* Header */}
        <View className="flex-row items-center justify-between mb-md">
          <Text className="text-2xl font-bold text-text">Reports</Text>
        </View>

        {/* Tab Bar */}
        <View className="flex-row bg-border/30 rounded-xl p-xs mb-md">
          {tabs.map((tab) => (
            <TouchableOpacity
              key={tab.key}
              className={`flex-1 py-sm rounded-lg items-center ${
                activeTab === tab.key ? 'bg-primary' : ''
              }`}
              onPress={() => setActiveTab(tab.key)}
            >
              <Text
                className={`text-sm font-semibold ${
                  activeTab === tab.key ? 'text-white' : 'text-text-secondary'
                }`}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Tab Content */}
        {activeTab === 'trends' && (
          <TrendsTab data={trends} isLoading={trendsLoading} isError={trendsError} onRetry={refetchTrends} />
        )}
        {activeTab === 'categories' && (
          <CategoriesTab
            data={categories}
            isLoading={categoriesLoading}
            isError={categoriesError}
            onRetry={refetchCategories}
            selectedMonth={selectedMonth}
            onPrevMonth={() => navigateMonth(-1)}
            onNextMonth={() => navigateMonth(1)}
          />
        )}
        {activeTab === 'export' && (
          <ExportTab
            selectedMonth={selectedMonth}
            onPrevMonth={() => navigateMonth(-1)}
            onNextMonth={() => navigateMonth(1)}
            onExport={handleExport}
          />
        )}
      </ScrollView>
    </Screen>
  );
}

function TrendsTab({
  data,
  isLoading,
  isError,
  onRetry,
}: {
  data: MonthlyTrend[] | undefined;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
}) {
  if (isLoading) return <Loader />;
  if (isError) {
    return (
      <View className="items-center py-xl">
        <Text className="text-text-secondary mb-md">Failed to load trends</Text>
        <Button title="Retry" onPress={onRetry} />
      </View>
    );
  }
  if (!data || data.length === 0) {
    return (
      <View className="items-center py-xl">
        <Text className="text-lg font-semibold text-text mb-sm">No data yet</Text>
        <Text className="text-base text-text-secondary text-center px-lg">
          Add some transactions to see your monthly trends.
        </Text>
      </View>
    );
  }

  const maxValue = Math.max(...data.map((t) => Math.max(t.income, t.expense, Math.abs(t.net))), 1);

  return (
    <View>
      <Text className="text-lg font-bold text-text mb-md">Monthly Trends (Last 6 Months)</Text>

      {/* Bar Chart */}
      {data.map((trend) => {
        const incomeHeight = (trend.income / maxValue) * 100;
        const expenseHeight = (trend.expense / maxValue) * 100;
        const netHeight = (Math.abs(trend.net) / maxValue) * 100;

        return (
          <Card key={trend.month} style={{ marginBottom: 12 }}>
            <Text className="text-sm font-semibold text-text mb-sm">
              {formatMonth(trend.month)}
            </Text>
            <View className="flex-row items-end h-24 gap-sm mb-xs">
              {/* Income bar */}
              <View className="flex-1 items-center">
                <Text className="text-xs text-success font-semibold mb-xs">
                  ${trend.income.toFixed(0)}
                </Text>
                <View
                  className="w-full bg-success rounded-t-sm"
                  style={{ height: `${Math.max(incomeHeight, 2)}%` }}
                />
                <Text className="text-xs text-text-secondary mt-xs">Income</Text>
              </View>
              {/* Expense bar */}
              <View className="flex-1 items-center">
                <Text className="text-xs text-danger font-semibold mb-xs">
                  ${trend.expense.toFixed(0)}
                </Text>
                <View
                  className="w-full bg-danger rounded-t-sm"
                  style={{ height: `${Math.max(expenseHeight, 2)}%` }}
                />
                <Text className="text-xs text-text-secondary mt-xs">Expense</Text>
              </View>
              {/* Net bar */}
              <View className="flex-1 items-center">
                <Text className={`text-xs font-semibold mb-xs ${trend.net >= 0 ? 'text-success' : 'text-danger'}`}>
                  ${Math.abs(trend.net).toFixed(0)}
                </Text>
                <View
                  className={`w-full rounded-t-sm ${trend.net >= 0 ? 'bg-success/50' : 'bg-danger/50'}`}
                  style={{ height: `${Math.max(netHeight, 2)}%` }}
                />
                <Text className="text-xs text-text-secondary mt-xs">Net</Text>
              </View>
            </View>
          </Card>
        );
      })}
    </View>
  );
}

function CategoriesTab({
  data,
  isLoading,
  isError,
  onRetry,
  selectedMonth,
  onPrevMonth,
  onNextMonth,
}: {
  data: CategoryComparison[] | undefined;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  selectedMonth: string;
  onPrevMonth: () => void;
  onNextMonth: () => void;
}) {
  if (isLoading) return <Loader />;
  if (isError) {
    return (
      <View className="items-center py-xl">
        <Text className="text-text-secondary mb-md">Failed to load categories</Text>
        <Button title="Retry" onPress={onRetry} />
      </View>
    );
  }

  const incomeCategories = data?.filter((c) => c.type === 'income') ?? [];
  const expenseCategories = data?.filter((c) => c.type === 'expense') ?? [];

  return (
    <View>
      {/* Month Picker */}
      <View className="flex-row items-center justify-between mb-md">
        <Button title="<" variant="outline" onPress={onPrevMonth} />
        <Text className="text-base font-semibold text-text">{formatMonth(selectedMonth)}</Text>
        <Button title=">" variant="outline" onPress={onNextMonth} />
      </View>

      {data && data.length === 0 && (
        <View className="items-center py-xl">
          <Text className="text-lg font-semibold text-text mb-sm">No transactions</Text>
          <Text className="text-base text-text-secondary text-center px-lg">
            No transactions found for this month.
          </Text>
        </View>
      )}

      {/* Income Categories */}
      {incomeCategories.length > 0 && (
        <View className="mb-md">
          <Text className="text-lg font-bold text-text mb-sm">Income</Text>
          {incomeCategories.map((cat, index) => (
            <CategoryComparisonCard key={`${cat.category}-${index}`} item={cat} />
          ))}
        </View>
      )}

      {/* Expense Categories */}
      {expenseCategories.length > 0 && (
        <View className="mb-md">
          <Text className="text-lg font-bold text-text mb-sm">Expenses</Text>
          {expenseCategories.map((cat, index) => (
            <CategoryComparisonCard key={`${cat.category}-${index}`} item={cat} />
          ))}
        </View>
      )}
    </View>
  );
}

function CategoryComparisonCard({ item }: { item: CategoryComparison }) {
  const isIncome = item.type === 'income';
  const color = isIncome ? 'text-success' : 'text-danger';
  const bgColor = isIncome ? 'bg-success/10' : 'bg-danger/10';
  const barColor = isIncome ? 'bg-success' : 'bg-danger';
  const maxTotal = Math.max(item.currentMonthTotal, item.previousMonthTotal, 1);
  const currentWidth = (item.currentMonthTotal / maxTotal) * 100;
  const prevWidth = (item.previousMonthTotal / maxTotal) * 100;

  return (
    <Card style={{ marginBottom: 8 }}>
      <View className="flex-row items-center justify-between mb-sm">
        <Text className="text-sm font-semibold text-text">
          {getCategoryEmoji(item.category)} {item.category}
        </Text>
        <View className="flex-row items-center gap-xs">
          <Text className={`text-sm font-semibold ${color}`}>
            {isIncome ? '+' : '-'}${item.currentMonthTotal.toFixed(2)}
          </Text>
          {item.previousMonthTotal > 0 && (
            <Text className={`text-xs ${item.change >= 0 ? 'text-success' : 'text-danger'}`}>
              ({item.change >= 0 ? '+' : ''}{item.changePercent.toFixed(0)}%)
            </Text>
          )}
        </View>
      </View>

      {/* Current month bar */}
      <View className="mb-xs">
        <View className="flex-row justify-between mb-xs">
          <Text className="text-xs text-text-secondary">This month</Text>
          <Text className={`text-xs font-semibold ${color}`}>
            ${item.currentMonthTotal.toFixed(2)}
          </Text>
        </View>
        <View className={`h-2 rounded-full ${bgColor}`}>
          <View
            className={`h-full rounded-full ${barColor}`}
            style={{ width: `${currentWidth}%` }}
          />
        </View>
      </View>

      {/* Previous month bar */}
      {item.previousMonthTotal > 0 && (
        <View>
          <View className="flex-row justify-between mb-xs">
            <Text className="text-xs text-text-secondary">Last month</Text>
            <Text className="text-xs text-text-secondary">
              ${item.previousMonthTotal.toFixed(2)}
            </Text>
          </View>
          <View className="h-2 rounded-full bg-border/30">
            <View
              className="h-full rounded-full bg-border"
              style={{ width: `${prevWidth}%` }}
            />
          </View>
        </View>
      )}
    </Card>
  );
}

function ExportTab({
  selectedMonth,
  onPrevMonth,
  onNextMonth,
  onExport,
}: {
  selectedMonth: string;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onExport: () => void;
}) {
  return (
    <View>
      <Text className="text-lg font-bold text-text mb-md">Export Transactions</Text>
      <Text className="text-sm text-text-secondary mb-md">
        Download your transactions as a CSV file for the selected month.
      </Text>

      {/* Month Picker */}
      <View className="flex-row items-center justify-between mb-lg">
        <Button title="<" variant="outline" onPress={onPrevMonth} />
        <Text className="text-base font-semibold text-text">{formatMonth(selectedMonth)}</Text>
        <Button title=">" variant="outline" onPress={onNextMonth} />
      </View>

      <Button title={`Export ${formatMonth(selectedMonth)} as CSV`} onPress={onExport} />

      <Text className="text-xs text-text-secondary text-center mt-md">
        The CSV file will contain all transactions for the selected month including date, type, amount, category, and description.
      </Text>
    </View>
  );
}

function formatMonth(month: string): string {
  const [year, m] = month.split('-');
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  return `${months[parseInt(m, 10) - 1]} ${year}`;
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