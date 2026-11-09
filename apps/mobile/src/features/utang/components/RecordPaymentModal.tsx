import { useState } from 'react';
import { Text, View } from 'react-native';

import { Button, DateField, Input, Modal } from '@/components/ui';
import { useAccounts } from '@/features/accounts/hooks/useAccounts';
import { ChoicePills } from '@/features/bills/components/ChoicePills';
import { useToast } from '@/features/toast/hooks/useToast';
import { getErrorMessage } from '@/shared/utils/apiErrors';
import { formatCurrency, getLocalISODate } from '@/shared/utils/categories';
import { useAddDebtPayment } from '../hooks/useUtang';
import type { Debt } from '../types';

function RecordPaymentForm({ debt, onClose }: { debt: Debt; onClose: () => void }) {
  const toast = useToast();
  const { data: accounts } = useAccounts();
  const addPayment = useAddDebtPayment();

  const [amount, setAmount] = useState(String(debt.remaining));
  const [accountId, setAccountId] = useState<string | null>(debt.accountId ?? accounts?.[0]?.id ?? null);
  const [date, setDate] = useState<string | null>(getLocalISODate());

  const parsed = Number(amount);
  const isValid = Number.isFinite(parsed) && parsed > 0 && parsed <= debt.remaining + 0.001;
  const wallet = accounts?.find((account) => account.id === accountId);
  const incoming = debt.direction === 'lent';

  const handleSave = () => {
    if (!isValid || !accountId) return;
    addPayment.mutate(
      { id: debt.id, amount: Math.round(parsed * 100) / 100, date: date ?? getLocalISODate(), accountId },
      {
        onSuccess: (updated) => {
          onClose();
          toast.success(updated.settled ? 'Paid in full' : `${formatCurrency(updated.remaining)} left`);
        },
        onError: (err: unknown) => toast.error(getErrorMessage(err) || "Couldn't record the payment"),
      },
    );
  };

  return (
    <View style={{ gap: 16 }}>
      <Text className="text-sm text-text-secondary">
        {incoming ? `${debt.personName} still owes you` : `You still owe ${debt.personName}`} {formatCurrency(debt.remaining)}.
      </Text>
      <Input
        label="Amount paid"
        keyboardType="decimal-pad"
        value={amount}
        onChangeText={setAmount}
        selectTextOnFocus
        error={Number.isFinite(parsed) && parsed > debt.remaining + 0.001 ? `That's more than the ${formatCurrency(debt.remaining)} left` : undefined}
      />
      <ChoicePills
        label={incoming ? 'Received into' : 'Paid from'}
        choices={(accounts ?? []).map((account) => ({ value: account.id as string | null, label: account.name }))}
        value={accountId}
        onChange={setAccountId}
      />
      {wallet && isValid && (
        <Text style={{ fontSize: 13, color: '#6B7280' }}>
          {wallet.name} balance after: {formatCurrency(wallet.balance + (incoming ? parsed : -parsed))}
        </Text>
      )}
      <DateField label="Date" value={date} onChange={setDate} maximumDate={new Date()} />
      <Button title="Record Payment" onPress={handleSave} disabled={!isValid || !accountId} loading={addPayment.isPending} />
    </View>
  );
}

export default function RecordPaymentModal({ debt, onClose }: { debt: Debt | null; onClose: () => void }) {
  return (
    <Modal
      visible={debt !== null}
      onClose={onClose}
      title={debt ? (debt.direction === 'lent' ? `${debt.personName} paid back` : `Pay back ${debt.personName}`) : ''}
    >
      {debt && <RecordPaymentForm key={debt.id} debt={debt} onClose={onClose} />}
    </Modal>
  );
}
