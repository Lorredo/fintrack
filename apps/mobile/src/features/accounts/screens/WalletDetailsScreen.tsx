import { useState } from 'react';
import { View, Text, SectionList, Pressable, Alert, RefreshControl } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { Button, EmptyState, Loader, Modal, Screen } from '@/components/ui';
import { useToast } from '@/features/toast/hooks/useToast';
import TransactionDetailsModal from '@/features/transactions/components/TransactionDetailsModal';
import TransactionRow from '@/features/transactions/components/TransactionRow';
import { useInfiniteTransactionList } from '@/features/transactions/hooks/useTransactions';
import type { Transaction } from '@/features/transactions/types';
import { groupByDate } from '@/features/transactions/utils/groupByDate';
import { formatCurrency } from '@/shared/utils/categories';
import { getErrorMessage } from '@/shared/utils/apiErrors';
import UpdateBalanceModal from '../components/UpdateBalanceModal';
import WalletFormModal from '../components/WalletFormModal';
import { useAccounts, useDeleteAccount } from '../hooks/useAccounts';
import { formatLastUpdated } from '../utils/lastUpdated';

export default function WalletDetailsScreen() {
  const router = useRouter();
  const toast = useToast();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: accounts } = useAccounts();
  const deleteAccount = useDeleteAccount();

  const [showMenu, setShowMenu] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isUpdatingBalance, setIsUpdatingBalance] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);

  const {
    data,
    isLoading,
    isError,
    refetch,
    isRefetching,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = useInfiniteTransactionList({ accountId: id, limit: 20 });

  const wallet = accounts?.find((account) => account.id === id);
  if (!wallet) {
    return (
      <Screen>
        <Loader />
      </Screen>
    );
  }

  const canTransfer = (accounts?.length ?? 0) > 1;
  const lastUpdated = formatLastUpdated(wallet.lastAdjustedAt);
  const sections = groupByDate(data?.pages.flatMap((page) => page.data) ?? []);

  const handleEdit = () => {
    setShowMenu(false);
    setIsEditing(true);
  };

  const handleDelete = () => {
    setShowMenu(false);
    Alert.alert('Delete Wallet', 'Are you sure you want to delete this wallet? This will fail if it has transactions.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          deleteAccount.mutate(wallet.id, {
            onSuccess: () => router.back(),
            onError: (err) => toast.error(getErrorMessage(err) || "Couldn't delete this wallet"),
          });
        },
      },
    ]);
  };

  return (
    <Screen>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 8, paddingBottom: 16 }}>
        <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Go back" hitSlop={8}>
          <MaterialCommunityIcons name="arrow-left" size={24} color="#111827" />
        </Pressable>
        <Text style={{ flex: 1, fontSize: 18, fontWeight: '700', color: '#111827' }} numberOfLines={1}>
          {wallet.name}
        </Text>
        <Pressable onPress={() => setShowMenu(true)} accessibilityRole="button" accessibilityLabel="Wallet options" hitSlop={8}>
          <MaterialCommunityIcons name="dots-horizontal" size={24} color="#111827" />
        </Pressable>
      </View>

      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        stickySectionHeadersEnabled={false}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
        ListHeaderComponent={
          <View style={{ marginBottom: 8 }}>
            <View style={{ backgroundColor: wallet.color || '#2563EB', borderRadius: 20, padding: 20, marginBottom: 12 }}>
              <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)' }}>Balance</Text>
              <Text style={{ fontSize: 32, fontWeight: '700', color: '#fff', letterSpacing: -0.5 }}>
                {formatCurrency(wallet.balance)}
              </Text>
              {lastUpdated && (
                <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 4 }}>{lastUpdated}</Text>
              )}
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <View style={{ flex: 1 }}>
                <Button title="Update Balance" onPress={() => setIsUpdatingBalance(true)} />
              </View>
              {canTransfer && (
                <View style={{ flex: 1 }}>
                  <Button
                    title="Transfer"
                    variant="outline"
                    onPress={() =>
                      router.push({ pathname: '/transaction-form', params: { type: 'transfer', accountId: wallet.id } })
                    }
                  />
                </View>
              )}
            </View>
          </View>
        }
        renderSectionHeader={({ section }) => (
          <Text style={{ fontSize: 14, fontWeight: '600', color: '#4B5563', marginTop: 14, marginBottom: 8 }}>
            {section.title}
          </Text>
        )}
        renderItem={({ item }) => (
          <View style={{ marginBottom: 10 }}>
            <TransactionRow transaction={item} accounts={accounts} showDate={false} onPress={setSelectedTransaction} />
          </View>
        )}
        ListEmptyComponent={
          isLoading ? (
            <Loader />
          ) : isError && !data ? (
            <View style={{ alignItems: 'center', paddingVertical: 32 }}>
              <Text style={{ fontSize: 15, color: '#6B7280', marginBottom: 12 }}>Failed to load transactions</Text>
              <Button title="Retry" onPress={() => refetch()} />
            </View>
          ) : (
            <EmptyState title="No transactions yet" description="This wallet's transactions will appear here." />
          )
        }
        refreshControl={
          <RefreshControl refreshing={isRefetching && !isFetchingNextPage} onRefresh={refetch} tintColor="#2563EB" />
        }
        onEndReached={() => {
          if (hasNextPage && !isFetchingNextPage) fetchNextPage();
        }}
        onEndReachedThreshold={0.3}
        ListFooterComponent={isFetchingNextPage ? <Loader /> : null}
      />

      <Modal visible={showMenu} onClose={() => setShowMenu(false)} title={wallet.name}>
        <View style={{ gap: 12 }}>
          <Button title="Edit Wallet" variant="outline" onPress={handleEdit} />
          {(accounts?.length ?? 0) > 1 && <Button title="Delete Wallet" variant="danger" onPress={handleDelete} />}
        </View>
      </Modal>
      <WalletFormModal visible={isEditing} wallet={wallet} onClose={() => setIsEditing(false)} />
      <UpdateBalanceModal account={isUpdatingBalance ? wallet : null} onClose={() => setIsUpdatingBalance(false)} />
      <TransactionDetailsModal
        transaction={selectedTransaction}
        accounts={accounts}
        onClose={() => setSelectedTransaction(null)}
      />
    </Screen>
  );
}
