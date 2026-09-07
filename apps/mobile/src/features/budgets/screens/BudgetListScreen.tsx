import { useState, useCallback } from 'react';
import { View, Text, FlatList, Alert, Pressable, RefreshControl } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { Screen, Loader, EmptyState, Button, ProgressBar, CategoryIcon } from '@/components/ui';
import {
  useBudgetList,
  useDeleteBudget,
} from '../hooks/useBudgets';
import { useUIStore } from '@/shared/store/ui.store';
import type { Budget } from '../types';
import { formatCurrency, getCategoryColor } from '@/shared/utils/categories';


export default function BudgetListScreen() {
  const router = useRouter();
  const setEditingBudget = useUIStore((state) => state.setEditingBudget);
  const setRebalancingBudget = useUIStore((state) => state.setRebalancingBudget);

  const [refreshing, setRefreshing] = useState(false);
  const currentDate = new Date().toISOString().split('T')[0];

  const { data, isLoading, isError, refetch, isRefetching } = useBudgetList(currentDate);
  const deleteMutation = useDeleteBudget();

  const budgets = data?.data ?? [];

  const handleEdit = useCallback(
    (budget: Budget) => {
      setEditingBudget(budget);
      router.push('/budget-form');
    },
    [setEditingBudget, router],
  );

  const handleCoverIt = useCallback(
    (budget: Budget) => {
      setRebalancingBudget(budget);
      router.push('/rebalance-form');
    },
    [setRebalancingBudget, router],
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

  const handleAddNew = useCallback(() => {
    setEditingBudget(null);
    router.push('/budget-form');
  }, [router, setEditingBudget]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

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
      <View style={{ flex: 1 }}>
        {/* Header */}
        <View style={{ paddingTop: 16, paddingBottom: 12 }}>
          <Text style={{ fontSize: 26, fontWeight: '700', color: '#111827', letterSpacing: -0.5 }}>Budgets</Text>
          <Text style={{ fontSize: 13, color: '#6B7280', marginTop: 2 }}>
            Active Budgets as of {new Date(currentDate).toLocaleDateString()}
          </Text>
        </View>

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
                onCoverIt={handleCoverIt}
              />
            )}
            contentContainerStyle={{ gap: 10, paddingBottom: 100 }}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={refreshing || isRefetching} onRefresh={handleRefresh} tintColor="#2563EB" />
            }
          />
        )}
      </View>

      {/* Floating Action Button */}
      <Pressable
        onPress={handleAddNew}
        style={{
          position: 'absolute',
          bottom: 24,
          right: 0,
          width: 56,
          height: 56,
          borderRadius: 28,
          backgroundColor: '#2563EB',
          alignItems: 'center',
          justifyContent: 'center',
          shadowColor: '#2563EB',
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.4,
          shadowRadius: 12,
          elevation: 8,
        }}
      >
        <MaterialCommunityIcons name="plus" size={28} color="#fff" />
      </Pressable>

    </Screen>
  );
}

function BudgetCard({
  budget,
  onEdit,
  onDelete,
  onCoverIt,
}: {
  budget: Budget;
  onEdit: (budget: Budget) => void;
  onDelete: (id: string) => void;
  onCoverIt?: (budget: Budget) => void;
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
    <View
      style={{
        backgroundColor: '#fff',
        borderRadius: 20,
        padding: 18,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 6,
        elevation: 2,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <CategoryIcon category={budget.category} size="sm" />
          <Text style={{ fontSize: 15, fontWeight: '600', color: '#111827' }}>
            {budget.category}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          {isNearLimit && (
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFBEB', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, gap: 3 }}>
              <MaterialCommunityIcons name="alert" size={11} color="#F59E0B" />
              <Text style={{ fontSize: 11, fontWeight: '700', color: '#F59E0B' }}>Near Limit</Text>
            </View>
          )}
          {isOverBudget && (
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEF2F2', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, gap: 3 }}>
              <MaterialCommunityIcons name="alert-octagon" size={11} color="#EF4444" />
              <Text style={{ fontSize: 11, fontWeight: '700', color: '#EF4444' }}>Over</Text>
            </View>
          )}
        </View>
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4, marginBottom: 10 }}>
        <Text style={{ fontSize: 20, fontWeight: '700', color: '#111827' }}>
          {formatCurrency(budget.spent)}
        </Text>
        <Text style={{ fontSize: 13, color: '#9CA3AF' }}>
          / {formatCurrency(budget.amount)}
        </Text>
        <Text style={{ fontSize: 11, color: '#9CA3AF', marginLeft: 'auto', textTransform: 'capitalize' }}>
          {budget.periodType}: {new Date(budget.startDate).toLocaleDateString(undefined, {month:'short', day:'numeric'})} - {new Date(budget.endDate).toLocaleDateString(undefined, {month:'short', day:'numeric'})}
        </Text>
      </View>

      <ProgressBar progress={percentUsed} color={color} height={8} />

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
        <Text style={{ fontSize: 12, color: '#9CA3AF' }}>
          {percentUsed.toFixed(0)}% used
        </Text>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {isOverBudget && onCoverIt && (
            <Pressable
              onPress={() => onCoverIt(budget)}
              style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: '#EF4444' }}
            >
              <MaterialCommunityIcons name="shield-half-full" size={14} color="#fff" />
              <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600', marginLeft: 4 }}>Cover It</Text>
            </Pressable>
          )}
          <Pressable
            onPress={() => onEdit(budget)}
            style={{ padding: 6, borderRadius: 8, backgroundColor: '#EFF6FF' }}
          >
            <MaterialCommunityIcons name="pencil" size={14} color="#2563EB" />
          </Pressable>
          <Pressable
            onPress={() => onDelete(budget.id)}
            style={{ padding: 6, borderRadius: 8, backgroundColor: '#FEF2F2' }}
          >
            <MaterialCommunityIcons name="trash-can-outline" size={14} color="#EF4444" />
          </Pressable>
        </View>
      </View>
    </View>
  );
}