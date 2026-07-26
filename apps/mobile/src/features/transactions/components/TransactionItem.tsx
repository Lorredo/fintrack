import { View, Text, Pressable } from 'react-native';

import type { Transaction } from '../types';

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
      {/* Category icon placeholder */}
      <View
        className={`w-12 h-12 rounded-full items-center justify-center ${
          isExpense ? 'bg-danger/10' : 'bg-success/10'
        }`}
      >
        <Text className="text-lg">{getCategoryEmoji(transaction.category)}</Text>
      </View>

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
          {sign}${transaction.amount.toFixed(2)}
        </Text>
        <View className="flex-row gap-xs mt-xs">
          <Pressable onPress={() => onEdit(transaction)}>
            <Text className="text-xs text-primary">Edit</Text>
          </Pressable>
          <Pressable onPress={() => onDelete(transaction.id)}>
            <Text className="text-xs text-danger">Delete</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function getCategoryEmoji(category: string): string {
  const emojiMap: Record<string, string> = {
    'Food & Drinks': '🍔',
    Transportation: '🚗',
    Shopping: '🛍️',
    Entertainment: '🎬',
    'Bills & Utilities': '📄',
    Housing: '🏠',
    Health: '💊',
    Education: '📚',
    Salary: '💰',
    Freelance: '💻',
    Investment: '📈',
  };

  return emojiMap[category] || '💳';
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}