import { useState } from 'react';
import { View, Text, Pressable } from 'react-native';

import { Input, Button } from '@/components/ui';
import type { Budget, CreateBudgetInput, UpdateBudgetInput } from '../types';

const CATEGORIES = [
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

interface BudgetFormProps {
  budget?: Budget | null;
  onSubmit: (data: CreateBudgetInput | UpdateBudgetInput) => void;
  onCancel: () => void;
  loading?: boolean;
}

export default function BudgetForm({
  budget,
  onSubmit,
  onCancel,
  loading,
}: BudgetFormProps) {
  const [category, setCategory] = useState(budget?.category || '');
  const [amount, setAmount] = useState(budget ? String(budget.amount) : '');
  const [month, setMonth] = useState(
    budget?.month || new Date().toISOString().slice(0, 7),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!category) {
      newErrors.category = 'Category is required';
    }
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      newErrors.amount = 'Amount must be greater than zero';
    }
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      newErrors.month = 'Month must be in YYYY-MM format';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) return;

    const payload = {
      category,
      amount: parseFloat(amount),
      month,
    };

    if (budget) {
      onSubmit({ ...payload, id: budget.id } as UpdateBudgetInput);
    } else {
      onSubmit(payload as CreateBudgetInput);
    }
  };

  return (
    <View className="gap-lg">
      {/* Category */}
      <View>
        <Text className="text-sm font-medium text-text mb-xs">Category</Text>
        <View className="flex-row flex-wrap gap-xs">
          {CATEGORIES.map((cat) => (
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

      {/* Amount */}
      <Input
        label="Budget Amount"
        placeholder="0.00"
        keyboardType="decimal-pad"
        value={amount}
        onChangeText={setAmount}
        error={errors.amount}
      />

      {/* Month */}
      <Input
        label="Month"
        placeholder="YYYY-MM"
        value={month}
        onChangeText={setMonth}
        error={errors.month}
      />

      {/* Actions */}
      <View className="flex-row gap-sm mt-md">
        <View className="flex-1">
          <Button title="Cancel" variant="outline" onPress={onCancel} />
        </View>
        <View className="flex-1">
          <Button
            title={budget ? 'Update' : 'Create'}
            onPress={handleSubmit}
            loading={loading}
          />
        </View>
      </View>
    </View>
  );
}