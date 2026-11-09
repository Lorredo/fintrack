import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { useAccounts } from '@/features/accounts/hooks/useAccounts';
import { useBills } from '../hooks/useBills';
import type { Bill } from '../types';
import { BillRow } from './BillRow';
import MarkPaidModal from './MarkPaidModal';

const SHOWN = 3;

/** The next few unpaid bills on the Dashboard, with Mark as paid. */
export function UpcomingBills() {
  const router = useRouter();
  const { data: bills } = useBills();
  const { data: accounts } = useAccounts();
  const [paying, setPaying] = useState<Bill | null>(null);

  const upcoming = (bills ?? []).filter((bill) => bill.active).slice(0, SHOWN);
  if (upcoming.length === 0) return null;

  return (
    <View style={{ marginBottom: 20 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <Text style={{ fontSize: 17, fontWeight: '700', color: '#111827' }}>Upcoming Bills</Text>
        <Pressable onPress={() => router.push('/bills')} accessibilityRole="button" hitSlop={8}>
          <Text style={{ fontSize: 14, fontWeight: '600', color: '#2563EB' }}>See all</Text>
        </Pressable>
      </View>
      <View style={{ gap: 10 }}>
        {upcoming.map((bill) => (
          <BillRow key={bill.id} bill={bill} accounts={accounts} onPress={() => router.push('/bills')} onPay={setPaying} />
        ))}
      </View>
      <MarkPaidModal bill={paying} onClose={() => setPaying(null)} />
    </View>
  );
}
