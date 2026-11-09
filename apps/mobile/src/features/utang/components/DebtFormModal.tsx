import { useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';

import { Button, DateField, Input, Modal } from '@/components/ui';
import { useAccounts } from '@/features/accounts/hooks/useAccounts';
import { ChoicePills } from '@/features/bills/components/ChoicePills';
import { useToast } from '@/features/toast/hooks/useToast';
import { getErrorMessage } from '@/shared/utils/apiErrors';
import { formatCurrency, getLocalISODate } from '@/shared/utils/categories';
import { useCreateDebt, useDeleteDebt, useDeleteDebtPayment, useUpdateDebt } from '../hooks/useUtang';
import type { Debt, DebtDirection } from '../types';

const DIRECTIONS: { value: DebtDirection; label: string }[] = [
  { value: 'lent', label: 'I lent money' },
  { value: 'borrowed', label: 'I borrowed money' },
];

interface FormProps {
  debt: Debt | null;
  /** Names already used, for quick picks. */
  people: string[];
  initialPerson?: string;
  onClose: () => void;
}

function DebtForm({ debt, people, initialPerson, onClose }: FormProps) {
  const toast = useToast();
  const { data: accounts } = useAccounts();
  const createDebt = useCreateDebt();
  const updateDebt = useUpdateDebt();
  const deleteDebt = useDeleteDebt();
  const deletePayment = useDeleteDebtPayment();

  const [personName, setPersonName] = useState(debt?.personName ?? initialPerson ?? '');
  const [direction, setDirection] = useState<DebtDirection>(debt?.direction ?? 'lent');
  const [amount, setAmount] = useState(debt ? String(debt.amount) : '');
  const [accountId, setAccountId] = useState<string | null>(debt?.accountId ?? accounts?.[0]?.id ?? null);
  const [date, setDate] = useState<string | null>(debt?.date ?? getLocalISODate());
  const [dueDate, setDueDate] = useState<string | null>(debt?.dueDate ?? null);
  const [notes, setNotes] = useState(debt?.notes ?? '');
  const [errors, setErrors] = useState<{ personName?: string; amount?: string; accountId?: string }>({});

  const parsedAmount = Number(amount);
  const wallet = accounts?.find((account) => account.id === accountId);
  const suggestions = people
    .filter((name) => !personName || name.toLowerCase().startsWith(personName.trim().toLowerCase()))
    .filter((name) => name.toLowerCase() !== personName.trim().toLowerCase())
    .slice(0, 6);

  const handleSave = () => {
    if (debt) {
      updateDebt.mutate(
        {
          id: debt.id,
          personName: personName.trim(),
          notes: notes.trim(),
          ...(dueDate ? { dueDate } : { clearDueDate: true }),
        },
        {
          onSuccess: () => {
            onClose();
            toast.success('Utang updated');
          },
          onError: (err: unknown) => toast.error(getErrorMessage(err) || "Couldn't update this utang"),
        },
      );
      return;
    }

    const nextErrors: typeof errors = {};
    if (!personName.trim()) nextErrors.personName = 'Who is it with?';
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) nextErrors.amount = 'Enter an amount above 0';
    if (!accountId) nextErrors.accountId = 'Choose a wallet';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0 || !accountId) return;

    createDebt.mutate(
      {
        personName: personName.trim(),
        direction,
        amount: Math.round(parsedAmount * 100) / 100,
        accountId,
        date: date ?? getLocalISODate(),
        dueDate,
        notes: notes.trim() || null,
      },
      {
        onSuccess: () => {
          onClose();
          toast.success(direction === 'lent' ? `Lent to ${personName.trim()}` : `Borrowed from ${personName.trim()}`);
        },
        onError: (err: unknown) => toast.error(getErrorMessage(err) || "Couldn't save this utang"),
      },
    );
  };

  const handleDelete = () => {
    if (!debt) return;
    Alert.alert(
      'Delete Utang',
      'This also removes the money it moved and any payments, so your wallet balances go back to before.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () =>
            deleteDebt.mutate(debt.id, {
              onSuccess: () => {
                onClose();
                toast.success('Utang deleted');
              },
              onError: (err: unknown) => toast.error(getErrorMessage(err) || "Couldn't delete this utang"),
            }),
        },
      ],
    );
  };

  return (
    <View style={{ gap: 16 }}>
      {!debt && <ChoicePills choices={DIRECTIONS} value={direction} onChange={setDirection} />}

      <View style={{ gap: 8 }}>
        <Input label="Person" placeholder="e.g. Juan" value={personName} onChangeText={setPersonName} error={errors.personName} />
        {suggestions.length > 0 && (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {suggestions.map((name) => (
              <Pressable
                key={name}
                onPress={() => setPersonName(name)}
                className="active:opacity-70"
                style={{ backgroundColor: '#F3F4F6', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 }}
              >
                <Text style={{ fontSize: 13, color: '#374151' }}>{name}</Text>
              </Pressable>
            ))}
          </View>
        )}
      </View>

      {debt ? (
        <Text className="text-sm text-text-secondary">
          {debt.direction === 'lent' ? 'Lent' : 'Borrowed'} {formatCurrency(debt.amount)} on {debt.date}. To change the
          amount, delete this and add it again.
        </Text>
      ) : (
        <>
          <Input
            label="Amount"
            placeholder="0.00"
            keyboardType="decimal-pad"
            value={amount}
            onChangeText={setAmount}
            error={errors.amount}
          />
          <View style={{ gap: 6 }}>
            <ChoicePills
              label={direction === 'lent' ? 'Taken from' : 'Received into'}
              choices={(accounts ?? []).map((account) => ({ value: account.id as string | null, label: account.name }))}
              value={accountId}
              onChange={setAccountId}
            />
            {errors.accountId && <Text style={{ fontSize: 12, color: '#DC2626' }}>{errors.accountId}</Text>}
            {wallet && Number.isFinite(parsedAmount) && parsedAmount > 0 && (
              <Text style={{ fontSize: 13, color: '#6B7280' }}>
                {wallet.name} balance after: {formatCurrency(wallet.balance + (direction === 'lent' ? -parsedAmount : parsedAmount))}
              </Text>
            )}
          </View>
          <DateField label="Date" value={date} onChange={setDate} maximumDate={new Date()} />
        </>
      )}

      {debt && debt.payments.length > 0 && (
        <View style={{ gap: 6 }}>
          <Text className="text-sm font-medium text-text">Payments</Text>
          {debt.payments.map((payment) => (
            <View key={payment.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#F9FAFB', borderRadius: 10, padding: 10 }}>
              <Text style={{ flex: 1, fontSize: 14, color: '#374151' }}>
                {formatCurrency(payment.amount)} · {payment.date}
              </Text>
              <Pressable
                onPress={() =>
                  deletePayment.mutate(
                    { debtId: debt.id, paymentId: payment.id },
                    {
                      onSuccess: () => {
                        onClose();
                        toast.success('Payment removed');
                      },
                      onError: (err: unknown) => toast.error(getErrorMessage(err) || "Couldn't remove the payment"),
                    },
                  )
                }
                hitSlop={6}
                accessibilityRole="button"
                accessibilityLabel="Undo this payment"
              >
                <Text style={{ fontSize: 13, fontWeight: '600', color: '#DC2626' }}>Undo</Text>
              </Pressable>
            </View>
          ))}
        </View>
      )}

      <DateField label="Due date (optional)" value={dueDate} onChange={setDueDate} placeholder="No due date" optional />
      <Input label="Notes (optional)" placeholder="What it was for" value={notes} onChangeText={setNotes} />

      <Text className="text-sm text-text-secondary">
        Utang moves money in your wallets but isn’t counted as income or spending.
      </Text>

      <Button title={debt ? 'Save Changes' : 'Save Utang'} onPress={handleSave} loading={createDebt.isPending || updateDebt.isPending} />
      {debt && <Button title="Delete" variant="danger" onPress={handleDelete} loading={deleteDebt.isPending} />}
    </View>
  );
}

interface DebtFormModalProps {
  visible: boolean;
  debt: Debt | null;
  people: string[];
  initialPerson?: string;
  onClose: () => void;
}

export default function DebtFormModal({ visible, debt, people, initialPerson, onClose }: DebtFormModalProps) {
  return (
    <Modal visible={visible} onClose={onClose} title={debt ? 'Edit Utang' : 'New Utang'}>
      {visible && (
        <DebtForm key={debt?.id ?? `new-${initialPerson ?? ''}`} debt={debt} people={people} initialPerson={initialPerson} onClose={onClose} />
      )}
    </Modal>
  );
}
