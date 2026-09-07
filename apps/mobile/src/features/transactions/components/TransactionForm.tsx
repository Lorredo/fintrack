import { useState } from 'react';
import { View, Text, Pressable, Platform } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';

import { Input, Button } from '@/components/ui';
import type { Transaction, CreateTransactionInput, UpdateTransactionInput, TransactionType } from '../types';

interface TransactionFormProps {
  transaction?: Transaction | null;
  initialType?: TransactionType;
  onSubmit: (data: CreateTransactionInput | UpdateTransactionInput) => void;
  onCancel: () => void;
  loading?: boolean;
}

const EXPENSE_CATEGORIES = [
  'Food & Drinks',
  'Transportation',
  'Shopping',
  'Entertainment',
  'Bills & Utilities',
  'Housing',
  'Health',
  'Education',
  'Other',
];

const INCOME_CATEGORIES = [
  'Salary',
  'Freelance',
  'Investment',
  'Bonus & Commission',
  'Side Hustle',
  'Stocks & Dividends',
  'Crypto & Digital',
  'Other',
];

export default function TransactionForm({
  transaction,
  initialType = 'expense',
  onSubmit,
  onCancel,
  loading,
}: TransactionFormProps) {
  const [type, setType] = useState<TransactionType>(
    transaction?.type || initialType,
  );
  const [amount, setAmount] = useState(
    transaction ? String(transaction.amount) : '',
  );
  const [category, setCategory] = useState(transaction?.category || '');
  const [description, setDescription] = useState(
    transaction?.description || '',
  );
  const [date, setDate] = useState(
    transaction?.date || new Date().toISOString().split('T')[0],
  );
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const categories = type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  const handleTypeChange = (newType: TransactionType) => {
    setType(newType);
    // Reset category if it doesn't belong to the newly selected type
    const validCategories = newType === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
    if (category && !validCategories.includes(category)) {
      setCategory('');
    }
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      newErrors.amount = 'Amount must be greater than zero';
    }
    if (!category) {
      newErrors.category = 'Category is required';
    }
    if (!date) {
      newErrors.date = 'Date is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) return;

    const payload = {
      type,
      amount: parseFloat(amount),
      category,
      description: description || undefined,
      date,
    };

    if (transaction) {
      onSubmit({ ...payload, id: transaction.id } as UpdateTransactionInput);
    } else {
      onSubmit(payload as CreateTransactionInput);
    }
  };

  return (
    <View className="gap-lg">
      {/* Type selector */}
      <View className="flex-row gap-sm">
        <Pressable
          onPress={() => handleTypeChange('expense')}
          className={`flex-1 py-sm px-md rounded-lg border-2 ${
            type === 'expense'
              ? 'border-danger bg-danger/10'
              : 'border-border bg-surface'
          }`}
        >
          <Text
            className={`text-center font-semibold ${
              type === 'expense' ? 'text-danger' : 'text-text-secondary'
            }`}
          >
            Expense
          </Text>
        </Pressable>
        <Pressable
          onPress={() => handleTypeChange('income')}
          className={`flex-1 py-sm px-md rounded-lg border-2 ${
            type === 'income'
              ? 'border-success bg-success/10'
              : 'border-border bg-surface'
          }`}
        >
          <Text
            className={`text-center font-semibold ${
              type === 'income' ? 'text-success' : 'text-text-secondary'
            }`}
          >
            Income
          </Text>
        </Pressable>
      </View>

      {/* Amount */}
      <Input
        label="Amount"
        placeholder="0.00"
        keyboardType="decimal-pad"
        value={amount}
        onChangeText={setAmount}
        error={errors.amount}
      />

      {/* Category */}
      <View>
        <Text className="text-sm font-medium text-text mb-xs">Category</Text>
        <View className="flex-row flex-wrap gap-xs">
          {categories.map((cat) => (
            <Pressable
              key={cat}
              onPress={() => setCategory(cat)}
              className={`px-sm py-xs rounded-full border ${
                category === cat
                  ? 'bg-primary border-primary'
                  : 'bg-surface border-border'
              }`}
            >
              <Text
                className={`text-xs ${
                  category === cat ? 'text-white' : 'text-text-secondary'
                }`}
              >
                {cat}
              </Text>
            </Pressable>
          ))}
        </View>
        {errors.category && (
          <Text className="text-xs text-danger mt-xs">{errors.category}</Text>
        )}
      </View>

      {/* Date */}
      <View className="mb-md">
        <Text className="mb-[6px] text-caption font-semibold text-text">Date</Text>
        <Pressable 
          onPress={() => setShowDatePicker(true)}
          className={`rounded-xl px-md py-[15px] bg-surface border-2 ${
            errors.date ? 'border-danger' : 'border-border'
          }`}
        >
          <Text className="text-body text-text">{date}</Text>
        </Pressable>
        {errors.date && (
          <Text className="text-danger mt-1 text-small">{errors.date}</Text>
        )}
      </View>

      {showDatePicker && (
        <DateTimePicker
          value={new Date(date)}
          mode="date"
          display="default"
          onChange={(event, selectedDate) => {
            setShowDatePicker(Platform.OS === 'ios');
            if (selectedDate) {
              setDate(selectedDate.toISOString().split('T')[0]);
            }
          }}
        />
      )}

      {/* Description */}
      <Input
        label="Description (optional)"
        placeholder="Add a description..."
        value={description}
        onChangeText={setDescription}
        multiline
      />

      {/* Actions */}
      <View className="flex-row gap-sm mt-md">
        <View className="flex-1">
          <Button
            title="Cancel"
            variant="outline"
            onPress={onCancel}
          />
        </View>
        <View className="flex-1">
          <Button
            title={transaction ? 'Update' : 'Add'}
            onPress={handleSubmit}
            loading={loading}
          />
        </View>
      </View>
    </View>
  );
}