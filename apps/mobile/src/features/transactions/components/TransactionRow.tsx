import { View, Text, Pressable } from 'react-native';

import { CategoryIcon } from '@/components/ui';
import type { Account } from '@/features/accounts/types';
import { formatCurrency, formatDate } from '@/shared/utils/categories';
import type { Transaction } from '../types';
import { getAmountDisplay, getWalletLabel } from '../utils/amountDisplay';

interface TransactionRowProps {
  transaction: Transaction;
  accounts?: Account[];
  showDate?: boolean;
  onPress: (transaction: Transaction) => void;
}

export default function TransactionRow({ transaction, accounts, showDate = true, onPress }: TransactionRowProps) {
  const { prefix, color } = getAmountDisplay(transaction.type);
  const wallet = getWalletLabel(transaction, accounts);
  const details = transaction.description ? `${transaction.description} · ${wallet}` : wallet;

  return (
    <Pressable
      onPress={() => onPress(transaction)}
      accessibilityRole="button"
      accessibilityLabel={`${transaction.category}, ${prefix}${formatCurrency(transaction.amount)}`}
      className="active:opacity-70"
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 1,
      }}
    >
      <CategoryIcon category={transaction.category} size="md" />
      <View style={{ flex: 1, marginLeft: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={{ flex: 1, fontSize: 15, fontWeight: '600', color: '#111827' }} numberOfLines={1}>
            {transaction.category}
          </Text>
          <Text style={{ marginLeft: 12, fontSize: 15, fontWeight: '700', color }}>
            {prefix}{formatCurrency(transaction.amount)}
          </Text>
        </View>
        <Text style={{ fontSize: 13, color: '#6B7280', marginTop: 3 }} numberOfLines={1}>
          {details}
        </Text>
        {showDate && (
          <Text style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>
            {formatDate(transaction.date)}
          </Text>
        )}
      </View>
    </Pressable>
  );
}
