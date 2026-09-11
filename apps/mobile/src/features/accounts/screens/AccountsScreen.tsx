import { useState } from 'react';
import { View, Text, FlatList, Pressable, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button, Input, Screen } from '@/components/ui';
import { useAccounts, useCreateAccount, useUpdateAccount, useDeleteAccount } from '../hooks/useAccounts';
import type { Account, AccountType } from '../types';

export default function AccountsScreen() {
  const { data: accounts, isLoading } = useAccounts();
  const createAccount = useCreateAccount();
  const updateAccount = useUpdateAccount();
  const deleteAccount = useDeleteAccount();

  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [type, setType] = useState<AccountType>('cash');
  const [color, setColor] = useState('#2563EB');

  const resetForm = () => {
    setIsAdding(false);
    setEditingId(null);
    setName('');
    setType('cash');
    setColor('#2563EB');
  };

  const handleSave = () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Account name is required');
      return;
    }
    if (editingId) {
      updateAccount.mutate(
        { id: editingId, name, type, color },
        { onSuccess: resetForm }
      );
    } else {
      createAccount.mutate(
        { name, type, color },
        { onSuccess: resetForm }
      );
    }
  };

  const handleEdit = (acc: Account) => {
    setEditingId(acc.id);
    setName(acc.name);
    setType(acc.type);
    setColor(acc.color || '#2563EB');
    setIsAdding(true);
  };

  const handleDelete = (id: string) => {
    Alert.alert('Delete Wallet', 'Are you sure you want to delete this wallet? This will fail if there are transactions associated with it.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteAccount.mutate(id) },
    ]);
  };

  if (isLoading) {
    return (
      <Screen>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#2563EB" />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <View className="flex-row items-center justify-between mb-lg">
        <Text className="text-h1 font-bold text-text">Wallets</Text>
        {!isAdding && (
          <Pressable
            onPress={() => setIsAdding(true)}
            className="bg-primary/10 p-sm rounded-full"
          >
            <Ionicons name="add" size={24} color="#2563EB" />
          </Pressable>
        )}
      </View>

      {isAdding && (
        <View className="bg-surface p-md rounded-2xl mb-lg border border-border">
          <Text className="text-h3 font-bold text-text mb-sm">
            {editingId ? 'Edit Wallet' : 'New Wallet'}
          </Text>
          <View className="gap-md mb-md">
            <Input
              label="Wallet Name"
              placeholder="e.g. BPI, GCash, Secret Stash"
              value={name}
              onChangeText={setName}
            />
            <View>
              <Text className="text-sm font-medium text-text mb-xs">Type</Text>
              <View className="flex-row gap-xs">
                {(['cash', 'bank', 'ewallet', 'investment'] as AccountType[]).map((t) => (
                  <Pressable
                    key={t}
                    onPress={() => setType(t)}
                    className={`px-sm py-xs rounded-lg border ${
                      type === t ? 'bg-primary border-primary' : 'bg-background border-border'
                    }`}
                  >
                    <Text className={`capitalize text-sm font-medium ${
                      type === t ? 'text-white' : 'text-text'
                    }`}>{t}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
            <View className="mt-md">
              <Text className="text-sm font-medium text-text mb-xs">Wallet Color</Text>
              <View className="flex-row gap-sm flex-wrap">
                {['#2563EB', '#7C3AED', '#059669', '#DC2626', '#D97706', '#4F46E5', '#0891B2', '#BE185D', '#EA580C'].map((c) => (
                  <Pressable
                    key={c}
                    onPress={() => setColor(c)}
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 18,
                      backgroundColor: c,
                      borderWidth: 2,
                      borderColor: color === c ? '#111827' : 'transparent',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {color === c && (
                      <Ionicons name="checkmark" size={20} color="#fff" />
                    )}
                  </Pressable>
                ))}
              </View>
            </View>
          </View>
          <View className="flex-row gap-sm">
            <View className="flex-1">
              <Button title="Cancel" variant="outline" onPress={resetForm} />
            </View>
            <View className="flex-1">
              <Button
                title="Save"
                onPress={handleSave}
                loading={createAccount.isPending || updateAccount.isPending}
              />
            </View>
          </View>
        </View>
      )}

      <FlatList
        data={accounts}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ gap: 12, paddingBottom: 100 }}
        renderItem={({ item }) => (
          <View className="bg-surface p-md rounded-2xl border border-border flex-row items-center justify-between">
            <View className="flex-row items-center gap-md">
              <View style={{ backgroundColor: (item.color || '#2563EB') + '20' }} className="w-12 h-12 rounded-full items-center justify-center">
                <Ionicons
                  name={
                    item.type === 'cash' ? 'cash-outline' :
                    item.type === 'bank' ? 'business-outline' :
                    item.type === 'ewallet' ? 'phone-portrait-outline' : 'trending-up-outline'
                  }
                  size={24}
                  color={item.color || "#2563EB"}
                />
              </View>
              <View>
                <Text className="text-h3 font-bold text-text">{item.name}</Text>
                <Text className="text-sm text-text-secondary capitalize">{item.type}</Text>
              </View>
            </View>
            <View className="flex-row items-center gap-xs">
              <Pressable onPress={() => handleEdit(item)} className="p-sm">
                <Ionicons name="pencil" size={20} color="#64748B" />
              </Pressable>
              {accounts && accounts.length > 1 && (
                <Pressable onPress={() => handleDelete(item.id)} className="p-sm">
                  <Ionicons name="trash" size={20} color="#EF4444" />
                </Pressable>
              )}
            </View>
          </View>
        )}
      />
    </Screen>
  );
}
