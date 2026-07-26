import { useState, useCallback } from 'react';
import { View, Text, FlatList, Alert } from 'react-native';

import { Screen, Loader, EmptyState, Button, Modal, Card } from '@/components/ui';
import {
  useBudgetList,
  useCreateBudget,
  useUpdateBudget,
  useDeleteBudget,
} from '../hooks/useBudgets';
import BudgetForm from '../components/BudgetForm';
import type { Budget, CreateBudgetInput, UpdateBudgetInput } from '../types';

export default function BudgetListScreen() {
  const [showForm, setShowForm] = useState(false);
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null);
  const currentMonth = new Date().toISOString().slice(0, 7);

  const { data, isLoading, isError, refetch } = useBudgetList(currentMonth);
  const createMutation = useCreateBudget();
  const updateMutation = useUpdateBudget();
  const deleteMutation = useDeleteBudget();

  const budgets = data?.data ?? [];

  const handleCreate = useCallback(
    (input: CreateBudgetInput) => {
      createMutation.mutate(input, {
        onSuccess: () => {
          setShowForm(false);
        },
        onError: () => {
          Alert.alert('Error', 'Failed to create budget');
        },
      });
    },
    [createMutation],
  );

  const handleUpdate = useCallback(
    (input: UpdateBudgetInput) => {
      updateMutation.mutate(input, {
        onSuccess: () => {
          setEditingBudget(null);
          setShowForm(false);
        },
        onError: () => {
          Alert.alert('Error', 'Failed to update budget');
        },
      });
    },
    [updateMutation],
  );

  const handleDelete = useCallback(
    (id: string) => {
      Alert.alert(
        'Delete Budget',
        'Are you sure you want to delete this budget?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: () => {
              deleteMutation.mutate(id, {
                onError: () => {
                  Alert.alert('Error', 'Failed to delete budget');
                },
              });
            },
          },
        ],
      );
    },
    [deleteMutation],
  );

  const handleEdit = useCallback((budget: Budget) => {
    setEditingBudget(budget);
    setShowForm(true);
  }, []);

  const handleAddNew = useCallback(() => {
    setEditingBudget(null);
    setShowForm(true);
  }, []);

  const handleCloseForm = useCallback(() => {
    setShowForm(false);
    setEditingBudget(null);
  }, []);

  const handleSubmit = useCallback(
    (data: CreateBudgetInput | UpdateBudgetInput) => {
      if ('id' in data) {
        handleUpdate(data as UpdateBudgetInput);
      } else {
        handleCreate(data as CreateBudgetInput);
      }
    },
    [handleCreate, handleUpdate],
  );

  if (isLoading) {
    return (
      <Screen>
        <Loader />
      </Screen>
    );
  }

  if (isError) {
    return (
      <Screen>
        <View className="flex-1 items-center justify-center">
          <Text className="text-text-secondary mb-md">Failed to load budgets</Text>
          <Button title="Retry" onPress={() => refetch()} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <View className="flex-1">
        {/* Header */}
        <View className="flex-row items-center justify-between mb-md">
          <Text className="text-2xl font-bold text-text">Budgets</Text>
          <Button title="Add" onPress={handleAddNew} />
        </View>

        <Text className="text-sm text-text-secondary mb-md">
          Monthly budgets for {formatMonth(currentMonth)}
        </Text>

        {/* Budget list */}
        {budgets.length === 0 ? (
          <EmptyState
            title="No budgets set"
            description="Set monthly budgets to track your spending limits."
            action={<Button title="Add Budget" onPress={handleAddNew} />}
          />
        ) : (
          <FlatList
            data={budgets}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <BudgetCard
                budget={item}
                onEdit={handleEdit}
                onDelete={handleDelete}
              />
            )}
            contentContainerClassName="gap-sm pb-lg"
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>

      {/* Add/Edit Modal */}
      <Modal
        visible={showForm}
        onClose={handleCloseForm}
        title={editingBudget ? 'Edit Budget' : 'Add Budget'}
      >
        <BudgetForm
          budget={editingBudget}
          onSubmit={handleSubmit}
          onCancel={handleCloseForm}
          loading={createMutation.isPending || updateMutation.isPending}
        />
      </Modal>
    </Screen>
  );
}

function BudgetCard({
  budget,
  onEdit,
  onDelete,
}: {
  budget: Budget;
  onEdit: (budget: Budget) => void;
  onDelete: (id: string) => void;
}) {
  const percentUsed = budget.amount > 0
    ? Math.min((budget.spent / budget.amount) * 100, 100)
    : 0;
  const isOverBudget = budget.remaining < 0;
  const progressColor = isOverBudget
    ? 'bg-danger'
    : percentUsed > 80
    ? 'bg-warning'
    : 'bg-success';

  return (
    <Card>
      <View className="flex-row items-center justify-between mb-sm">
        <Text className="text-base font-semibold text-text">
          {getCategoryEmoji(budget.category)} {budget.category}
        </Text>
        <View className="flex-row gap-sm">
          <Button
            title="Edit"
            variant="outline"
            onPress={() => onEdit(budget)}
          />
          <Button
            title="Delete"
            variant="danger"
            onPress={() => onDelete(budget.id)}
          />
        </View>
      </View>

      {/* Progress bar */}
      <View className="h-3 bg-border rounded-full mb-xs">
        <View
          className={`h-full rounded-full ${progressColor}`}
          style={{ width: `${percentUsed}%` }}
        />
      </View>

      {/* Stats */}
      <View className="flex-row justify-between">
        <View>
          <Text className="text-xs text-text-secondary">Spent</Text>
          <Text className={`text-sm font-semibold ${isOverBudget ? 'text-danger' : 'text-text'}`}>
            ${budget.spent.toFixed(2)}
          </Text>
        </View>
        <View className="items-center">
          <Text className="text-xs text-text-secondary">Budget</Text>
          <Text className="text-sm font-semibold text-text">
            ${budget.amount.toFixed(2)}
          </Text>
        </View>
        <View className="items-end">
          <Text className="text-xs text-text-secondary">Remaining</Text>
          <Text className={`text-sm font-semibold ${isOverBudget ? 'text-danger' : 'text-success'}`}>
            {isOverBudget ? '-' : ''}${Math.abs(budget.remaining).toFixed(2)}
          </Text>
        </View>
      </View>
    </Card>
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

function formatMonth(month: string): string {
  const [year, m] = month.split('-');
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  return `${months[parseInt(m, 10) - 1]} ${year}`;
}