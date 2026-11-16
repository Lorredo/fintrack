import { View, Text, Pressable } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { CategoryIcon } from '@/components/ui';
import type { Account } from '@/features/accounts/types';
import { formatCurrency, formatDate } from '@/shared/utils/categories';
import type { ShownTransaction } from '../offline/outbox.logic';
import type { Transaction } from '../types';
import { getAmountDisplay, getWalletLabel } from '../utils/amountDisplay';

interface TransactionRowProps {
  transaction: ShownTransaction;
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
        {transaction.syncStatus && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
            <MaterialCommunityIcons
              name={transaction.syncStatus === 'failed' ? 'alert-circle-outline' : 'cloud-off-outline'}
              size={13}
              color={transaction.syncStatus === 'failed' ? '#DC2626' : '#B45309'}
            />
            <Text
              style={{ fontSize: 12, fontWeight: '600', color: transaction.syncStatus === 'failed' ? '#DC2626' : '#B45309' }}
              numberOfLines={1}
            >
              {transaction.syncStatus === 'failed' ? "Couldn't sync · tap to fix" : 'Waiting to sync'}
            </Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}
