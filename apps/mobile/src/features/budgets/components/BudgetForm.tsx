import { useState, useEffect } from 'react';
import { View, Text, Pressable, Platform, ScrollView, ActivityIndicator } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';

import { Input, Button } from '@/components/ui';
import { useAccounts } from '@/features/accounts/hooks/useAccounts';
import type { Budget, CreateBudgetInput, UpdateBudgetInput, PeriodType } from '../types';

interface BudgetFormProps {
  budget?: Budget | null;
  onSubmit: (data: CreateBudgetInput | UpdateBudgetInput) => void;
  onCancel: () => void;
  loading?: boolean;
}

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

const PERIODS: { label: string; value: PeriodType }[] = [
  { label: 'Weekly', value: 'weekly' },
  { label: 'Monthly', value: 'monthly' },
  { label: 'Yearly', value: 'yearly' },
  { label: 'Custom', value: 'custom' },
];

export default function BudgetForm({
  budget,
  onSubmit,
  onCancel,
  loading,
}: BudgetFormProps) {
  const { data: accounts, isLoading: accountsLoading } = useAccounts();

  const [accountId, setAccountId] = useState(budget?.accountId || '');
  const [category, setCategory] = useState(budget?.category || '');
  const [amount, setAmount] = useState(
    budget ? String(budget.amount) : '',
  );
  const [periodType, setPeriodType] = useState<PeriodType>(
    budget?.periodType || 'monthly'
  );
  
  // Default dates logic
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  const [startDate, setStartDate] = useState(
    budget?.startDate || firstDay.toISOString().split('T')[0]
  );
  const [endDate, setEndDate] = useState(
    budget?.endDate || lastDay.toISOString().split('T')[0]
  );

  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (accounts && accounts.length > 0 && !accountId) {
      setAccountId(accounts[0].id);
    }
  }, [accounts, accountId]);

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!accountId) {
      newErrors.accountId = 'Wallet/Account is required';
    }
    if (!category) {
      newErrors.category = 'Category is required';
    }
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      newErrors.amount = 'Amount must be greater than zero';
    }
    if (!startDate) {
      newErrors.startDate = 'Start date is required';
    }
    if (!endDate) {
      newErrors.endDate = 'End date is required';
    }
    if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
      newErrors.endDate = 'End date must be after start date';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) return;

    const payload = {
      accountId,
      category,
      amount: parseFloat(amount),
      periodType,
      startDate,
      endDate,
    };

    if (budget) {
      onSubmit({ ...payload, id: budget.id } as UpdateBudgetInput);
    } else {
      onSubmit(payload as CreateBudgetInput);
    }
  };

  return (
    <View className="gap-lg">
      {/* Wallet Selector */}
      <View>
        <Text className="text-sm font-medium text-text mb-xs">Wallet</Text>
        {accountsLoading ? (
          <ActivityIndicator size="small" color="#2563EB" style={{ alignSelf: 'flex-start' }} />
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {accounts?.map((acc) => (
              <Pressable
                key={acc.id}
                onPress={() => setAccountId(acc.id)}
                className={`px-md py-sm rounded-xl border ${
                  accountId === acc.id
                    ? 'bg-primary border-primary'
                    : 'bg-surface border-border'
                }`}
              >
                <Text
                  className={`font-semibold ${
                    accountId === acc.id ? 'text-white' : 'text-text-secondary'
                  }`}
                >
                  {acc.name}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        )}
        {errors.accountId && (
          <Text className="text-xs text-danger mt-xs">{errors.accountId}</Text>
        )}
      </View>

      {/* Category */}
      <View>
        <Text className="text-sm font-medium text-text mb-xs">Category</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="py-2">
          <View className="flex-row gap-xs pr-4">
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
        </ScrollView>
        {errors.category && (
          <Text className="text-xs text-danger mt-xs">{errors.category}</Text>
        )}
      </View>

      {/* Amount */}
      <Input
        label="Amount limit"
        placeholder="0.00"
        keyboardType="decimal-pad"
        value={amount}
        onChangeText={setAmount}
        error={errors.amount}
      />

      {/* Period */}
      <View>
        <Text className="text-sm font-medium text-text mb-xs">Period</Text>
        <View className="flex-row gap-xs flex-wrap">
          {PERIODS.map((p) => (
            <Pressable
              key={p.value}
              onPress={() => setPeriodType(p.value)}
              className={`px-md py-sm rounded-xl border flex-1 ${
                periodType === p.value
                  ? 'bg-primary border-primary'
                  : 'bg-surface border-border'
              }`}
            >
              <Text
                className={`text-center font-semibold ${
                  periodType === p.value ? 'text-white' : 'text-text-secondary'
                }`}
              >
                {p.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Dates */}
      <View className="flex-row gap-md">
        <View className="flex-1">
          <Text className="text-sm font-medium text-text mb-xs">Start Date</Text>
          <Pressable 
            onPress={() => setShowStartDatePicker(true)}
            className={`rounded-xl px-md py-3 bg-surface border ${
              errors.startDate ? 'border-danger' : 'border-border'
            }`}
          >
            <Text className="text-text">{startDate}</Text>
          </Pressable>
        </View>
        <View className="flex-1">
          <Text className="text-sm font-medium text-text mb-xs">End Date</Text>
          <Pressable 
            onPress={() => setShowEndDatePicker(true)}
            className={`rounded-xl px-md py-3 bg-surface border ${
              errors.endDate ? 'border-danger' : 'border-border'
            }`}
          >
            <Text className="text-text">{endDate}</Text>
          </Pressable>
        </View>
      </View>

      {(errors.startDate || errors.endDate) && (
        <Text className="text-xs text-danger">
          {errors.startDate || errors.endDate}
        </Text>
      )}

      {showStartDatePicker && (
        <DateTimePicker
          value={new Date(startDate)}
          mode="date"
          display="default"
          onChange={(event, date) => {
            setShowStartDatePicker(Platform.OS === 'ios');
            if (date) setStartDate(date.toISOString().split('T')[0]);
          }}
        />
      )}

      {showEndDatePicker && (
        <DateTimePicker
          value={new Date(endDate)}
          mode="date"
          display="default"
          minimumDate={new Date(startDate)}
          onChange={(event, date) => {
            setShowEndDatePicker(Platform.OS === 'ios');
            if (date) setEndDate(date.toISOString().split('T')[0]);
          }}
        />
      )}

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
            title={budget ? 'Update' : 'Add'}
            onPress={handleSubmit}
            loading={loading}
          />
        </View>
      </View>
    </View>
  );
}
