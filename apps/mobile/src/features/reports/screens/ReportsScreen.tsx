import { useCallback, useState, useMemo } from 'react';
import { View, Text, ScrollView, RefreshControl, Platform, Pressable, ActivityIndicator } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';

import { Screen, Loader, Button, ProgressBar, Modal } from '@/components/ui';
import { useTrends, useCategoryComparison } from '../hooks/useReports';
import { ReportExportService, type ExportFormat, type PreparedReport } from '../services/report-export.service';
import type { ReportFilters } from '../api/reports.api';
import type { MonthlyTrend, CategoryComparison } from '../types';
import { formatCurrency, formatMonth, getCategoryColor, formatDateRange, getLocalISODate } from '@/shared/utils/categories';
import { useAccounts } from '@/features/accounts/hooks/useAccounts';
import { useToast } from '@/features/toast/hooks/useToast';
import { isOffline, OFFLINE_MESSAGE } from '@/shared/utils/apiErrors';

export default function ReportsScreen() {
  const router = useRouter();
  const toast = useToast();
  const now = new Date();
  const defaultStartDate = getLocalISODate(new Date(now.getFullYear(), now.getMonth(), 1));
  const defaultEndDate = getLocalISODate(new Date(now.getFullYear(), now.getMonth() + 1, 0));

  const [filters, setFilters] = useState<ReportFilters>({
    startDate: defaultStartDate,
    endDate: defaultEndDate,
  });

  const [showFilters, setShowFilters] = useState(false);
  const [draftFilters, setDraftFilters] = useState<ReportFilters>(filters);
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [exporting, setExporting] = useState<ExportFormat | null>(null);
  const [preparedReport, setPreparedReport] = useState<PreparedReport | null>(null);

  const { data: accounts } = useAccounts();
  const { data: trends, isLoading: trendsLoading, isError: trendsError, refetch: refetchTrends, isRefetching: trendsRefetching } = useTrends(filters);
  const { data: categories, isLoading: categoriesLoading, isError: categoriesError, refetch: refetchCategories, isRefetching: categoriesRefetching } = useCategoryComparison(filters);

  const isRefetching = trendsRefetching || categoriesRefetching;
  const handleRefresh = useCallback(() => {
    refetchTrends();
    refetchCategories();
  }, [refetchTrends, refetchCategories]);

  const handleExport = async (format: ExportFormat) => {
    if (exporting) return;
    if (isOffline()) {
      toast.error(OFFLINE_MESSAGE);
      return;
    }
    setExporting(format);
    try {
      const walletName = accounts?.find((account) => account.id === filters.accountId)?.name;
      const result = await ReportExportService.prepare(filters, format, walletName);
      if (result === 'empty') {
        toast.info('No transactions to export for this period');
      } else if (result !== 'opened') {
        // iOS share sheet already offers Save to Files.
        if (Platform.OS === 'android') {
          setPreparedReport(result);
        } else {
          await ReportExportService.share(result);
        }
      }
    } catch {
      toast.error(`Couldn't create the ${format === 'pdf' ? 'PDF' : 'Excel file'}. Please try again.`);
    } finally {
      setExporting(null);
    }
  };

  const handleSaveReport = async (report: PreparedReport) => {
    setPreparedReport(null);
    try {
      await ReportExportService.saveToDevice(report);
      toast.success('Report saved');
    } catch (err: unknown) {
      if (err instanceof Error && err.message.includes('cancelled')) {
        setPreparedReport(report);
      } else {
        toast.error("Couldn't save the report. Please try again.");
      }
    }
  };

  const handleShareReport = async (report: PreparedReport) => {
    setPreparedReport(null);
    try {
      await ReportExportService.share(report);
    } catch {
      toast.error("Couldn't share the report. Please try again.");
    }
  };

  const setDateRange = (range: 'today' | 'yesterday' | 'this_week' | 'last_week' | 'this_month' | 'last_month' | 'this_year' | 'all_time') => {
    const d = new Date();
    let start, end;
    switch(range) {
      case 'today':
        start = getLocalISODate(d);
        end = start;
        break;
      case 'yesterday':
        d.setDate(d.getDate() - 1);
        start = getLocalISODate(d);
        end = start;
        break;
      case 'this_week':
        const day = d.getDay();
        const diff = d.getDate() - day + (day == 0 ? -6 : 1); 
        start = getLocalISODate(new Date(d.setDate(diff)));
        end = getLocalISODate(new Date(new Date(start).setDate(new Date(start).getDate() + 6)));
        break;
      case 'last_week':
        const lw = new Date();
        const lwDay = lw.getDay();
        const lwDiff = lw.getDate() - lwDay + (lwDay == 0 ? -6 : 1) - 7;
        start = getLocalISODate(new Date(lw.setDate(lwDiff)));
        end = getLocalISODate(new Date(new Date(start).setDate(new Date(start).getDate() + 6)));
        break;
      case 'this_month':
        start = getLocalISODate(new Date(d.getFullYear(), d.getMonth(), 1));
        end = getLocalISODate(new Date(d.getFullYear(), d.getMonth() + 1, 0));
        break;
      case 'last_month':
        start = getLocalISODate(new Date(d.getFullYear(), d.getMonth() - 1, 1));
        end = getLocalISODate(new Date(d.getFullYear(), d.getMonth(), 0));
        break;
      case 'this_year':
        start = getLocalISODate(new Date(d.getFullYear(), 0, 1));
        end = getLocalISODate(new Date(d.getFullYear(), 11, 31));
        break;
      case 'all_time':
        start = '2000-01-01';
        end = getLocalISODate(new Date(d.getFullYear() + 1, 0, 1));
        break;
    }
    setDraftFilters({ ...draftFilters, startDate: start, endDate: end });
  };

  const getRangeLabel = () => {
    return formatDateRange(filters.startDate, filters.endDate);
  };

  return (
    <Screen>
      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={handleRefresh} tintColor="#2563EB" />
        }
      >
        <View style={{ paddingTop: 16, paddingBottom: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View>
              <Text style={{ fontSize: 26, fontWeight: '700', color: '#111827', letterSpacing: -0.5 }}>Reports</Text>
              <Text style={{ fontSize: 13, color: '#6B7280', marginTop: 2 }}>{getRangeLabel()}</Text>
            </View>
            <Pressable
              onPress={() => { setDraftFilters(filters); setShowFilters(true); }}
              style={{
                width: 44,
                height: 44,
                backgroundColor: (filters.accountId || filters.type) ? '#EFF6FF' : '#fff',
                borderRadius: 16,
                alignItems: 'center',
                justifyContent: 'center',
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.06,
                shadowRadius: 6,
                elevation: 2,
                borderWidth: (filters.accountId || filters.type) ? 1 : 0,
                borderColor: '#2563EB',
              }}
            >
              <MaterialCommunityIcons 
                name="filter-variant" 
                size={22} 
                color={(filters.accountId || filters.type) ? '#2563EB' : '#6B7280'} 
              />
              {(filters.accountId || filters.type) ? (
                <View style={{ position: 'absolute', top: 8, right: 8, width: 8, height: 8, borderRadius: 4, backgroundColor: '#EF4444' }} />
              ) : null}
            </Pressable>
          </View>
        </View>

        <View style={sectionCard}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <Text style={sectionTitle}>Spending Breakdown</Text>
            <MaterialCommunityIcons name="chart-donut" size={18} color="#9CA3AF" />
          </View>
          <Text style={sectionSubtitle}>Categories for the selected period</Text>
          <View style={{ marginTop: 16 }}>
            {categoriesLoading ? (
              <Loader />
            ) : categoriesError && !categories ? (
              <View style={{ alignItems: 'center', paddingVertical: 16 }}>
                <Text style={{ color: '#6B7280', marginBottom: 8 }}>Failed to load categories</Text>
                <Button title="Retry" variant="outline" onPress={() => refetchCategories()} />
              </View>
            ) : (
              <SpendingBreakdown
                data={categories ?? []}
                onSelectCategory={(category) =>
                  router.push({
                    pathname: '/category-transactions',
                    params: {
                      category,
                      startDate: filters.startDate,
                      endDate: filters.endDate,
                      accountId: filters.accountId,
                    },
                  })
                }
              />
            )}
          </View>
        </View>

        <View style={sectionCard}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <Text style={sectionTitle}>Income vs Expenses</Text>
            <MaterialCommunityIcons name="chart-bar" size={18} color="#9CA3AF" />
          </View>
          <Text style={sectionSubtitle}>Flow over time</Text>
          <View style={{ marginTop: 16 }}>
            {trendsLoading ? (
              <Loader />
            ) : trendsError && !trends ? (
              <View style={{ alignItems: 'center', paddingVertical: 16 }}>
                <Text style={{ color: '#6B7280', marginBottom: 8 }}>Failed to load trends</Text>
                <Button title="Retry" variant="outline" onPress={() => refetchTrends()} />
              </View>
            ) : (
              <IncomeExpenseChart data={trends ?? []} filters={filters} />
            )}
          </View>
        </View>

        <View style={sectionCard}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <Text style={sectionTitle}>Net Trajectory</Text>
            <MaterialCommunityIcons name="chart-line-variant" size={18} color="#9CA3AF" />
          </View>
          <Text style={sectionSubtitle}>Net flow over time</Text>
          <View style={{ marginTop: 16 }}>
            {trendsLoading ? (
              <Loader />
            ) : trendsError && !trends ? (
              <View style={{ alignItems: 'center', paddingVertical: 16 }}>
                <Text style={{ color: '#6B7280', marginBottom: 8 }}>Failed to load trends</Text>
                <Button title="Retry" variant="outline" onPress={() => refetchTrends()} />
              </View>
            ) : (
              <TrajectoryChart data={trends ?? []} filters={filters} />
            )}
          </View>
        </View>

        <View style={sectionCard}>
          <Text style={sectionTitle}>Download Report</Text>
          <Text style={sectionSubtitle}>Download your data</Text>
          <View style={{ marginTop: 16, gap: 12 }}>
            <ExportButton
              title="PDF"
              subtitle="Summary and transactions, ready to print"
              icon="file-pdf-box"
              color="#EF4444"
              backgroundColor="#FEF2F2"
              iconBackgroundColor="#FEE2E2"
              loading={exporting === 'pdf'}
              disabled={exporting !== null}
              onPress={() => handleExport('pdf')}
            />
            <ExportButton
              title="Excel"
              subtitle="Summary and transactions in a spreadsheet"
              icon="file-excel-box"
              color="#22C55E"
              backgroundColor="#F0FDF4"
              iconBackgroundColor="#DCFCE7"
              loading={exporting === 'excel'}
              disabled={exporting !== null}
              onPress={() => handleExport('excel')}
            />
          </View>
        </View>
      </ScrollView>

      {/* Report Ready Modal */}
      <Modal visible={preparedReport !== null} onClose={() => setPreparedReport(null)} title="Your report is ready">
        {preparedReport && (
          <View style={{ gap: 12 }}>
            <Text style={{ fontSize: 13, color: '#6B7280' }} numberOfLines={1} ellipsizeMode="middle">
              {preparedReport.fileName}
            </Text>
            <Button title="Save to phone" onPress={() => handleSaveReport(preparedReport)} />
            <Button title="Share" variant="outline" onPress={() => handleShareReport(preparedReport)} />
          </View>
        )}
      </Modal>

      {/* Filter Modal */}
      <Modal visible={showFilters} onClose={() => setShowFilters(false)} title="Report Filters">
        <View style={{ gap: 24 }}>
          {/* Quick Date Ranges */}
          <View>
            <Text style={{ fontSize: 14, fontWeight: '600', color: '#111827', marginBottom: 12 }}>Date Range</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {['today', 'yesterday', 'this_week', 'last_week', 'this_month', 'last_month', 'this_year', 'all_time'].map((range) => {
                const labels: any = {
                  today: 'Today', yesterday: 'Yesterday', this_week: 'This Week', last_week: 'Last Week',
                  this_month: 'This Month', last_month: 'Last Month', this_year: 'This Year', all_time: 'All Time'
                };
                
                const d = new Date();
                let rStart = '', rEnd = '';
                switch(range) {
                  case 'today': rStart = getLocalISODate(d); rEnd = rStart; break;
                  case 'yesterday': d.setDate(d.getDate() - 1); rStart = getLocalISODate(d); rEnd = rStart; break;
                  case 'this_week': {
                    const day = d.getDay(); const diff = d.getDate() - day + (day == 0 ? -6 : 1);
                    rStart = getLocalISODate(new Date(d.setDate(diff)));
                    rEnd = getLocalISODate(new Date(new Date(rStart).setDate(new Date(rStart).getDate() + 6)));
                    break;
                  }
                  case 'last_week': {
                    const lw = new Date(); const lwDay = lw.getDay(); const lwDiff = lw.getDate() - lwDay + (lwDay == 0 ? -6 : 1) - 7;
                    rStart = getLocalISODate(new Date(lw.setDate(lwDiff)));
                    rEnd = getLocalISODate(new Date(new Date(rStart).setDate(new Date(rStart).getDate() + 6)));
                    break;
                  }
                  case 'this_month': rStart = getLocalISODate(new Date(d.getFullYear(), d.getMonth(), 1)); rEnd = getLocalISODate(new Date(d.getFullYear(), d.getMonth() + 1, 0)); break;
                  case 'last_month': rStart = getLocalISODate(new Date(d.getFullYear(), d.getMonth() - 1, 1)); rEnd = getLocalISODate(new Date(d.getFullYear(), d.getMonth(), 0)); break;
                  case 'this_year': rStart = getLocalISODate(new Date(d.getFullYear(), 0, 1)); rEnd = getLocalISODate(new Date(d.getFullYear(), 11, 31)); break;
                  case 'all_time': rStart = '2000-01-01'; rEnd = getLocalISODate(new Date(d.getFullYear() + 1, 0, 1)); break;
                }
                const isActive = draftFilters.startDate === rStart && draftFilters.endDate === rEnd;

                return (
                  <Pressable
                    key={range}
                    onPress={() => setDateRange(range as any)}
                    style={{
                      paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999,
                      backgroundColor: isActive ? '#2563EB' : '#F3F4F6',
                    }}
                  >
                    <Text style={{ fontSize: 13, fontWeight: '500', color: isActive ? '#fff' : '#4B5563' }}>{labels[range]}</Text>
                  </Pressable>
                );
              })}
            </View>
            <Text style={{ fontSize: 12, color: '#6B7280', marginTop: 8 }}>
              Selected: {draftFilters.startDate === '2000-01-01' ? 'All Time' : `${draftFilters.startDate} to ${draftFilters.endDate}`}
            </Text>

            {/* Custom Date Range */}
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 16 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 12, fontWeight: '500', color: '#6B7280', marginBottom: 6 }}>Start Date</Text>
                <Pressable
                  onPress={() => setShowStartDatePicker(true)}
                  style={{ padding: 12, backgroundColor: '#F9FAFB', borderRadius: 8, borderWidth: 1, borderColor: '#E5E7EB' }}
                >
                  <Text style={{ fontSize: 13, color: '#111827' }}>{draftFilters.startDate}</Text>
                </Pressable>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 12, fontWeight: '500', color: '#6B7280', marginBottom: 6 }}>End Date</Text>
                <Pressable
                  onPress={() => setShowEndDatePicker(true)}
                  style={{ padding: 12, backgroundColor: '#F9FAFB', borderRadius: 8, borderWidth: 1, borderColor: '#E5E7EB' }}
                >
                  <Text style={{ fontSize: 13, color: '#111827' }}>{draftFilters.endDate}</Text>
                </Pressable>
              </View>
            </View>
          </View>

          {/* Wallet */}
          <View>
            <Text style={{ fontSize: 14, fontWeight: '600', color: '#111827', marginBottom: 12 }}>Wallet</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              <Pressable
                onPress={() => setDraftFilters({ ...draftFilters, accountId: undefined })}
                style={{
                  paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999,
                  backgroundColor: !draftFilters.accountId ? '#2563EB' : '#F3F4F6',
                }}
              >
                <Text style={{ fontSize: 13, fontWeight: '500', color: !draftFilters.accountId ? '#fff' : '#4B5563' }}>All Wallets</Text>
              </Pressable>
              {accounts?.map((acc) => (
                <Pressable
                  key={acc.id}
                  onPress={() => setDraftFilters({ ...draftFilters, accountId: acc.id })}
                  style={{
                    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999,
                    backgroundColor: draftFilters.accountId === acc.id ? '#2563EB' : '#F3F4F6',
                  }}
                >
                  <Text style={{ fontSize: 13, fontWeight: '500', color: draftFilters.accountId === acc.id ? '#fff' : '#4B5563' }}>{acc.name}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Type */}
          <View>
            <Text style={{ fontSize: 14, fontWeight: '600', color: '#111827', marginBottom: 12 }}>Transaction Type</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {[ { value: undefined, label: 'All' }, { value: 'income', label: 'Income' }, { value: 'expense', label: 'Expense' } ].map((opt) => (
                <Pressable
                  key={opt.label}
                  onPress={() => setDraftFilters({ ...draftFilters, type: opt.value })}
                  style={{
                    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999,
                    backgroundColor: draftFilters.type === opt.value ? '#2563EB' : '#F3F4F6',
                  }}
                >
                  <Text style={{ fontSize: 13, fontWeight: '500', color: draftFilters.type === opt.value ? '#fff' : '#4B5563' }}>{opt.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Button 
                title="Reset" 
                variant="outline" 
                onPress={() => {
                  setFilters({ startDate: defaultStartDate, endDate: defaultEndDate, accountId: undefined, type: undefined });
                  setShowFilters(false);
                }} 
              />
            </View>
            <View style={{ flex: 1 }}>
              <Button 
                title="Apply Filters" 
                onPress={() => {
                  setFilters(draftFilters);
                  setShowFilters(false);
                }} 
              />
            </View>
          </View>
        </View>

        {showStartDatePicker && (
          <DateTimePicker
            value={new Date(draftFilters.startDate === '2000-01-01' ? getLocalISODate() : draftFilters.startDate)}
            mode="date"
            display="default"
            onChange={(event, selectedDate) => {
              setShowStartDatePicker(Platform.OS === 'ios');
              if (selectedDate) setDraftFilters({ ...draftFilters, startDate: getLocalISODate(selectedDate) });
            }}
          />
        )}
        {showEndDatePicker && (
          <DateTimePicker
            value={new Date(draftFilters.endDate)}
            mode="date"
            display="default"
            onChange={(event, selectedDate) => {
              setShowEndDatePicker(Platform.OS === 'ios');
              if (selectedDate) setDraftFilters({ ...draftFilters, endDate: getLocalISODate(selectedDate) });
            }}
          />
        )}
      </Modal>
    </Screen>
  );
}

function ExportButton({
  title,
  subtitle,
  icon,
  color,
  backgroundColor,
  iconBackgroundColor,
  loading,
  disabled,
  onPress,
}: {
  title: string;
  subtitle: string;
  icon: 'file-pdf-box' | 'file-excel-box';
  color: string;
  backgroundColor: string;
  iconBackgroundColor: string;
  loading: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor, borderRadius: 14, padding: 14, opacity: disabled && !loading ? 0.5 : 1 }}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={`Download ${title}`}
      accessibilityState={{ busy: loading, disabled }}
    >
      <View style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: iconBackgroundColor, alignItems: 'center', justifyContent: 'center' }}>
        <MaterialCommunityIcons name={icon} size={22} color={color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 14, fontWeight: '600', color: '#111827' }}>{loading ? 'Preparing your report…' : title}</Text>
        <Text style={{ fontSize: 12, color: '#9CA3AF' }}>{subtitle}</Text>
      </View>
      {loading ? (
        <ActivityIndicator size="small" color={color} />
      ) : (
        <MaterialCommunityIcons name="download" size={20} color="#9CA3AF" />
      )}
    </Pressable>
  );
}

