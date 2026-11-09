import { View, Text, Alert } from 'react-native';
import { useRouter } from 'expo-router';

import { Button, Modal } from '@/components/ui';
import type { Account } from '@/features/accounts/types';
import { useToast } from '@/features/toast/hooks/useToast';
import { useUIStore } from '@/shared/store/ui.store';
import { formatCurrency, formatDate } from '@/shared/utils/categories';
import { getErrorMessage } from '@/shared/utils/apiErrors';
import { useDeleteTransaction } from '../hooks/useTransactions';
import type { Transaction } from '../types';
import { getAmountDisplay, getWalletLabel, isEditableInForm, isLoan } from '../utils/amountDisplay';

interface TransactionDetailsModalProps {
  transaction: Transaction | null;
  accounts?: Account[];
  onClose: () => void;
  onDeleted?: (id: string) => void;
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 16 }}>
      <Text style={{ fontSize: 13, color: '#6B7280' }}>{label}</Text>
      <Text style={{ flexShrink: 1, fontSize: 13, fontWeight: '600', color: '#111827', textAlign: 'right' }}>{value}</Text>
    </View>
  );
}

export default function TransactionDetailsModal({ transaction, accounts, onClose, onDeleted }: TransactionDetailsModalProps) {
  const router = useRouter();
  const toast = useToast();
  const setEditingTransaction = useUIStore((state) => state.setEditingTransaction);
  const deleteMutation = useDeleteTransaction();

  const handleEdit = (selected: Transaction) => {
    onClose();
    setEditingTransaction(selected);
    router.push('/transaction-form');
  };

  const handleDelete = (selected: Transaction) => {
    Alert.alert('Delete Transaction', 'Are you sure you want to delete this transaction?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          deleteMutation.mutate(selected.id, {
            onSuccess: () => {
              onClose();
              onDeleted?.(selected.id);
            },
            onError: (err) => toast.error(getErrorMessage(err) || "Couldn't delete the transaction"),
          });
        },
      },
    ]);
  };

  const display = transaction ? getAmountDisplay(transaction.type) : null;

  return (
    <Modal visible={transaction !== null} onClose={onClose} title={transaction?.category}>
      {transaction && display && (
        <View style={{ gap: 12 }}>
          <Text style={{ fontSize: 28, fontWeight: '700', color: display.color }}>
            {display.prefix}{formatCurrency(transaction.amount)}
          </Text>
          <DetailRow label="Date" value={formatDate(transaction.date)} />
          <DetailRow label="Wallet" value={getWalletLabel(transaction, accounts)} />
          {transaction.description ? <DetailRow label="Description" value={transaction.description} /> : null}
          {isEditableInForm(transaction.type) && (
            <Button title="Edit" variant="outline" onPress={() => handleEdit(transaction)} />
          )}
          {isLoan(transaction.type) && (
            <Text style={{ fontSize: 13, color: '#6B7280' }}>
              Edit or delete this from {transaction.category === 'Paluwagan' ? 'Paluwagan' : 'Utang'}, so it stays in step there.
            </Text>
          )}
          {!isLoan(transaction.type) && (
            <Button
              title="Delete"
              variant="danger"
              onPress={() => handleDelete(transaction)}
              loading={deleteMutation.isPending}
            />
          )}
        </View>
      )}
    </Modal>
  );
}
