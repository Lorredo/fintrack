import { Pressable, Text, View } from 'react-native';

import { CategoryIcon } from '@/components/ui';
import { formatCurrency } from '@/shared/utils/categories';
import type { Account } from '@/features/accounts/types';
import type { Bill } from '../types';
import { dueLabel, STATUS_COLORS } from '../utils/billLabels';

interface BillRowProps {
  bill: Bill;
  accounts?: Account[];
  onPress: (bill: Bill) => void;
  onPay: (bill: Bill) => void;
}

export function BillRow({ bill, accounts, onPress, onPay }: BillRowProps) {
  const wallet = accounts?.find((account) => account.id === bill.accountId);
  const colors = STATUS_COLORS[bill.status];

  return (
    <Pressable
      onPress={() => onPress(bill)}
      accessibilityRole="button"
      accessibilityLabel={`${bill.name}, ${formatCurrency(bill.amount)}, ${dueLabel(bill)}`}
      className="active:opacity-70"
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 14,
        gap: 12,
        opacity: bill.active ? 1 : 0.6,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 6,
        elevation: 1,
      }}
    >
      <CategoryIcon category={bill.category} size="md" />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ fontSize: 15, fontWeight: '600', color: '#111827' }} numberOfLines={1}>
          {bill.name}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 6 }}>
          <View style={{ backgroundColor: colors.bg, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, flexShrink: 1 }}>
            <Text style={{ fontSize: 12, fontWeight: '600', color: colors.text }} numberOfLines={1}>
              {dueLabel(bill)}
            </Text>
          </View>
        </View>
        {wallet && (
          <Text style={{ fontSize: 12, color: '#6B7280', marginTop: 4 }} numberOfLines={1}>
            From {wallet.name}
          </Text>
        )}
      </View>
      <View style={{ alignItems: 'flex-end', gap: 8 }}>
        <Text style={{ fontSize: 15, fontWeight: '700', color: '#111827' }}>{formatCurrency(bill.amount)}</Text>
        {bill.active && (
          <Pressable
            onPress={() => onPay(bill)}
            accessibilityRole="button"
            accessibilityLabel={`Mark ${bill.name} as paid`}
            hitSlop={6}
            className="active:opacity-70"
            style={{ backgroundColor: '#EFF6FF', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 }}
          >
            <Text style={{ fontSize: 12, fontWeight: '700', color: '#2563EB' }}>Mark as paid</Text>
          </Pressable>
        )}
      </View>
    </Pressable>
  );
}