function SpendingBreakdown({ data, onSelectCategory }: { data: CategoryComparison[]; onSelectCategory: (category: string) => void }) {
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
          <Pressable
            key={`${cat.category}-${index}`}
            onPress={() => onSelectCategory(cat.category)}
            accessibilityRole="button"
            accessibilityLabel={`View ${cat.category} expenses`}
            className="active:opacity-60"
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
                <Text style={{ fontSize: 14, fontWeight: '500', color: '#111827' }}>{cat.category}</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: '#111827' }}>
                    {formatCurrency(cat.currentMonthTotal)}
                  </Text>
                  <Text style={{ fontSize: 11, color: '#9CA3AF' }}>{percent.toFixed(0)}%</Text>
                </View>
                <MaterialCommunityIcons name="chevron-right" size={18} color="#9CA3AF" />
              </View>
            </View>
            <ProgressBar progress={percent} color={color} height={6} />
          </Pressable>
        );
      })}
    </View>
  );
}

function getFormatForFilters(filters: ReportFilters, d: Date): string {
  const days = (new Date(filters.endDate).getTime() - new Date(filters.startDate).getTime()) / (1000 * 60 * 60 * 24);
  if (days <= 31) {
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } else if (days <= 180) {
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } else if (days > 730) {
    return d.getFullYear().toString();
  }
  return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
}

