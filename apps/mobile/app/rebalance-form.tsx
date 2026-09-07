import { useState, useMemo } from 'react';
import { View, Text, Pressable, Alert, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { Screen, Input, Button, CategoryIcon } from '@/components/ui';
import { useUIStore } from '@/shared/store/ui.store';
import { useBudgetList, useRebalanceBudget } from '@/features/budgets/hooks/useBudgets';
import { formatCurrency } from '@/shared/utils/categories';

export default function RebalanceFormScreen() {
  const router = useRouter();
  const rebalancingBudget = useUIStore((state) => state.rebalancingBudget);
  const setRebalancingBudget = useUIStore((state) => state.setRebalancingBudget);
  const currentDate = new Date().toISOString().split('T')[0];
  const { data } = useBudgetList(currentDate);
  const activeBudgets = data?.data ?? [];

  const overspentAmount = rebalancingBudget ? Math.abs(rebalancingBudget.remaining) : 0;
  
  const [selectedSourceId, setSelectedSourceId] = useState<string>('');
  const [amount, setAmount] = useState<string>(overspentAmount ? String(overspentAmount) : '');
  
  const rebalanceMutation = useRebalanceBudget();

  // Find healthy budgets that have enough remaining funds
  const healthyBudgets = useMemo(() => {
    return activeBudgets.filter(b => b.id !== rebalancingBudget?.id && b.remaining > 0);
  }, [activeBudgets, rebalancingBudget]);

  const handleCancel = () => {
    setRebalancingBudget(null);
    router.back();
  };

  const handleRebalance = () => {
    if (!rebalancingBudget || !selectedSourceId) {
      Alert.alert('Error', 'Please select a budget to cover from.');
      return;
    }
    
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      Alert.alert('Error', 'Please enter a valid amount.');
      return;
    }

    const sourceBudget = healthyBudgets.find(b => b.id === selectedSourceId);
    if (sourceBudget && numAmount > sourceBudget.remaining) {
      Alert.alert('Error', 'Amount exceeds the available remaining funds in the selected budget.');
      return;
    }

    rebalanceMutation.mutate(
      {
        fromBudgetId: selectedSourceId,
        toBudgetId: rebalancingBudget.id,
        amount: numAmount
      },
      {
        onSuccess: () => {
          Alert.alert('Success', 'Budgets rebalanced successfully!');
          handleCancel();
        },
        onError: () => {
          Alert.alert('Error', 'Failed to rebalance budgets. Please try again.');
        }
      }
    );
  };

  if (!rebalancingBudget) {
    return (
      <Screen>
        <Text>No budget selected for rebalancing.</Text>
        <Button title="Go Back" onPress={handleCancel} />
      </Screen>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Screen scrollable>
        <View style={{ paddingTop: 24, paddingBottom: 16 }}>
          <Text style={{ fontSize: 24, fontWeight: '700', color: '#111827', marginBottom: 8 }}>Cover Overspending</Text>
          <Text style={{ fontSize: 14, color: '#6B7280' }}>
            Move funds from another budget to cover your overspending in {rebalancingBudget.category}.
          </Text>
        </View>

        <View style={{ backgroundColor: '#FEF2F2', padding: 16, borderRadius: 16, marginBottom: 24, borderWidth: 1, borderColor: '#FEE2E2' }}>
          <Text style={{ fontSize: 13, color: '#DC2626', fontWeight: '600', marginBottom: 4 }}>Overspent Amount</Text>
          <Text style={{ fontSize: 24, fontWeight: '700', color: '#EF4444' }}>{formatCurrency(overspentAmount)}</Text>
        </View>

        <Input
          label="Amount to Transfer"
          keyboardType="decimal-pad"
          value={amount}
          onChangeText={setAmount}
          placeholder="0.00"
        />

        <View style={{ marginTop: 24, marginBottom: 32 }}>
          <Text style={{ fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 12 }}>Cover from...</Text>
          {healthyBudgets.length === 0 ? (
            <Text style={{ color: '#9CA3AF', fontSize: 14 }}>You have no other budgets with available funds.</Text>
          ) : (
            healthyBudgets.map(b => (
              <Pressable
                key={b.id}
                onPress={() => setSelectedSourceId(b.id)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: 16,
                  backgroundColor: selectedSourceId === b.id ? '#EFF6FF' : '#fff',
                  borderRadius: 16,
                  marginBottom: 8,
                  borderWidth: 1,
                  borderColor: selectedSourceId === b.id ? '#3B82F6' : '#F3F4F6'
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <CategoryIcon category={b.category} size="sm" />
                  <View>
                    <Text style={{ fontSize: 15, fontWeight: '600', color: '#111827' }}>{b.category}</Text>
                    <Text style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>
                      {formatCurrency(b.remaining)} available
                    </Text>
                  </View>
                </View>
                <View style={{
                  width: 20, height: 20, borderRadius: 10, borderWidth: 2,
                  borderColor: selectedSourceId === b.id ? '#3B82F6' : '#D1D5DB',
                  alignItems: 'center', justifyContent: 'center'
                }}>
                  {selectedSourceId === b.id && <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#3B82F6' }} />}
                </View>
              </Pressable>
            ))
          )}
        </View>

        <View style={{ flexDirection: 'row', gap: 12, paddingBottom: 40 }}>
          <View style={{ flex: 1 }}>
            <Button title="Cancel" variant="outline" onPress={handleCancel} />
          </View>
          <View style={{ flex: 1 }}>
            <Button
              title="Cover It"
              onPress={handleRebalance}
              loading={rebalanceMutation.isPending}
              disabled={!selectedSourceId || healthyBudgets.length === 0}
            />
          </View>
        </View>
      </Screen>
    </KeyboardAvoidingView>
  );
}
