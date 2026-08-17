import { useState, useCallback } from 'react';
import { View, Text, ScrollView, RefreshControl, Alert, Share, Platform } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { Screen, Loader, Button, Card, SegmentedControl, ProgressBar } from '@/components/ui';
import { useTrends, useCategoryComparison } from '../hooks/useReports';
import { ReportsApi } from '../api/reports.api';
import type { MonthlyTrend, CategoryComparison } from '../types';
import { formatCurrency, formatMonth, getCategoryIcon, getCategoryColor } from '@/shared/utils/categories';

type Period = 'weekly' | 'monthly' | 'yearly';

export default function ReportsScreen() {
  const [period, setPeriod] = useState<Period>('monthly');
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));

  const { data: trends, isLoading: trendsLoading, isError: trendsError, refetch: refetchTrends, isRefetching: trendsRefetching } = useTrends(6);
  const { data: categories, isLoading: categoriesLoading, isError: categoriesError, refetch: refetchCategories, isRefetching: categoriesRefetching } = useCategoryComparison(selectedMonth);

  const isRefetching = trendsRefetching || categoriesRefetching;
  const handleRefresh = useCallback(() => {
    refetchTrends();
    refetchCategories();
  }, [refetchTrends, refetchCategories]);

  const handleExport = useCallback(async (format: 'pdf' | 'excel') => {
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
      Alert.alert('Error', `Failed to export ${format.toUpperCase()}`);
    }
  }, [selectedMonth]);

  const periodOptions = [
    { label: 'Weekly', value: 'weekly' as Period },
    { label: 'Monthly', value: 'monthly' as Period },
    { label: 'Yearly', value: 'yearly' as Period },
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
          <MaterialCommunityIcons name="chart-pie" size={24} color="#2563EB" />
        </View>

        {/* Period Tabs */}
        <View className="mb-md">
          <SegmentedControl
            options={periodOptions}
            value={period}
            onChange={setPeriod}
          />
        </View>

        {/* Spending Breakdown */}
        <Card style={{ marginBottom: 16 }}>
          <View className="flex-row items-center justify-between mb-sm">
            <Text className="text-lg font-bold text-text">Spending Breakdown</Text>
            <MaterialCommunityIcons name="chart-donut" size={20} color="#64748B" />
          </View>
          <Text className="text-xs text-text-secondary mb-md">{formatMonth(selectedMonth)}</Text>
          {categoriesLoading ? (
            <Loader />
          ) : categoriesError ? (
            <View className="items-center py-md">
              <Text className="text-text-secondary mb-sm">Failed to load categories</Text>
              <Button title="Retry" variant="outline" onPress={() => refetchCategories()} />
            </View>
          ) : (
            <SpendingBreakdown data={categories ?? []} />
          )}
        </Card>

        {/* Income vs Expenses */}
        <Card style={{ marginBottom: 16 }}>
          <View className="flex-row items-center justify-between mb-sm">
            <Text className="text-lg font-bold text-text">Income vs Expenses</Text>
            <MaterialCommunityIcons name="chart-bar" size={20} color="#64748B" />
          </View>
          <Text className="text-xs text-text-secondary mb-md">Last 6 months</Text>
          {trendsLoading ? (
            <Loader />
          ) : trendsError ? (
            <View className="items-center py-md">
              <Text className="text-text-secondary mb-sm">Failed to load trends</Text>
              <Button title="Retry" variant="outline" onPress={() => refetchTrends()} />
            </View>
          ) : (
            <IncomeExpenseChart data={trends ?? []} />
          )}
        </Card>

        {/* Spending Trajectory */}
        <Card style={{ marginBottom: 16 }}>
          <View className="flex-row items-center justify-between mb-sm">
            <Text className="text-lg font-bold text-text">Spending Trajectory</Text>
            <MaterialCommunityIcons name="chart-line" size={20} color="#64748B" />
          </View>
          <Text className="text-xs text-text-secondary mb-md">Net savings trend</Text>
          {trendsLoading ? (
            <Loader />
          ) : (
            <TrajectoryChart data={trends ?? []} />
          )}
        </Card>

        {/* Export Buttons */}
        <View className="mb-lg">
          <Text className="text-lg font-bold text-text mb-sm">Export</Text>
          <View className="flex-row gap-sm">
            <View className="flex-1">
              <Button
                title="Export PDF"
                variant="outline"
                icon="file-pdf-box"
                onPress={() => handleExport('pdf')}
              />
            </View>
            <View className="flex-1">
              <Button
                title="Export Excel"
                variant="outline"
                icon="file-excel-box"
                onPress={() => handleExport('excel')}
              />
            </View>
          </View>
          <Text className="text-xs text-text-secondary text-center mt-sm">
            Export your financial data for the selected period
          </Text>
        </View>
      </ScrollView>
    </Screen>
  );
}

