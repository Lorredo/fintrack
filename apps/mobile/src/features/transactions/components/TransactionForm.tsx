import { useState, useEffect } from 'react';
import { View, Text, Pressable, ScrollView, Platform, ActivityIndicator } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';

import { Input, Button } from '@/components/ui';
import { useAccounts } from "@/features/accounts/hooks/useAccounts";
import type { Transaction, CreateTransactionInput, UpdateTransactionInput, TransactionType } from '../types';

interface TransactionFormProps {
  transaction?: Transaction | null;
  initialType?: TransactionType;
  onTypeChange?: (type: TransactionType) => void;
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
  onTypeChange,
  onSubmit,
  onCancel,
  loading,
}: TransactionFormProps) {
  const { data: accounts, isLoading: accountsLoading } = useAccounts();
  
  const [accountId, setAccountId] = useState(transaction?.accountId || '');
  const [transferAccountId, setTransferAccountId] = useState(transaction?.transferAccountId || '');
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

  // Auto-select first account if none selected
  useEffect(() => {
    if (accounts && accounts.length > 0) {
      if (!accountId) setAccountId(accounts[0].id);
      if (type === 'transfer' && !transferAccountId && accounts.length > 1) {
        setTransferAccountId(accounts[1].id);
      }
    }
  }, [accounts, accountId, type, transferAccountId]);

  const handleTypeChange = (newType: TransactionType) => {
    setType(newType);
    if (onTypeChange) onTypeChange(newType);
    if (newType === 'transfer') {
      setCategory('Transfer');
    } else {
      const validCategories = newType === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
      if (category && !validCategories.includes(category)) {
        setCategory('');
      }
    }
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!accountId) {
      newErrors.accountId = 'Wallet/Account is required';
    }
    if (type === 'transfer') {
      if (!transferAccountId) {
        newErrors.transferAccountId = 'Destination Wallet is required';
      } else if (accountId === transferAccountId) {
        newErrors.transferAccountId = 'Destination cannot be the same as Source';
      }
    }
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      newErrors.amount = 'Amount must be greater than zero';
    }
    if (type !== 'transfer' && !category) {
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
      accountId,
      transferAccountId: type === 'transfer' ? transferAccountId : undefined,
      type,
      amount: parseFloat(amount),
      category: type === 'transfer' ? 'Transfer' : category,
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
      {initialType !== 'transfer' && transaction?.type !== 'transfer' && (
        <View className="flex-row gap-sm mb-xs">
          <Pressable
            onPress={() => handleTypeChange('expense')}
            className={`flex-1 py-sm px-2 rounded-lg border-2 ${
              type === 'expense'
                ? 'border-danger bg-danger/10'
                : 'border-border bg-surface'
            }`}
          >
            <Text
              className={`text-center font-semibold text-sm ${
                type === 'expense' ? 'text-danger' : 'text-text-secondary'
              }`}
            >
              Expense
            </Text>
          </Pressable>
          <Pressable
            onPress={() => handleTypeChange('income')}
            className={`flex-1 py-sm px-2 rounded-lg border-2 ${
              type === 'income'
                ? 'border-success bg-success/10'
                : 'border-border bg-surface'
            }`}
          >
            <Text
              className={`text-center font-semibold text-sm ${
                type === 'income' ? 'text-success' : 'text-text-secondary'
              }`}
            >
              Income
            </Text>
          </Pressable>
        </View>
      )}

      {/* Wallet Selector (From) */}
      <View>
        <Text className="text-sm font-medium text-text mb-xs">
          {type === 'transfer' ? 'From Wallet' : 'Wallet'}
        </Text>
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

      {/* Wallet Selector (To) */}
      {type === 'transfer' && (
        <View>
          <Text className="text-sm font-medium text-text mb-xs">To Wallet</Text>
          {accountsLoading ? (
            <ActivityIndicator size="small" color="#2563EB" style={{ alignSelf: 'flex-start' }} />
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {accounts?.map((acc) => (
                <Pressable
                  key={acc.id}
                  onPress={() => setTransferAccountId(acc.id)}
                  className={`px-md py-sm rounded-xl border ${
                    transferAccountId === acc.id
                      ? 'bg-primary border-primary'
                      : 'bg-surface border-border'
                  }`}
                >
                  <Text
                    className={`font-semibold ${
                      transferAccountId === acc.id ? 'text-white' : 'text-text-secondary'
                    }`}
                  >
                    {acc.name}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          )}
          {errors.transferAccountId && (
            <Text className="text-xs text-danger mt-xs">{errors.transferAccountId}</Text>
          )}
        </View>
      )}

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
      {type !== 'transfer' && (
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
      )}

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
      {type !== 'transfer' && (
        <Input
          label="Description (optional)"
          placeholder="Add a description..."
          value={description}
          onChangeText={setDescription}
          multiline
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
            title={transaction ? 'Update' : 'Confirm'}
            onPress={handleSubmit}
            loading={loading}
          />
        </View>
      </View>
    </View>
  );
}
