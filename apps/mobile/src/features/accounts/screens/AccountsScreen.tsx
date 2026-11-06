import { useState } from 'react';
import { View, Text, FlatList, Pressable, ActivityIndicator } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { Screen } from '@/components/ui';
import { formatCurrency } from '@/shared/utils/categories';
import WalletFormModal from '../components/WalletFormModal';
import { useAccounts } from '../hooks/useAccounts';
import type { Account, AccountType } from '../types';
import { formatLastUpdated } from '../utils/lastUpdated';

const WALLET_ICONS: Record<AccountType, keyof typeof Ionicons.glyphMap> = {
  cash: 'cash-outline',
  bank: 'business-outline',
  ewallet: 'phone-portrait-outline',
  investment: 'trending-up-outline',
};

function WalletCard({ wallet, onPress }: { wallet: Account; onPress: () => void }) {
  const color = wallet.color || '#2563EB';
  const lastUpdated = formatLastUpdated(wallet.lastAdjustedAt);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${wallet.name}, ${formatCurrency(wallet.balance)}`}
      className="bg-surface p-md rounded-2xl border border-border flex-row items-center active:opacity-70"
    >
      <View style={{ backgroundColor: color + '20' }} className="w-12 h-12 rounded-full items-center justify-center">
        <Ionicons name={WALLET_ICONS[wallet.type]} size={24} color={color} />
      </View>
      <View className="flex-1 ml-md">
        <Text className="text-base font-bold text-text" numberOfLines={1}>{wallet.name}</Text>
        <Text className="text-xs text-text-secondary capitalize mt-1" numberOfLines={1}>
          {wallet.type}{lastUpdated ? ` · ${lastUpdated}` : ''}
        </Text>
      </View>
      <Text className="text-base font-bold text-text ml-sm">{formatCurrency(wallet.balance)}</Text>
      <MaterialCommunityIcons name="chevron-right" size={20} color="#9CA3AF" />
    </Pressable>
  );
}

export default function AccountsScreen() {
  const router = useRouter();
  const { data: accounts, isLoading } = useAccounts();
  const [isAdding, setIsAdding] = useState(false);

  if (isLoading) {
    return (
      <Screen>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#2563EB" />
        </View>
      </Screen>
    );
  }

  const total = (accounts ?? []).reduce((sum, account) => sum + account.balance, 0);

  return (
    <Screen>
      <View className="flex-row items-center justify-between mb-lg">
        <Text className="text-h1 font-bold text-text">Wallets</Text>
        <Pressable
          onPress={() => setIsAdding(true)}
          accessibilityRole="button"
          accessibilityLabel="Add wallet"
          className="bg-primary/10 p-sm rounded-full"
        >
          <Ionicons name="add" size={24} color="#2563EB" />
        </Pressable>
      </View>

      <View className="mb-lg">
        <Text className="text-sm text-text-secondary">Total balance</Text>
        <Text style={{ fontSize: 30, fontWeight: '700', color: '#111827', letterSpacing: -0.5 }}>
          {formatCurrency(total)}
        </Text>
      </View>

      <FlatList
        data={accounts}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ gap: 12, paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <WalletCard
            wallet={item}
            onPress={() => router.push({ pathname: '/wallet-details', params: { id: item.id } })}
          />
        )}
      />

      <WalletFormModal visible={isAdding} wallet={null} onClose={() => setIsAdding(false)} />
    </Screen>
  );
}
