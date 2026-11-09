import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { Modal } from '@/components/ui';
import { formatCurrency } from '@/shared/utils/categories';
import { useSafeToSpend } from '../hooks/useBills';
import type { ReservedBill, SafeToSpend } from '../types';
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

function Divider() {
  return <View style={{ height: 1, backgroundColor: '#E5E7EB', marginVertical: 6 }} />;
}

function BillLines({ bills }: { bills: ReservedBill[] }) {
  return (
    <>
      {bills.map((bill) => (
        <BreakdownLine
          key={`${bill.billId}-${bill.dueDate}`}
          label={`${bill.name} · ${bill.overdue ? 'overdue ' : ''}${formatShortDate(bill.dueDate)}`}
          value={bill.amount}
          minus
        />
      ))}
    </>
  );
}

function SavingsLine({ safe }: { safe: SafeToSpend }) {
  if (safe.savingsTarget <= 0) return null;
  const label =
    safe.savingsMoved > 0
      ? `Savings still to set aside (${formatCurrency(safe.savingsMoved)} of ${formatCurrency(safe.savingsTarget)} moved)`
      : 'Savings to set aside';
  return <BreakdownLine label={label} value={safe.savingsReserved} minus />;
}

/** The balance-based amount: what the wallets can actually cover. */
function BalanceBreakdown({ safe, title }: { safe: SafeToSpend; title: string }) {
  return (
    <View>
      <BreakdownLine label="Balance in counted wallets" value={safe.balance} />
      <BillLines bills={safe.bills} />
      <SavingsLine safe={safe} />
      <Divider />
      {/* Servers before the salary plan don't send balanceLeft. */}
      <BreakdownLine label={title} value={safe.balanceLeft ?? safe.spendable} bold />
    </View>
  );
}

function SalaryBreakdown({ safe }: { safe: SafeToSpend }) {
  const savingsPerPayday = safe.savingsTarget - safe.extraSaved;
  return (
    <View>
      <Text style={{ fontSize: 13, fontWeight: '600', color: '#6B7280', marginBottom: 4 }}>
        This pay period · {formatShortDate(safe.periodStart)} to {formatShortDate(safe.nextPayday)}
      </Text>
      <BreakdownLine label={safe.payEstimated ? 'Expected salary (not recorded yet)' : 'Salary'} value={safe.salary} />
      {safe.extraIncome > 0 && <BreakdownLine label="Overtime and other income" value={safe.extraIncome} />}
      <BillLines bills={safe.periodBills} />
      {savingsPerPayday > 0 && <BreakdownLine label="Savings" value={savingsPerPayday} minus />}
      {safe.extraSaved > 0 && <BreakdownLine label="Saved from extra income" value={safe.extraSaved} minus />}
      <Divider />
      <BreakdownLine label="Spending money this period" value={safe.spendingMoney} bold />
      <BreakdownLine label="Spent since payday" value={safe.spentSincePayday} minus />
      <Divider />
      <BreakdownLine label="Left to spend" value={safe.plannedLeft} bold />

      {safe.limitedByBalance && (
        <View style={{ marginTop: 16 }}>
          <Text style={{ fontSize: 13, color: '#B45309', marginBottom: 4 }}>
            Your wallets hold less than that, so Safe to Spend shows what they can cover:
          </Text>
          <BalanceBreakdown safe={safe} title="Covered by your wallets" />
        </View>
      )}
    </View>
  );
}

function Breakdown({ safe }: { safe: SafeToSpend }) {
  return (
    <View>
      {safe.mode === 'salary' ? (
        <SalaryBreakdown safe={safe} />
      ) : (
        <BalanceBreakdown safe={safe} title={`Safe to spend until ${formatShortDate(safe.nextPayday)}`} />
      )}
      <Text style={{ fontSize: 13, color: '#6B7280', marginTop: 10 }}>
        {safe.daysLeft} day{safe.daysLeft === 1 ? '' : 's'} left, so about {formatCurrency(Math.max(safe.perDay, 0))} a day.
        Bill payments, transfers and wallets set to not count, like savings, aren’t treated as spending.
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
          <Text style={{ fontSize: 13, color: '#3B82F6', marginTop: 2 }}>Set your payday and salary to get a daily amount.</Text>
        </View>
        <MaterialCommunityIcons name="chevron-right" size={20} color="#93C5FD" />
      </Pressable>
    );
  }

  const short = safe.spendable < 0;
  const tone = short ? '#B91C1C' : '#047857';
  const note = safe.limitedByBalance
    ? 'Limited by your wallet balance'
    : safe.mode === 'salary' && safe.payEstimated
      ? 'Using your expected salary until you record it'
      : null;

  return (
    <>
      <Pressable
        onPress={() => setShowBreakdown(true)}
        accessibilityRole="button"
        accessibilityHint="Shows how this is worked out"
        className="active:opacity-80"
        style={{ backgroundColor: short ? '#FEF2F2' : '#ECFDF5', borderRadius: 20, padding: 18, marginBottom: 16 }}
      >
        <Text style={{ fontSize: 13, fontWeight: '600', color: tone }}>Safe to spend</Text>
        {short ? (
          <>
            <Text style={{ fontSize: 28, fontWeight: '800', color: '#B91C1C', letterSpacing: -0.5, marginTop: 2 }}>
              {formatCurrency(-safe.spendable)} over
            </Text>
            <Text style={{ fontSize: 13, color: '#B91C1C', marginTop: 4 }}>
              {safe.mode === 'salary'
                ? `You've spent more than this pay allows before ${formatShortDate(safe.nextPayday)}.`
                : `Bills and savings before ${formatShortDate(safe.nextPayday)} are more than your balance.`}
            </Text>
          </>
        ) : (
          <>
            <Text style={{ fontSize: 30, fontWeight: '800', color: '#065F46', letterSpacing: -0.5, marginTop: 2 }}>
              {formatCurrency(safe.perDay)}
              <Text style={{ fontSize: 16, fontWeight: '600' }}> / day</Text>
            </Text>
            <Text style={{ fontSize: 13, color: tone, marginTop: 4 }}>
              {formatCurrency(safe.spendable)} left until payday on {formatShortDate(safe.nextPayday)} · {safe.daysLeft} day
              {safe.daysLeft === 1 ? '' : 's'}
            </Text>
          </>
        )}
        {note && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 }}>
            <MaterialCommunityIcons name="information-outline" size={14} color={tone} />
            <Text style={{ fontSize: 12, color: tone }}>{note}</Text>
          </View>
        )}
        <Text style={{ fontSize: 12, color: tone, marginTop: 8, opacity: 0.8 }}>Tap for details</Text>
      </Pressable>

      {safe.mode === 'balance' && (
        <Pressable
          onPress={() => router.push('/pay-settings')}
          accessibilityRole="button"
          className="active:opacity-70"
          style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: -8, marginBottom: 16, paddingHorizontal: 4 }}
        >
          <MaterialCommunityIcons name="cash-plus" size={16} color="#2563EB" />
          <Text style={{ flex: 1, fontSize: 13, color: '#2563EB' }}>Add your salary to plan from each payday</Text>
        </Pressable>
      )}

      <Modal visible={showBreakdown} onClose={() => setShowBreakdown(false)} title="How it's worked out">
        <Breakdown safe={safe} />
      </Modal>
    </>
  );
}
