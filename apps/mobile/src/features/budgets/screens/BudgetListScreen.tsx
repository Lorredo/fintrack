import { useState, useCallback } from 'react';
import { View, Text, FlatList, Alert, Pressable, RefreshControl } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { Screen, Loader, EmptyState, Button, Modal, Card, ProgressBar, CategoryIcon } from '@/components/ui';
import {
  useBudgetList,
  useCreateBudget,
  useUpdateBudget,
  useDeleteBudget,
} from '../hooks/useBudgets';
import BudgetForm from '../components/BudgetForm';
import type { Budget, CreateBudgetInput, UpdateBudgetInput } from '../types';
import { formatCurrency, formatMonth, getCategoryColor } from '@/shared/utils/categories';


export default function BudgetListScreen() {
  const [showForm, setShowForm] = useState(false);
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const currentMonth = new Date().toISOString().slice(0, 7);

  const { data, isLoading, isError, refetch, isRefetching } = useBudgetList(currentMonth);
  const createMutation = useCreateBudget();
  const updateMutation = useUpdateBudget();
  const deleteMutation = useDeleteBudget();

  const budgets = data?.data ?? [];
  const totalBudget = budgets.reduce((sum, b) => sum + (Number(b.amount) || 0), 0);
  const totalSpent = budgets.reduce((sum, b) => sum + (Number(b.spent) || 0), 0);
  const totalRemaining = totalBudget - totalSpent;
  const totalPercent = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;

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

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

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
          <Button
            icon="plus"
            onPress={handleAddNew}
            style={{ width: 44, height: 44, paddingHorizontal: 5}}
          />
        </View>

        <Text className="text-sm text-text-secondary mb-md">
          Monthly budgets for {formatMonth(currentMonth)}
        </Text>

        {/* Total Budget Overview */}
        {budgets.length > 0 && (
          <Card style={{ marginBottom: 16 }}>
            <View className="flex-row items-center justify-between mb-xs">
              <Text className="text-sm text-text-secondary">Monthly Spending Limit</Text>
              <MaterialCommunityIcons name="wallet-outline" size={20} color="#64748B" />
            </View>
            <View className="flex-row items-baseline gap-xs mb-sm">
              <Text className="text-2xl font-bold text-text">
                {formatCurrency(totalSpent)}
              </Text>
              <Text className="text-base text-text-secondary">
                / {formatCurrency(totalBudget)}
              </Text>
            </View>

            <ProgressBar progress={totalPercent} height={10} />

            <Text className={`text-sm font-semibold mt-sm ${totalRemaining >= 0 ? 'text-success' : 'text-danger'}`}>
              {totalRemaining >= 0
                ? `${formatCurrency(totalRemaining)} left of your total budget`
                : `${formatCurrency(Math.abs(totalRemaining))} over budget`}
            </Text>
          </Card>
        )}

        {/* Budget list */}
        {budgets.length === 0 ? (
          <EmptyState
            title="No budgets set"
            description="Set monthly budgets to track your spending limits."
            action={<Button title="Add Budget" icon="plus" onPress={handleAddNew} />}
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
            refreshControl={
              <RefreshControl refreshing={refreshing || isRefetching} onRefresh={handleRefresh} />
            }
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
  const spent = Number(budget.spent) || 0;
  const amount = Number(budget.amount) || 0;
  const remaining = Number(budget.remaining) || 0;
  const percentUsed = amount > 0
    ? Math.min((spent / amount) * 100, 100)
    : 0;
  const isOverBudget = remaining < 0;
  const isNearLimit = percentUsed >= 80 && !isOverBudget;
  const color = getCategoryColor(budget.category);

  return (
    <Card>
      <View className="flex-row items-center justify-between mb-sm">
        <View className="flex-row items-center gap-sm">
          <CategoryIcon category={budget.category} size="sm" />
          <Text className="text-base font-semibold text-text">
            {budget.category}
          </Text>
        </View>
        {isNearLimit && (
          <View className="flex-row items-center bg-warning/20 px-sm py-xs rounded-full gap-xs">
            <MaterialCommunityIcons name="alert" size={12} color="#F59E0B" />
            <Text className="text-xs font-semibold text-warning">Near Limit</Text>
          </View>
        )}
        {isOverBudget && (
          <View className="flex-row items-center bg-danger/20 px-sm py-xs rounded-full gap-xs">
            <MaterialCommunityIcons name="alert-octagon" size={12} color="#EF4444" />
            <Text className="text-xs font-semibold text-danger">Over Budget</Text>
          </View>
        )}
      </View>

      <View className="flex-row items-baseline gap-xs mb-sm">
        <Text className="text-lg font-bold text-text">
          {formatCurrency(budget.spent)}
        </Text>
        <Text className="text-sm text-text-secondary">
          / {formatCurrency(budget.amount)}
        </Text>
      </View>

      <ProgressBar progress={percentUsed} color={color} height={8} />

      <View className="flex-row justify-between mt-sm">
        <Text className="text-xs text-text-secondary">
          {percentUsed.toFixed(0)}% used
        </Text>
        <View className="flex-row gap-xs">
          <Pressable onPress={() => onEdit(budget)} className="p-xs">
            <MaterialCommunityIcons name="pencil" size={16} color="#2563EB" />
          </Pressable>
          <Pressable onPress={() => onDelete(budget.id)} className="p-xs">
            <MaterialCommunityIcons name="trash-can-outline" size={16} color="#EF4444" />
          </Pressable>
        </View>
      </View>
    </Card>
  );
}