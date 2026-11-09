import { useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';

import { Button, Input, Modal } from '@/components/ui';
import { useAccounts } from '@/features/accounts/hooks/useAccounts';
import { useToast } from '@/features/toast/hooks/useToast';
import { getErrorMessage } from '@/shared/utils/apiErrors';
import { formatCurrency, getLocalISODate } from '@/shared/utils/categories';
import { usePayBill, useSkipBill } from '../hooks/useBills';
import type { Bill } from '../types';
import { formatShortDate } from '../utils/billLabels';
import { ChoicePills } from './ChoicePills';

function toPickerDate(isoDate: string): Date {
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function MarkPaidForm({ bill, onClose }: { bill: Bill; onClose: () => void }) {
  const toast = useToast();
  const { data: accounts } = useAccounts();
  const payBill = usePayBill();
  const skipBill = useSkipBill();

  const [amount, setAmount] = useState(String(bill.amount));
  const [accountId, setAccountId] = useState<string | null>(bill.accountId ?? accounts?.[0]?.id ?? null);
  const [date, setDate] = useState(getLocalISODate());
  const [showDatePicker, setShowDatePicker] = useState(false);

  const parsedAmount = Number(amount);
  const isValidAmount = Number.isFinite(parsedAmount) && parsedAmount > 0;
  const wallet = accounts?.find((account) => account.id === accountId);
  const balanceAfter = wallet && isValidAmount ? wallet.balance - parsedAmount : null;
  const isOverdue = bill.daysUntil < 0;

  const handlePay = () => {
    if (!isValidAmount || !accountId) return;
    payBill.mutate(
      { id: bill.id, dueDate: bill.nextDue, date, amount: Math.round(parsedAmount * 100) / 100, accountId },
      {
        onSuccess: () => {
          onClose();
          toast.success(`${bill.name} marked as paid`);
        },
        onError: (err: unknown) => toast.error(getErrorMessage(err) || "Couldn't record the payment"),
      },
    );
  };

  const handleSkip = () => {
    skipBill.mutate(
      { id: bill.id, dueDate: bill.nextDue },
      {
        onSuccess: () => {
          onClose();
          toast.info(`Skipped ${bill.name} for ${formatShortDate(bill.nextDue)}`);
        },
        onError: (err: unknown) => toast.error(getErrorMessage(err) || "Couldn't skip this bill"),
      },
    );
  };

  return (
    <View style={{ gap: 16 }}>
      <Text className="text-sm text-text-secondary">
        {isOverdue ? 'Was due' : 'Due'} {formatShortDate(bill.nextDue)}. This records an expense in {bill.category}.
      </Text>

      <Input label="Amount paid" keyboardType="decimal-pad" value={amount} onChangeText={setAmount} selectTextOnFocus />

      <ChoicePills
        label="Paid from"
        choices={(accounts ?? []).map((account) => ({ value: account.id as string | null, label: account.name }))}
        value={accountId}
        onChange={setAccountId}
      />
      {balanceAfter !== null && (
        <Text style={{ fontSize: 13, color: balanceAfter < 0 ? '#DC2626' : '#6B7280' }}>
          {wallet?.name} balance after: {formatCurrency(balanceAfter)}
        </Text>
      )}

      <View>
        <Text className="text-sm font-medium text-text mb-xs">Date paid</Text>
        <Pressable
          onPress={() => setShowDatePicker(true)}
          style={{ borderWidth: 2, borderColor: '#E5E7EB', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, backgroundColor: '#FFFFFF' }}
        >
          <Text style={{ fontSize: 15, color: '#111827' }}>{date}</Text>
        </Pressable>
        {showDatePicker && (
          <DateTimePicker
            value={toPickerDate(date)}
            mode="date"
            display="default"
            maximumDate={new Date()}
            onChange={(_event, selected) => {
              setShowDatePicker(Platform.OS === 'ios');
              if (selected) setDate(getLocalISODate(selected));
            }}
          />
        )}
      </View>

      <Button
        title={`Pay ${isValidAmount ? formatCurrency(parsedAmount) : ''}`.trim()}
        onPress={handlePay}
        disabled={!isValidAmount || !accountId}
        loading={payBill.isPending}
      />
      <Pressable
        onPress={handleSkip}
        disabled={skipBill.isPending}
        accessibilityRole="button"
        className="active:opacity-70"
        style={{ alignItems: 'center', paddingVertical: 8 }}
      >
        <Text style={{ fontSize: 14, fontWeight: '600', color: '#6B7280' }}>
          {skipBill.isPending ? 'Skipping…' : `Skip ${formatShortDate(bill.nextDue)}, nothing to pay`}
        </Text>
      </Pressable>
    </View>
  );
}

export default function MarkPaidModal({ bill, onClose }: { bill: Bill | null; onClose: () => void }) {
  return (
    <Modal visible={bill !== null} onClose={onClose} title={bill ? `Pay ${bill.name}` : ''}>
      {bill && <MarkPaidForm key={`${bill.id}-${bill.nextDue}`} bill={bill} onClose={onClose} />}
    </Modal>
  );
}
