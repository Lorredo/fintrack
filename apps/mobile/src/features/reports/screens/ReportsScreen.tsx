import { useCallback, useState } from 'react';
import { View, Text, ScrollView, RefreshControl, Alert, Share, Platform, Pressable } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { Screen, Loader, Button, ProgressBar } from '@/components/ui';
import { useTrends, useCategoryComparison } from '../hooks/useReports';
import { ReportsApi } from '../api/reports.api';
import type { MonthlyTrend, CategoryComparison } from '../types';
import { formatCurrency, formatMonth, getCategoryColor } from '@/shared/utils/categories';

type Period = 'weekly' | 'monthly' | 'yearly';

export default function ReportsScreen() {
  const [period, setPeriod] = useState<Period>('monthly');
  const [referenceDate, setReferenceDate] = useState(new Date().toISOString().slice(0, 10)); // Full YYYY-MM-DD so Weekly knows exactly what day it is

  const { data: trends, isLoading: trendsLoading, isError: trendsError, refetch: refetchTrends, isRefetching: trendsRefetching } = useTrends(6, period);
  const { data: categories, isLoading: categoriesLoading, isError: categoriesError, refetch: refetchCategories, isRefetching: categoriesRefetching } = useCategoryComparison(referenceDate, period);

  const isRefetching = trendsRefetching || categoriesRefetching;
  const handleRefresh = useCallback(() => {
    refetchTrends();
    refetchCategories();
  }, [refetchTrends, refetchCategories]);

  const handleExport = useCallback(async (format: 'pdf' | 'excel') => {
    try {
      const response = await ReportsApi.exportCSV(referenceDate.slice(0, 7)); // API still expects YYYY-MM for export
      const csvData = typeof response === 'string' ? response : (response as any).data;
      if (Platform.OS === 'web') {
        const blob = new Blob([csvData], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `transactions_${referenceDate.slice(0, 7)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        await Share.share({ message: csvData, title: `Transactions ${referenceDate.slice(0, 7)}` });
      }
    } catch {
      Alert.alert('Error', `Failed to export ${format.toUpperCase()}`);
    }
  }, [referenceDate]);

  const periodOptions: { label: string; value: Period }[] = [
    { label: 'Weekly', value: 'weekly' },
    { label: 'Monthly', value: 'monthly' },
    { label: 'Yearly', value: 'yearly' },
  ];

  return (
    <Screen>
      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={handleRefresh} tintColor="#2563EB" />
        }
      >
        {/* Header */}
        <View style={{ paddingTop: 16, paddingBottom: 4 }}>
          <Text style={{ fontSize: 26, fontWeight: '700', color: '#111827', letterSpacing: -0.5 }}>Reports</Text>
          <Text style={{ fontSize: 13, color: '#6B7280', marginTop: 2 }}>Your financial overview</Text>
        </View>

        {/* Period Tabs */}
        <View style={{ flexDirection: 'row', gap: 0, marginVertical: 16, backgroundColor: '#EAECF0', borderRadius: 14, padding: 4 }}>
          {periodOptions.map((opt) => {
            const isActive = period === opt.value;
            return (
              <Pressable
                key={opt.value}
                style={{
                  flex: 1,
                  paddingVertical: 9,
                  borderRadius: 10,
                  backgroundColor: isActive ? '#fff' : 'transparent',
                  alignItems: 'center',
                  shadowColor: isActive ? '#000' : 'transparent',
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: isActive ? 0.08 : 0,
                  shadowRadius: 4,
                  elevation: isActive ? 2 : 0,
                }}
                onPress={() => setPeriod(opt.value)}
              >
                <Text style={{ fontSize: 13, fontWeight: '600', color: isActive ? '#111827' : '#6B7280' }}>
                  {opt.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Spending Breakdown Card */}
        <View style={sectionCard}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <Text style={sectionTitle}>Spending Breakdown</Text>
            <MaterialCommunityIcons name="chart-donut" size={18} color="#9CA3AF" />
          </View>
          <Text style={sectionSubtitle}>
            {period === 'weekly' ? 'This Week' : period === 'yearly' ? new Date(referenceDate).getFullYear() : formatMonth(referenceDate)}
          </Text>
          <View style={{ marginTop: 16 }}>
            {categoriesLoading ? (
              <Loader />
            ) : categoriesError ? (
              <View style={{ alignItems: 'center', paddingVertical: 16 }}>
                <Text style={{ color: '#6B7280', marginBottom: 8 }}>Failed to load categories</Text>
                <Button title="Retry" variant="outline" onPress={() => refetchCategories()} />
              </View>
            ) : (
              <SpendingBreakdown data={categories ?? []} />
            )}
          </View>
        </View>

        {/* Income vs Expenses Card */}
        <View style={sectionCard}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <Text style={sectionTitle}>Income vs Expenses</Text>
            <MaterialCommunityIcons name="chart-bar" size={18} color="#9CA3AF" />
          </View>
          <Text style={sectionSubtitle}>Last 6 months</Text>
          <View style={{ marginTop: 16 }}>
            {trendsLoading ? (
              <Loader />
            ) : trendsError ? (
              <View style={{ alignItems: 'center', paddingVertical: 16 }}>
                <Text style={{ color: '#6B7280', marginBottom: 8 }}>Failed to load trends</Text>
                <Button title="Retry" variant="outline" onPress={() => refetchTrends()} />
              </View>
            ) : (
              <IncomeExpenseChart data={trends ?? []} period={period} />
            )}
          </View>
        </View>

        {/* Trajectory Card */}
        <View style={sectionCard}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <Text style={sectionTitle}>Spending Trajectory</Text>
            <MaterialCommunityIcons name="trending-up" size={18} color="#9CA3AF" />
          </View>
          <Text style={sectionSubtitle}>Net savings trend</Text>
          <View style={{ marginTop: 16 }}>
            {trendsLoading ? <Loader /> : <TrajectoryChart data={trends ?? []} period={period} />}
          </View>
        </View>

        {/* Export Card */}
        <View style={{ ...sectionCard, marginBottom: 40 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <View>
              <Text style={sectionTitle}>Export Report</Text>
              <Text style={{ ...sectionSubtitle, marginTop: 2 }}>Download your financial data</Text>
            </View>
            <MaterialCommunityIcons name="download" size={20} color="#9CA3AF" />
          </View>
          <View style={{ gap: 10 }}>
            <Pressable
              style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#FEF2F2', borderRadius: 14, padding: 14 }}
              onPress={() => handleExport('pdf')}
            >
              <View style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: '#FEE2E2', alignItems: 'center', justifyContent: 'center' }}>
                <MaterialCommunityIcons name="file-pdf-box" size={22} color="#EF4444" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: '#111827' }}>Export as PDF</Text>
                <Text style={{ fontSize: 12, color: '#9CA3AF' }}>Printable report</Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={20} color="#9CA3AF" />
            </Pressable>
            <Pressable
              style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#F0FDF4', borderRadius: 14, padding: 14 }}
              onPress={() => handleExport('excel')}
            >
              <View style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: '#DCFCE7', alignItems: 'center', justifyContent: 'center' }}>
                <MaterialCommunityIcons name="file-excel-box" size={22} color="#22C55E" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: '#111827' }}>Export as Excel</Text>
                <Text style={{ fontSize: 12, color: '#9CA3AF' }}>Spreadsheet format</Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={20} color="#9CA3AF" />
            </Pressable>
          </View>
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
      <View style={{ alignItems: 'center', paddingVertical: 16 }}>
        <Text style={{ color: '#6B7280' }}>No expense data for this period</Text>
      </View>
    );
  }

  return (
    <View style={{ gap: 14 }}>
      {expenseCategories.map((cat, index) => {
        const percent = (cat.currentMonthTotal / totalExpense) * 100;
        const color = getCategoryColor(cat.category);
        return (
          <View key={`${cat.category}-${index}`}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
                <Text style={{ fontSize: 14, fontWeight: '500', color: '#111827' }}>{cat.category}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: '#111827' }}>
                  {formatCurrency(cat.currentMonthTotal)}
                </Text>
                <Text style={{ fontSize: 11, color: '#9CA3AF' }}>{percent.toFixed(0)}%</Text>
              </View>
            </View>
            <ProgressBar progress={percent} color={color} height={6} />
          </View>
        );
      })}
    </View>
  );
}

function IncomeExpenseChart({ data, period }: { data: MonthlyTrend[], period: string }) {
  const maxValue = Math.max(...data.map((t) => Math.max(t.income, t.expense)), 1);

  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8, height: 100 }}>
        {data.map((trend, i) => {
          const incH = (trend.income / maxValue) * 80;
          const expH = (trend.expense / maxValue) * 80;
          
          let monthLabel = '';
          const d = new Date(trend.month);
          if (period === 'yearly') {
            monthLabel = d.getFullYear().toString();
          } else if (period === 'weekly') {
            monthLabel = `${d.getDate()} ${d.toLocaleDateString('en-US', { month: 'short' })}`;
          } else {
            monthLabel = d.toLocaleDateString('en-US', { month: 'short' });
          }

          return (
            <View key={i} style={{ flex: 1, alignItems: 'center' }}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 2, height: 80 }}>
                <View style={{ width: '45%', height: Math.max(incH, 2), borderRadius: 4, backgroundColor: '#22C55E' }} />
                <View style={{ width: '45%', height: Math.max(expH, 2), borderRadius: 4, backgroundColor: '#EF4444' }} />
              </View>
              <Text style={{ fontSize: 9, color: '#9CA3AF', marginTop: 4, textAlign: 'center' }} numberOfLines={1}>{monthLabel}</Text>
            </View>
          );
        })}
      </View>
      <View style={{ flexDirection: 'row', gap: 16, marginTop: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: '#22C55E' }} />
          <Text style={{ fontSize: 12, color: '#6B7280' }}>Income</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: '#EF4444' }} />
          <Text style={{ fontSize: 12, color: '#6B7280' }}>Expense</Text>
        </View>
      </View>
    </View>
  );
}

function TrajectoryChart({ data, period }: { data: MonthlyTrend[], period: string }) {
  const maxNet = Math.max(...data.map((t) => Math.abs(t.net)), 1);

  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8, height: 80 }}>
        {data.map((trend, i) => {
          const netHeight = (Math.abs(trend.net) / maxNet) * 64;
          const isPositive = trend.net >= 0;
          
          let monthLabel = '';
          const d = new Date(trend.month);
          if (period === 'yearly') {
            monthLabel = d.getFullYear().toString();
          } else if (period === 'weekly') {
            monthLabel = `${d.getDate()} ${d.toLocaleDateString('en-US', { month: 'short' })}`;
          } else {
            monthLabel = d.toLocaleDateString('en-US', { month: 'short' });
          }

          return (
            <View key={i} style={{ flex: 1, alignItems: 'center' }}>
              <View
                style={{
                  width: '80%',
                  height: Math.max(netHeight, 2),
                  borderRadius: 4,
                  backgroundColor: isPositive ? '#22C55E' : '#EF4444',
                  opacity: 0.85,
                }}
              />
              <Text style={{ fontSize: 9, color: '#9CA3AF', marginTop: 4, textAlign: 'center' }} numberOfLines={1}>{monthLabel}</Text>
            </View>
          );
        })}
      </View>
      <View style={{ flexDirection: 'row', gap: 16, marginTop: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: '#22C55E' }} />
          <Text style={{ fontSize: 12, color: '#6B7280' }}>Net Savings</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: '#EF4444' }} />
          <Text style={{ fontSize: 12, color: '#6B7280' }}>Net Loss</Text>
        </View>
      </View>
    </View>
  );
}

const sectionCard = {
  backgroundColor: '#fff',
  borderRadius: 20,
  padding: 20,
  marginBottom: 14,
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 1 },
  shadowOpacity: 0.06,
  shadowRadius: 6,
  elevation: 2,
} as const;

const sectionTitle = {
  fontSize: 16,
  fontWeight: '700' as const,
  color: '#111827',
};

const sectionSubtitle = {
  fontSize: 12,
  color: '#9CA3AF',
};
