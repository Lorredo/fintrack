import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { Modal } from '@/components/ui';
import { formatCurrency } from '@/shared/utils/categories';
import { useSafeToSpend } from '../hooks/useBills';
import type { SafeToSpend } from '../types';
import { formatShortDate } from '../utils/billLabels';

function BreakdownLine({ label, value, minus, bold }: { label: string; value: number; minus?: boolean; bold?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, gap: 12 }}>
      <Text style={{ flex: 1, fontSize: bold ? 15 : 14, fontWeight: bold ? '700' : '400', color: bold ? '#111827' : '#4B5563' }}>
        {label}
      </Text>
      <Text style={{ fontSize: bold ? 15 : 14, fontWeight: bold ? '700' : '500', color: minus ? '#DC2626' : '#111827' }}>
        {minus ? '−' : ''}{formatCurrency(value)}
      </Text>
    </View>
  );
}

function Breakdown({ safe }: { safe: SafeToSpend }) {
  return (
    <View>
      <BreakdownLine label="Balance in counted wallets" value={safe.balance} />
      {safe.bills.map((bill) => (
        <BreakdownLine
          key={`${bill.billId}-${bill.dueDate}`}
          label={`${bill.name} · ${bill.overdue ? 'overdue ' : ''}${formatShortDate(bill.dueDate)}`}
          value={bill.amount}
          minus
        />
      ))}
      {safe.savingsTarget > 0 && (
        <BreakdownLine
          label={
            safe.savingsMoved > 0
              ? `Savings still to set aside (${formatCurrency(safe.savingsMoved)} of ${formatCurrency(safe.savingsTarget)} moved)`
              : 'Savings to set aside'
          }
          value={safe.savingsReserved}
          minus
        />
      )}
      <View style={{ height: 1, backgroundColor: '#E5E7EB', marginVertical: 6 }} />
      <BreakdownLine label={`Safe to spend until ${formatShortDate(safe.nextPayday)}`} value={safe.spendable} bold />
      <Text style={{ fontSize: 13, color: '#6B7280', marginTop: 6 }}>
        {safe.daysLeft} day{safe.daysLeft === 1 ? '' : 's'} left, so about {formatCurrency(Math.max(safe.perDay, 0))} a day.
        Wallets set to not count, like savings, are left out.
      </Text>
    </View>
  );
}

export function SafeToSpendCard() {
  const router = useRouter();
  const { data: safe } = useSafeToSpend();
  const [showBreakdown, setShowBreakdown] = useState(false);

  // Older servers don't have this yet, and there's nothing to show until it loads.
  if (!safe) return null;

  if (!safe.configured) {
    return (
      <Pressable
        onPress={() => router.push('/pay-settings')}
        accessibilityRole="button"
        className="active:opacity-70"
        style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#EFF6FF', borderRadius: 16, padding: 16, marginBottom: 16 }}
      >
        <MaterialCommunityIcons name="calendar-cursor" size={24} color="#2563EB" />
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 15, fontWeight: '700', color: '#1E3A8A' }}>See how much is safe to spend</Text>
          <Text style={{ fontSize: 13, color: '#3B82F6', marginTop: 2 }}>Set your payday to get a daily amount.</Text>
        </View>
        <MaterialCommunityIcons name="chevron-right" size={20} color="#93C5FD" />
      </Pressable>
    );
  }

  const short = safe.spendable < 0;

  return (
    <>
      <Pressable
        onPress={() => setShowBreakdown(true)}
        accessibilityRole="button"
        accessibilityHint="Shows how this is worked out"
        className="active:opacity-80"
        style={{ backgroundColor: short ? '#FEF2F2' : '#ECFDF5', borderRadius: 20, padding: 18, marginBottom: 16 }}
      >
        <Text style={{ fontSize: 13, fontWeight: '600', color: short ? '#B91C1C' : '#047857' }}>Safe to spend</Text>
        {short ? (
          <>
            <Text style={{ fontSize: 28, fontWeight: '800', color: '#B91C1C', letterSpacing: -0.5, marginTop: 2 }}>
              {formatCurrency(-safe.spendable)} short
            </Text>
            <Text style={{ fontSize: 13, color: '#B91C1C', marginTop: 4 }}>
              Bills and savings before {formatShortDate(safe.nextPayday)} are more than your balance.
            </Text>
          </>
        ) : (
          <>
            <Text style={{ fontSize: 30, fontWeight: '800', color: '#065F46', letterSpacing: -0.5, marginTop: 2 }}>
              {formatCurrency(safe.perDay)}
              <Text style={{ fontSize: 16, fontWeight: '600' }}> / day</Text>
            </Text>
            <Text style={{ fontSize: 13, color: '#047857', marginTop: 4 }}>
              {formatCurrency(safe.spendable)} until payday on {formatShortDate(safe.nextPayday)} · {safe.daysLeft} day
              {safe.daysLeft === 1 ? '' : 's'} left
            </Text>
          </>
        )}
        {safe.billsReserved > 0 && (
          <Text style={{ fontSize: 12, color: short ? '#B91C1C' : '#047857', marginTop: 8, opacity: 0.8 }}>
            {formatCurrency(safe.billsReserved)} set aside for {safe.bills.length} bill{safe.bills.length === 1 ? '' : 's'} · Tap for details
          </Text>
        )}
      </Pressable>

      <Modal visible={showBreakdown} onClose={() => setShowBreakdown(false)} title="How it's worked out">
        <Breakdown safe={safe} />
      </Modal>
    </>
  );
}
