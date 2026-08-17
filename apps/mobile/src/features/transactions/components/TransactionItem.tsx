import { View, Text, Pressable } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { CategoryIcon } from '@/components/ui';
import type { Transaction } from '../types';
import { formatCurrency, formatDate } from '@/shared/utils/categories';

interface TransactionItemProps {
  transaction: Transaction;
  onEdit: (transaction: Transaction) => void;
  onDelete: (id: string) => void;
}

export default function TransactionItem({
  transaction,
  onEdit,
  onDelete,
}: TransactionItemProps) {
  const isExpense = transaction.type === 'expense';
  const amountColor = isExpense ? 'text-danger' : 'text-success';
  const sign = isExpense ? '-' : '+';

  return (
    <View className="flex-row items-center bg-surface rounded-xl px-md py-sm border border-border">
      {/* Category icon */}
      <CategoryIcon category={transaction.category} size="sm" />

      {/* Details */}
      <View className="flex-1 ml-md">
        <Text className="text-sm font-semibold text-text" numberOfLines={1}>
          {transaction.category}
        </Text>
        {transaction.description && (
          <Text
            className="text-xs text-text-secondary mt-1"
            numberOfLines={1}
          >
            {transaction.description}
          </Text>
        )}
        <Text className="text-xs text-text-secondary mt-1">
          {formatDate(transaction.date)}
        </Text>
      </View>

      {/* Amount & Actions */}
      <View className="items-end ml-sm">
        <Text className={`text-base font-bold ${amountColor}`}>
          {sign}{formatCurrency(transaction.amount)}
        </Text>
        <View className="flex-row gap-sm mt-xs">
          <Pressable onPress={() => onEdit(transaction)} className="p-xs">
            <MaterialCommunityIcons name="pencil" size={16} color="#2563EB" />
          </Pressable>
          <Pressable onPress={() => onDelete(transaction.id)} className="p-xs">
            <MaterialCommunityIcons name="trash-can-outline" size={16} color="#EF4444" />
          </Pressable>
        </View>
      </View>
    </View>
  );
}