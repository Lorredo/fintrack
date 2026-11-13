import { useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';

import { Button, Input, Modal } from '@/components/ui';
import { useAccounts } from '@/features/accounts/hooks/useAccounts';
import type { Transaction } from '@/features/transactions/types';
import { useToast } from '@/features/toast/hooks/useToast';
import { getErrorMessage } from '@/shared/utils/apiErrors';
import { formatCurrency, getLocalISODate } from '@/shared/utils/categories';
import { useRecordPay } from '../hooks/useBills';
import type { PayItem } from '../types';
import { formatShortDate } from '../utils/billLabels';
import { ChoicePills } from './ChoicePills';

function toPickerDate(isoDate: string): Date {
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Date(year, month - 1, day);
}

interface FormProps {
  item: PayItem;
  onClose: () => void;
  onRecorded: (item: PayItem, transaction: Transaction) => void;
}

function RecordPayForm({ item, onClose, onRecorded }: FormProps) {
  const toast = useToast();
  const { data: accounts } = useAccounts();
  const recordPay = useRecordPay();

  const [amount, setAmount] = useState(String(item.amount));
  const [accountId, setAccountId] = useState<string | null>(item.accountId ?? accounts?.[0]?.id ?? null);
  // The day it arrived; the pay date unless it came late.
  const [date, setDate] = useState(item.date);
  const [showDatePicker, setShowDatePicker] = useState(false);

  const parsedAmount = Number(amount);
  const isValidAmount = Number.isFinite(parsedAmount) && parsedAmount > 0;
  const extra = isValidAmount ? parsedAmount - item.amount : 0;

  const handleRecord = () => {
    if (!isValidAmount || !accountId) return;
    recordPay.mutate(
      { key: item.key, payDate: item.date, date, amount: Math.round(parsedAmount * 100) / 100, accountId },
      {
        onSuccess: (transaction) => {
          onClose();
          onRecorded(item, transaction);
        },
        onError: (err: unknown) => toast.error(getErrorMessage(err) || "Couldn't record your pay"),
      },
    );
  };

  return (
    <View style={{ gap: 16 }}>
      <Text className="text-sm text-text-secondary">
        Due {formatShortDate(item.date)}. This adds income to the wallet you choose.
      </Text>

      <Input label="Amount received" keyboardType="decimal-pad" value={amount} onChangeText={setAmount} selectTextOnFocus />
      {item.kind === 'salary' && extra > 0 && (
        <Text style={{ fontSize: 13, color: '#047857' }}>
          {formatCurrency(extra)} above your salary counts as extra, like overtime.
        </Text>
      )}

      <ChoicePills
        label="Goes to"
        choices={(accounts ?? []).map((account) => ({ value: account.id as string | null, label: account.name }))}
        value={accountId}
        onChange={setAccountId}
      />

      <View>
        <Text className="text-sm font-medium text-text mb-xs">Date received</Text>
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
        title={`Record ${isValidAmount ? formatCurrency(parsedAmount) : ''}`.trim()}
        onPress={handleRecord}
        disabled={!isValidAmount || !accountId}
        loading={recordPay.isPending}
      />
    </View>
  );
}

interface RecordPayModalProps {
  item: PayItem | null;
  onClose: () => void;
  onRecorded: (item: PayItem, transaction: Transaction) => void;
}

export default function RecordPayModal({ item, onClose, onRecorded }: RecordPayModalProps) {
  return (
    <Modal visible={item !== null} onClose={onClose} title={item ? `Record ${item.name}` : ''}>
      {item && <RecordPayForm key={`${item.key}-${item.date}`} item={item} onClose={onClose} onRecorded={onRecorded} />}
    </Modal>
  );
}
