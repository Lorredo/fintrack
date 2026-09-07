import { useState, useMemo, useEffect } from 'react';
import { View, Text, Pressable, Platform } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';

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

const PERIOD_TYPES = ['daily', 'weekly', 'monthly', 'custom'] as const;
type PeriodType = typeof PERIOD_TYPES[number];

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
  
  const [periodType, setPeriodType] = useState<PeriodType>(
    (budget?.periodType as PeriodType) || 'monthly'
  );
  const [periodLength, setPeriodLength] = useState('1');
  
  const [startDate, setStartDate] = useState(
    budget?.startDate ? new Date(budget.startDate) : new Date()
  );
  
  const [endDate, setEndDate] = useState(
    budget?.endDate ? new Date(budget.endDate) : new Date()
  );

  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Auto-calculate end date when start date, period type, or length changes
  useEffect(() => {
    if (periodType === 'custom') return;
    
    const length = parseInt(periodLength) || 1;
    const newEnd = new Date(startDate);
    
    if (periodType === 'daily') {
      newEnd.setDate(startDate.getDate() + length - 1);
    } else if (periodType === 'weekly') {
      newEnd.setDate(startDate.getDate() + (length * 7) - 1);
    } else if (periodType === 'monthly') {
      newEnd.setMonth(startDate.getMonth() + length);
      newEnd.setDate(newEnd.getDate() - 1);
    }
    
    setEndDate(newEnd);
  }, [startDate, periodType, periodLength]);

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!category) newErrors.category = 'Category is required';
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      newErrors.amount = 'Amount must be greater than zero';
    }
    if (periodType !== 'custom' && (!periodLength || parseInt(periodLength) < 1)) {
      newErrors.periodLength = 'Must be at least 1';
    }
    if (endDate < startDate) {
      newErrors.endDate = 'End date cannot be before start date';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) return;

    const payload = {
      category,
      amount: parseFloat(amount),
      periodType,
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
    };

    if (budget) {
      onSubmit({ ...payload, id: budget.id } as UpdateBudgetInput);
    } else {
      onSubmit(payload as CreateBudgetInput);
    }
  };

  return (
    <View className="gap-md pb-xl">
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

      {/* Period Type */}
      <View>
        <Text className="text-sm font-medium text-text mb-xs">Recurrence</Text>
        <View className="flex-row flex-wrap gap-xs mb-sm">
          {PERIOD_TYPES.map((type) => (
            <Pressable
              key={type}
              onPress={() => {
                setPeriodType(type);
                if (type === 'daily' || type === 'weekly' || type === 'monthly') {
                  setPeriodLength('1');
                }
              }}
              className={`px-md py-sm rounded-lg border ${
                periodType === type
                  ? 'bg-primary/10 border-primary'
                  : 'bg-surface border-border'
              }`}
            >
              <Text
                className={`text-sm capitalize ${
                  periodType === type ? 'text-primary font-semibold' : 'text-text-secondary'
                }`}
              >
                {type}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Period Length (Only for non-custom) */}
      {periodType !== 'custom' && (
        <Input
          label={`Number of ${periodType === 'daily' ? 'days' : periodType === 'weekly' ? 'weeks' : 'months'}`}
          placeholder="1"
          keyboardType="number-pad"
          value={periodLength}
          onChangeText={setPeriodLength}
          error={errors.periodLength}
        />
      )}

      {/* Date Pickers */}
      <View className="flex-row gap-sm">
        <View className="flex-1">
          <Text className="text-sm font-medium text-text mb-xs">Start Date</Text>
          <Pressable 
            onPress={() => setShowStartDatePicker(true)}
            className="rounded-xl px-md py-[15px] bg-surface border-2 border-border"
          >
            <Text className="text-body text-text">{startDate.toLocaleDateString()}</Text>
          </Pressable>
        </View>

        <View className="flex-1">
          <Text className="text-sm font-medium text-text mb-xs">End Date</Text>
          <Pressable 
            onPress={() => periodType === 'custom' && setShowEndDatePicker(true)}
            className={`rounded-xl px-md py-[15px] ${periodType !== 'custom' ? 'bg-background' : 'bg-surface'} border-2 ${
              errors.endDate ? 'border-danger' : 'border-border'
            }`}
          >
            <Text className={`text-body ${periodType !== 'custom' ? 'text-text-tertiary' : 'text-text'}`}>
              {endDate.toLocaleDateString()}
            </Text>
          </Pressable>
          {errors.endDate && (
            <Text className="text-xs text-danger mt-xs">{errors.endDate}</Text>
          )}
        </View>
      </View>

      {showStartDatePicker && (
        <DateTimePicker
          value={startDate}
          mode="date"
          display="default"
          onChange={(event, selectedDate) => {
            setShowStartDatePicker(Platform.OS === 'ios');
            if (event.type === 'set' && selectedDate) {
              setStartDate(selectedDate);
            } else if (event.type === 'dismissed') {
              setShowStartDatePicker(false);
            }
          }}
        />
      )}

      {showEndDatePicker && periodType === 'custom' && (
        <DateTimePicker
          value={endDate}
          mode="date"
          display="default"
          onChange={(event, selectedDate) => {
            setShowEndDatePicker(Platform.OS === 'ios');
            if (event.type === 'set' && selectedDate) {
              setEndDate(selectedDate);
            } else if (event.type === 'dismissed') {
              setShowEndDatePicker(false);
            }
          }}
        />
      )}

      {/* Actions */}
      <View className="flex-row gap-sm mt-md">
        <View className="flex-1">
          <Button title="Cancel" variant="outline" onPress={onCancel} />
        </View>
        <View className="flex-1">
          <Button
            title={budget ? 'Update Budget' : 'Save Budget'}
            onPress={handleSubmit}
            loading={loading}
          />
        </View>
      </View>
    </View>
  );
}