import { useState, useEffect } from 'react';
import { View, Text, Pressable, ScrollView, Platform, ActivityIndicator } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';

import { Input, Button } from '@/components/ui';
import { useAccounts } from "@/features/accounts/hooks/useAccounts";
import { useTransactionCategories } from '../hooks/useTransactions';
import type { Transaction, CreateTransactionInput, UpdateTransactionInput, TransactionType } from '../types';
import { findSimilarCategory, formatCurrency, getLocalISODate } from '@/shared/utils/categories';

interface TransactionFormProps {
  transaction?: Transaction | null;
  initialType?: TransactionType;
  initialAccountId?: string;
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
];

const INCOME_CATEGORIES = [
  'Salary',
  'Freelance',
  'Investment',
  'Bonus & Commission',
  'Side Hustle',
  'Stocks & Dividends',
  'Crypto & Digital',
];

// Selecting this pill opens the name field. It is never saved as a category,
// but older transactions may still hold it, which is why it isn't a built-in.
const NEW_CATEGORY = 'Other';

// Past this many saved categories the pills get a search field.
const CATEGORY_SEARCH_THRESHOLD = 8;

function isSameCategory(a: string, b: string) {
  return a.toLowerCase() === b.toLowerCase();
}

export default function TransactionForm({
  transaction,
  initialType = 'expense',
  initialAccountId,
  onTypeChange,
  onSubmit,
  onCancel,
  loading,
}: TransactionFormProps) {
  const { data: accounts, isLoading: accountsLoading } = useAccounts();
  
  const [accountId, setAccountId] = useState(transaction?.accountId || initialAccountId || '');
  const [transferAccountId, setTransferAccountId] = useState(transaction?.transferAccountId || '');
  const [type, setType] = useState<TransactionType>(
    transaction?.type || initialType,
  );
  const [amount, setAmount] = useState(
    transaction ? String(transaction.amount) : '',
  );
  const [selectedPill, setSelectedPill] = useState(transaction?.category || '');
  const [customCategory, setCustomCategory] = useState('');
  const [transferFee, setTransferFee] = useState('');
  const [categorySearch, setCategorySearch] = useState('');
  const [description, setDescription] = useState(
    transaction?.description || '',
  );
  const [date, setDate] = useState(
    transaction?.date || getLocalISODate(),
  );
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { data: userCategories } = useTransactionCategories(type);

  const builtInCategories = type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  // The transaction being edited keeps its pill even before the list loads.
  const savedCategories = [
    ...new Set([
      ...(userCategories ?? []),
      ...(transaction?.type === type ? [transaction.category] : []),
    ]),
  ].filter(
    (category) =>
      !isSameCategory(category, NEW_CATEGORY) &&
      !builtInCategories.some((builtIn) => isSameCategory(builtIn, category)),
  );
  const categories = [...builtInCategories, ...savedCategories];
  const showCategorySearch = savedCategories.length > CATEGORY_SEARCH_THRESHOLD;
  const searchTerm = showCategorySearch ? categorySearch.trim().toLowerCase() : '';
  const visibleCategories = categories.filter(
    (category) => !searchTerm || category === selectedPill || category.toLowerCase().includes(searchTerm),
  );

  const fromWallet = accounts?.find((acc) => acc.id === accountId);
  const toWallet = accounts?.find((acc) => acc.id === transferAccountId);
  const transferAmount = Number(amount) > 0 ? Number(amount) : 0;
  const totalLeaving = transferAmount + (Number(transferFee) > 0 ? Number(transferFee) : 0);
  const showTransferSummary = type === 'transfer' && !transaction && transferAmount > 0;

  const handleSwapWallets = () => {
    setAccountId(transferAccountId);
    setTransferAccountId(accountId);
  };
  const similarCategory = selectedPill === NEW_CATEGORY
    ? findSimilarCategory(customCategory, categories)
    : undefined;

  // A new name that only differs by capitalization reuses the existing spelling.
  const getFinalCategory = () => {
    if (selectedPill !== NEW_CATEGORY) return selectedPill;
    const name = customCategory.trim();
    return categories.find((category) => isSameCategory(category, name)) ?? name;
  };

  const handleSelectSimilar = (category: string) => {
    setSelectedPill(category);
    setCustomCategory('');
  };

  // Auto-select first account if none selected
  useEffect(() => {
    if (accounts && accounts.length > 0) {
      if (!accountId) setAccountId(accounts[0].id);
      if (type === 'transfer' && !transferAccountId && accounts.length > 1) {
        const destination = accounts.find((acc) => acc.id !== (accountId || accounts[0].id));
        if (destination) setTransferAccountId(destination.id);
      }
    }
  }, [accounts, accountId, type, transferAccountId]);

  const handleTypeChange = (newType: TransactionType) => {
    setType(newType);
    if (onTypeChange) onTypeChange(newType);
    if (newType === 'transfer') {
      setSelectedPill('Transfer');
    } else {
      const validCategories = newType === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
      if (selectedPill && !validCategories.includes(selectedPill) && selectedPill !== NEW_CATEGORY) {
        setSelectedPill('');
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
    if (transferFee && (isNaN(Number(transferFee)) || Number(transferFee) < 0)) {
      newErrors.transferFee = 'Fee must be a valid amount';
    }
    const finalCategory = getFinalCategory();
    if (type !== 'transfer' && !finalCategory) {
      newErrors.category = 'Category is required';
    } else if (type !== 'transfer' && isSameCategory(finalCategory, NEW_CATEGORY)) {
      newErrors.category = 'Enter a specific category name';
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
      category: type === 'transfer' ? 'Transfer' : getFinalCategory(),
      description: description || undefined,
      date,
    };

    if (transaction) {
      onSubmit({ ...payload, id: transaction.id } as UpdateTransactionInput);
    } else {
      const fee = parseFloat(transferFee);
      onSubmit({
        ...payload,
        fee: type === 'transfer' && fee > 0 ? fee : undefined,
      } as CreateTransactionInput);
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
                <Text className={`text-xs ${accountId === acc.id ? 'text-white' : 'text-text-secondary'}`}>
                  {formatCurrency(acc.balance)}
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
          <View className="flex-row items-center justify-between mb-xs">
            <Text className="text-sm font-medium text-text">To Wallet</Text>
            <Pressable
              onPress={handleSwapWallets}
              disabled={!accountId || !transferAccountId}
              accessibilityRole="button"
              accessibilityLabel="Swap wallets"
              hitSlop={8}
              className="flex-row items-center gap-xs"
            >
              <MaterialCommunityIcons name="swap-vertical" size={18} color="#2563EB" />
              <Text className="text-xs font-semibold text-primary">Swap</Text>
            </Pressable>
          </View>
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
                  <Text className={`text-xs ${transferAccountId === acc.id ? 'text-white' : 'text-text-secondary'}`}>
                    {formatCurrency(acc.balance)}
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

      {/* Transfer Fee */}
      {type === 'transfer' && !transaction && (
        <View>
          <Input
            label="Transfer Fee (optional)"
            placeholder="0.00"
            keyboardType="decimal-pad"
            value={transferFee}
            onChangeText={setTransferFee}
            error={errors.transferFee}
          />
          {Number(transferFee) > 0 && (
            <Text className="text-xs text-text-secondary">The fee is saved as an expense.</Text>
          )}
        </View>
      )}

      {/* Transfer Summary */}
      {showTransferSummary && fromWallet && toWallet && (
        <View className="bg-surface rounded-xl border border-border p-md gap-xs">
          <View className="flex-row justify-between">
            <Text className="text-sm text-text-secondary">{fromWallet.name}</Text>
            <Text className="text-sm font-semibold text-text">
              {formatCurrency(fromWallet.balance)} → {formatCurrency(fromWallet.balance - totalLeaving)}
            </Text>
          </View>
          <View className="flex-row justify-between">
            <Text className="text-sm text-text-secondary">{toWallet.name}</Text>
            <Text className="text-sm font-semibold text-text">
              {formatCurrency(toWallet.balance)} → {formatCurrency(toWallet.balance + transferAmount)}
            </Text>
          </View>
        </View>
      )}

      {/* Category */}
      {type !== 'transfer' && (
        <View>
          <Text className="text-sm font-medium text-text mb-xs">Category</Text>
          {showCategorySearch && (
            <Input
              placeholder="Search categories"
              value={categorySearch}
              onChangeText={setCategorySearch}
            />
          )}
          <View className="flex-row flex-wrap gap-xs">
            {visibleCategories.map((cat) => (
              <Pressable
                key={cat}
                onPress={() => setSelectedPill(cat)}
                className={`px-sm py-xs rounded-full border ${
                  selectedPill === cat
                    ? 'bg-primary border-primary'
                    : 'bg-surface border-border'
                }`}
              >
                <Text
                  className={`text-xs ${
                    selectedPill === cat ? 'text-white' : 'text-text-secondary'
                  }`}
                >
                  {cat}
                </Text>
              </Pressable>
            ))}
            <Pressable
              onPress={() => setSelectedPill(NEW_CATEGORY)}
              className={`px-sm py-xs rounded-full border ${
                selectedPill === NEW_CATEGORY
                  ? 'bg-primary border-primary'
                  : 'bg-surface border-border'
              }`}
            >
              <Text
                className={`text-xs ${
                  selectedPill === NEW_CATEGORY ? 'text-white' : 'text-text-secondary'
                }`}
              >
                + New category
              </Text>
            </Pressable>
          </View>
          {selectedPill === NEW_CATEGORY && (
            <View className="mt-md">
              <Input
                label="Category Name"
                placeholder="e.g. Gym, Subscription"
                value={customCategory}
                onChangeText={setCustomCategory}
              />
              {similarCategory && (
                <Pressable onPress={() => handleSelectSimilar(similarCategory)} className="mt-xs">
                  <Text className="text-xs text-primary">Did you mean {similarCategory}?</Text>
                </Pressable>
              )}
            </View>
          )}
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
              setDate(getLocalISODate(selectedDate));
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
