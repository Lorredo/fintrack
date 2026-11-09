import { useMemo, useState } from 'react';
import { Pressable, SectionList, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { Button, EmptyState, FloatingAddButton, Loader, Screen } from '@/components/ui';
import { useAccounts } from '@/features/accounts/hooks/useAccounts';
import { formatCurrency } from '@/shared/utils/categories';
import { BillRow } from '../components/BillRow';
import BillFormModal from '../components/BillFormModal';
import MarkPaidModal from '../components/MarkPaidModal';
import { useBills, usePaySettings, useSafeToSpend } from '../hooks/useBills';
import type { Bill } from '../types';
import { formatShortDate } from '../utils/billLabels';

export const PAY_SCHEDULE_LABELS = {
  semi_monthly: '15th and 30th',
  irregular: 'Irregular (end of month)',
} as const;

export default function BillsScreen() {
  const router = useRouter();
  const { data: bills, isLoading, isError, refetch, isRefetching } = useBills();
  const { data: accounts } = useAccounts();
  const { data: settings } = usePaySettings();
  const { data: safe } = useSafeToSpend();

  const [editing, setEditing] = useState<Bill | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [paying, setPaying] = useState<Bill | null>(null);

  const sections = useMemo(() => {
    const all = bills ?? [];
    const nextPayday = safe?.nextPayday;
    const active = all.filter((bill) => bill.active);
    const groups = [
      { title: 'Overdue', data: active.filter((bill) => bill.daysUntil < 0) },
      {
        title: nextPayday ? `Before payday · ${formatShortDate(nextPayday)}` : 'Coming up',
        data: active.filter((bill) => bill.daysUntil >= 0 && (!nextPayday || bill.nextDue < nextPayday)),
      },
      { title: 'Later', data: nextPayday ? active.filter((bill) => bill.daysUntil >= 0 && bill.nextDue >= nextPayday) : [] },
      { title: 'Paused', data: all.filter((bill) => !bill.active) },
    ];
    return groups.filter((group) => group.data.length > 0);
  }, [bills, safe?.nextPayday]);

  const monthlyTotal = (bills ?? [])
    .filter((bill) => bill.active)
    .reduce((sum, bill) => {
      const perMonth = bill.frequency === 'weekly' ? (bill.amount * 52) / 12 : bill.frequency === 'yearly' ? bill.amount / 12 : bill.amount;
      return sum + perMonth;
    }, 0);

  return (
    <Screen>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 8, paddingBottom: 16 }}>
        <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Go back" hitSlop={8}>
          <MaterialCommunityIcons name="arrow-left" size={24} color="#111827" />
        </Pressable>
        <Text style={{ flex: 1, fontSize: 18, fontWeight: '700', color: '#111827' }}>Bills</Text>
      </View>

      <Pressable
        onPress={() => router.push('/pay-settings')}
        accessibilityRole="button"
        className="active:opacity-70"
        style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#EFF6FF', borderRadius: 14, padding: 14, marginBottom: 12, gap: 12 }}
      >
        <MaterialCommunityIcons name="calendar-month-outline" size={22} color="#2563EB" />
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 14, fontWeight: '600', color: '#1E3A8A' }}>
            {settings?.paySchedule ? `Payday: ${PAY_SCHEDULE_LABELS[settings.paySchedule]}` : 'Set your payday'}
          </Text>
          <Text style={{ fontSize: 12, color: '#3B82F6', marginTop: 2 }}>
            {settings?.paySchedule
              ? `Savings each payday: ${formatCurrency(settings.savingsPerPayday)}`
              : 'Needed for Safe to Spend on the Dashboard'}
          </Text>
        </View>
        <MaterialCommunityIcons name="chevron-right" size={20} color="#93C5FD" />
      </Pressable>

      {bills && bills.length > 0 && (
        <Text style={{ fontSize: 13, color: '#6B7280', marginBottom: 4 }}>
          About {formatCurrency(monthlyTotal)} a month in bills
        </Text>
      )}

      {!bills && isLoading ? (
        <Loader />
      ) : isError && !bills ? (
        <View style={{ alignItems: 'center', paddingVertical: 32 }}>
          <Text style={{ fontSize: 15, color: '#6B7280', marginBottom: 12 }}>Failed to load bills</Text>
          <Button title="Retry" onPress={() => refetch()} />
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          stickySectionHeadersEnabled={false}
          showsVerticalScrollIndicator={false}
          refreshing={isRefetching}
          onRefresh={refetch}
          // Room for the Add Bill button over the last row.
          contentContainerStyle={{ paddingBottom: 110 }}
          renderSectionHeader={({ section }) => (
            <Text style={{ fontSize: 14, fontWeight: '600', color: '#4B5563', marginTop: 14, marginBottom: 8 }}>
              {section.title}
            </Text>
          )}
          renderItem={({ item }) => (
            <View style={{ marginBottom: 10 }}>
              <BillRow bill={item} accounts={accounts} onPress={setEditing} onPay={setPaying} />
            </View>
          )}
          ListEmptyComponent={
            <EmptyState
              title="No bills yet"
              description="Add bills like electricity, internet or rent. FinTrack reminds you before they're due and sets the money aside in Safe to Spend."
              action={<Button title="Add Your First Bill" icon="plus" onPress={() => setIsAdding(true)} />}
            />
          }
        />
      )}

      {bills && bills.length > 0 && <FloatingAddButton label="Add Bill" onPress={() => setIsAdding(true)} />}

      <BillFormModal visible={isAdding || editing !== null} bill={editing} onClose={() => { setIsAdding(false); setEditing(null); }} />
      <MarkPaidModal bill={paying} onClose={() => setPaying(null)} />
    </Screen>
  );
}