function IncomeExpenseChart({ data, filters }: { data: MonthlyTrend[], filters: ReportFilters }) {
  const maxValue = Math.max(...data.map((t) => Math.max(t.income, t.expense)), 1);

  return (
    <View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 12, height: 100, minWidth: '100%', paddingRight: 20 }}>
          {data.map((trend, i) => {
            const incH = (trend.income / maxValue) * 80;
            const expH = (trend.expense / maxValue) * 80;
            
            const monthLabel = getFormatForFilters(filters, new Date(trend.month));

            return (
              <View key={i} style={{ alignItems: 'center', width: 40 }}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 2, height: 80, width: '100%', justifyContent: 'center' }}>
                  <View style={{ width: '45%', height: Math.max(incH, 2), borderRadius: 4, backgroundColor: '#22C55E' }} />
                  <View style={{ width: '45%', height: Math.max(expH, 2), borderRadius: 4, backgroundColor: '#EF4444' }} />
                </View>
                <Text style={{ fontSize: 9, color: '#9CA3AF', marginTop: 4, textAlign: 'center', width: 50 }} numberOfLines={1}>{monthLabel}</Text>
              </View>
            );
          })}
        </View>
      </ScrollView>
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

function TrajectoryChart({ data, filters }: { data: MonthlyTrend[], filters: ReportFilters }) {
  const maxNet = Math.max(...data.map((t) => Math.abs(t.net)), 1);

  return (
    <View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 12, height: 80, minWidth: '100%', paddingRight: 20 }}>
          {data.map((trend, i) => {
            const netHeight = (Math.abs(trend.net) / maxNet) * 64;
            const isPositive = trend.net >= 0;
            
            const monthLabel = getFormatForFilters(filters, new Date(trend.month));

            return (
              <View key={i} style={{ alignItems: 'center', width: 40 }}>
                <View
                  style={{
                    width: '80%',
                    height: Math.max(netHeight, 2),
                    borderRadius: 4,
                    backgroundColor: isPositive ? '#22C55E' : '#EF4444',
                    opacity: 0.85,
                  }}
                />
                <Text style={{ fontSize: 9, color: '#9CA3AF', marginTop: 4, textAlign: 'center', width: 50 }} numberOfLines={1}>{monthLabel}</Text>
              </View>
            );
          })}
        </View>
      </ScrollView>
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
