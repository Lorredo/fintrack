import React, { useCallback } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Screen } from '@/components/ui';
import BudgetForm from '@/features/budgets/components/BudgetForm';
import { useCreateBudget, useUpdateBudget } from '@/features/budgets/hooks/useBudgets';
import { useUIStore } from '@/shared/store/ui.store';
import type { CreateBudgetInput, UpdateBudgetInput } from '@/features/budgets/types';

export default function BudgetFormScreen() {
  const router = useRouter();
  
  const editingBudget = useUIStore((state) => state.editingBudget);
  const setEditingBudget = useUIStore((state) => state.setEditingBudget);
  
  const createMutation = useCreateBudget();
  const updateMutation = useUpdateBudget();

  const handleClose = useCallback(() => {
    setEditingBudget(null);
    router.back();
  }, [router, setEditingBudget]);

  const handleSubmit = useCallback(
    (data: CreateBudgetInput | UpdateBudgetInput) => {
      if ('id' in data) {
        updateMutation.mutate(data as UpdateBudgetInput, {
          onSuccess: handleClose,
        });
      } else {
        createMutation.mutate(data as CreateBudgetInput, {
          onSuccess: handleClose,
        });
      }
    },
    [createMutation, updateMutation, handleClose]
  );

  const title = editingBudget ? 'Edit Budget' : 'Add Budget';

  return (
    <Screen scrollable>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 16, paddingBottom: 24 }}>
        <Pressable onPress={handleClose} style={{ padding: 8, marginLeft: -8 }}>
          <MaterialCommunityIcons name="arrow-left" size={24} color="#111827" />
        </Pressable>
        <Text style={{ fontSize: 18, fontWeight: '700', color: '#111827' }}>{title}</Text>
        <View style={{ width: 40 }} />
      </View>

      <BudgetForm
        budget={editingBudget}
        onSubmit={handleSubmit}
        onCancel={handleClose}
        loading={createMutation.isPending || updateMutation.isPending}
      />
    </Screen>
  );
}
