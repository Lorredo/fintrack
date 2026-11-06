import { useState } from 'react';
import { View, Text } from 'react-native';

import { Button, Input, Modal } from '@/components/ui';
import { useToast } from '@/features/toast/hooks/useToast';
import { getErrorMessage } from '@/shared/utils/apiErrors';
import { formatCurrency, getLocalISODate } from '@/shared/utils/categories';
import { useSetAccountBalance } from '../hooks/useAccounts';
import type { Account } from '../types';
import { formatLastUpdated } from '../utils/lastUpdated';

interface UpdateBalanceModalProps {
  account: Account | null;
  onClose: () => void;
}

function UpdateBalanceForm({ account, onClose }: { account: Account; onClose: () => void }) {
  const toast = useToast();
  const setAccountBalance = useSetAccountBalance();
  const [actualBalance, setActualBalance] = useState(account.balance.toFixed(2));

  const parsedBalance = actualBalance.trim() === '' ? NaN : Number(actualBalance);
  const isValid = Number.isFinite(parsedBalance) && parsedBalance >= 0;
  const difference = isValid ? Math.round((parsedBalance - account.balance) * 100) / 100 : 0;
  const lastUpdated = formatLastUpdated(account.lastAdjustedAt);

  const handleSave = () => {
    if (!isValid) return;
    setAccountBalance.mutate(
      { id: account.id, balance: parsedBalance, date: getLocalISODate() },
      {
        onSuccess: (result) => {
          onClose();
          toast.success(result.adjusted ? 'Balance updated' : 'Already up to date');
        },
        onError: (err) => toast.error(getErrorMessage(err) || "Couldn't update the balance"),
      },
    );
  };

  return (
    <View style={{ gap: 12 }}>
      {lastUpdated && <Text className="text-sm text-text-secondary">{lastUpdated}</Text>}
      <Input
        label="Actual Balance"
        placeholder="0.00"
        keyboardType="decimal-pad"
        value={actualBalance}
        onChangeText={setActualBalance}
        selectTextOnFocus
        autoFocus
      />
      {isValid && difference !== 0 && (
        <View>
          <Text style={{ fontSize: 16, fontWeight: '700', color: '#111827' }}>
            {formatCurrency(account.balance)} → {formatCurrency(parsedBalance)}
          </Text>
          <Text className="text-sm text-text-secondary mt-1">
            {difference > 0 ? '+' : '-'}{formatCurrency(Math.abs(difference))} will be recorded as a balance adjustment.
          </Text>
        </View>
      )}
      {isValid && difference === 0 && (
        <Text className="text-sm text-text-secondary">Already matches your FinTrack balance.</Text>
      )}
      <Button
        title="Update Balance"
        onPress={handleSave}
        disabled={!isValid}
        loading={setAccountBalance.isPending}
      />
    </View>
  );
}

export default function UpdateBalanceModal({ account, onClose }: UpdateBalanceModalProps) {
  return (
    <Modal visible={account !== null} onClose={onClose} title={`Update ${account?.name ?? ''} Balance`}>
      {account && <UpdateBalanceForm key={account.id} account={account} onClose={onClose} />}
    </Modal>
  );
}