function SpendingBreakdown({ data }: { data: CategoryComparison[] }) {
  const expenseCategories = data.filter((c) => c.type === 'expense');
  const totalExpense = expenseCategories.reduce((sum, c) => sum + c.currentMonthTotal, 0);

  if (totalExpense === 0) {
    return (
      <View className="items-center py-md">
        <Text className="text-text-secondary">No expense data for this period</Text>
      </View>
    );
  }

  return (
    <View>
      {expenseCategories.map((cat, index) => {
        const percent = (cat.currentMonthTotal / totalExpense) * 100;
        const color = getCategoryColor(cat.category);
        return (
          <View key={`${cat.category}-${index}`} className="mb-sm">
            <View className="flex-row items-center justify-between mb-xs">
              <View className="flex-row items-center gap-sm">
                <MaterialCommunityIcons name={getCategoryIcon(cat.category)} size={18} color={color} />
                <Text className="text-sm font-semibold text-text">{cat.category}</Text>
              </View>
              <View className="flex-row items-center gap-sm">
                <Text className="text-sm font-semibold text-text">
                  {formatCurrency(cat.currentMonthTotal)}
                </Text>
                <Text className="text-xs text-text-secondary">{percent.toFixed(0)}%</Text>
              </View>
            </View>
            <ProgressBar progress={percent} color={color} height={6} />
          </View>
        );
      })}
    </View>
  );
}

function IncomeExpenseChart({ data }: { data: MonthlyTrend[] }) {
  const maxValue = Math.max(...data.map((t) => Math.max(t.income, t.expense)), 1);

  return (
    <View>
      {data.map((trend) => {
        const incomeHeight = (trend.income / maxValue) * 100;
        const expenseHeight = (trend.expense / maxValue) * 100;
        const monthLabel = new Date(trend.month).toLocaleDateString('en-US', { month: 'short' });

        return (
          <View key={trend.month} className="flex-row items-center mb-sm">
            <Text className="w-10 text-xs text-text-secondary">{monthLabel}</Text>
            <View className="flex-1 flex-row items-end h-16 gap-xs">
              <View className="flex-1 items-end">
                <View
                  className="w-full bg-success rounded-t-sm"
                  style={{ height: `${Math.max(incomeHeight, 2)}%` }}
                />
              </View>
              <View className="flex-1 items-end">
                <View
                  className="w-full bg-danger rounded-t-sm"
                  style={{ height: `${Math.max(expenseHeight, 2)}%` }}
                />
              </View>
            </View>
            <View className="w-16 items-end">
              <Text className="text-[10px] text-success font-semibold">
                {formatCurrency(trend.income).replace('.00', '')}
              </Text>
              <Text className="text-[10px] text-danger font-semibold">
                {formatCurrency(trend.expense).replace('.00', '')}
              </Text>
            </View>
          </View>
        );
      })}
      <View className="flex-row gap-md mt-sm">
        <View className="flex-row items-center gap-xs">
          <View className="w-3 h-3 rounded-full bg-success" />
          <Text className="text-xs text-text-secondary">Income</Text>
        </View>
        <View className="flex-row items-center gap-xs">
          <View className="w-3 h-3 rounded-full bg-danger" />
          <Text className="text-xs text-text-secondary">Expense</Text>
        </View>
      </View>
    </View>
  );
}

function TrajectoryChart({ data }: { data: MonthlyTrend[] }) {
  const maxNet = Math.max(...data.map((t) => Math.abs(t.net)), 1);

  return (
    <View>
      {data.map((trend) => {
        const netHeight = (Math.abs(trend.net) / maxNet) * 100;
        const isPositive = trend.net >= 0;
        const monthLabel = new Date(trend.month).toLocaleDateString('en-US', { month: 'short' });

        return (
          <View key={trend.month} className="flex-row items-center mb-sm">
            <Text className="w-10 text-xs text-text-secondary">{monthLabel}</Text>
            <View className="flex-1 flex-row items-center h-16">
              <View className="flex-1 items-center">
                <View
                  className={`w-full rounded-sm ${isPositive ? 'bg-success/50' : 'bg-danger/50'}`}
                  style={{ height: `${Math.max(netHeight, 2)}%` }}
                />
              </View>
            </View>
            <View className="w-16 items-end">
              <Text className={`text-[10px] font-semibold ${isPositive ? 'text-success' : 'text-danger'}`}>
                {isPositive ? '+' : '-'}{formatCurrency(Math.abs(trend.net)).replace('.00', '')}
              </Text>
            </View>
          </View>
        );
      })}
      <View className="flex-row gap-md mt-sm">
        <View className="flex-row items-center gap-xs">
          <View className="w-3 h-3 rounded-full bg-success/50" />
          <Text className="text-xs text-text-secondary">Net Savings</Text>
        </View>
        <View className="flex-row items-center gap-xs">
          <View className="w-3 h-3 rounded-full bg-danger/50" />
          <Text className="text-xs text-text-secondary">Net Loss</Text>
        </View>
      </View>
    </View>
  );
}