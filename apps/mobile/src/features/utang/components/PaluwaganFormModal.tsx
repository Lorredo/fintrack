import { useState } from 'react';
import { Text, View } from 'react-native';

import { Button, DateField, Input, Modal } from '@/components/ui';
import { useAccounts } from '@/features/accounts/hooks/useAccounts';
import { ChoicePills } from '@/features/bills/components/ChoicePills';
import { useToast } from '@/features/toast/hooks/useToast';
import { getErrorMessage } from '@/shared/utils/apiErrors';
import { formatCurrency, getLocalISODate } from '@/shared/utils/categories';
import { useCreatePaluwagan, useUpdatePaluwagan } from '../hooks/useUtang';
import type { Paluwagan, PaluwaganFrequency } from '../types';

const FREQUENCIES: { value: PaluwaganFrequency; label: string }[] = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'semi_monthly', label: '15th & 30th' },
  { value: 'monthly', label: 'Monthly' },
];

function PaluwaganForm({ paluwagan, onClose }: { paluwagan: Paluwagan | null; onClose: () => void }) {
  const toast = useToast();
  const { data: accounts } = useAccounts();
  const create = useCreatePaluwagan();
  const update = useUpdatePaluwagan();

  const [name, setName] = useState(paluwagan?.name ?? '');
  const [contribution, setContribution] = useState(paluwagan ? String(paluwagan.contribution) : '');
  const [frequency, setFrequency] = useState<PaluwaganFrequency>(paluwagan?.frequency ?? 'weekly');
  const [startDate, setStartDate] = useState<string | null>(paluwagan?.startDate ?? getLocalISODate());
  const [members, setMembers] = useState(paluwagan ? String(paluwagan.members) : '');
  const [myTurn, setMyTurn] = useState(paluwagan ? String(paluwagan.myTurn) : '');
  const [payout, setPayout] = useState(paluwagan ? String(paluwagan.payoutAmount) : '');
  const [accountId, setAccountId] = useState<string | null>(paluwagan?.accountId ?? accounts?.[0]?.id ?? null);
  const [error, setError] = useState<string | null>(null);

  const parsedContribution = Number(contribution);
  const parsedMembers = Number(members);
  const parsedTurn = Number(myTurn);
  const defaultPayout =
    Number.isFinite(parsedContribution) && Number.isInteger(parsedMembers) ? parsedContribution * parsedMembers : 0;
  const parsedPayout = payout.trim() === '' ? defaultPayout : Number(payout);

  const handleSave = () => {
    if (!name.trim()) return setError('Give the paluwagan a name');
    if (!(parsedContribution > 0)) return setError('Enter the contribution per round');
    if (!paluwagan && !(Number.isInteger(parsedMembers) && parsedMembers >= 2 && parsedMembers <= 50)) {
      return setError('Members must be from 2 to 50');
    }
    const memberCount = paluwagan?.members ?? parsedMembers;
    if (!(Number.isInteger(parsedTurn) && parsedTurn >= 1 && parsedTurn <= memberCount)) {
      return setError(`Your turn must be from 1 to ${memberCount}`);
    }
    if (!(parsedPayout > 0)) return setError('Enter the payout amount');
    setError(null);

    const callbacks = {
      onSuccess: () => {
        onClose();
        toast.success(paluwagan ? 'Paluwagan updated' : 'Paluwagan added');
      },
      onError: (err: unknown) => toast.error(getErrorMessage(err) || "Couldn't save the paluwagan"),
    };
    if (paluwagan) {
      update.mutate(
        {
          id: paluwagan.id,
          name: name.trim(),
          contribution: parsedContribution,
          myTurn: parsedTurn,
          payoutAmount: parsedPayout,
          accountId: accountId ?? '',
        },
        callbacks,
      );
    } else {
      create.mutate(
        {
          name: name.trim(),
          contribution: parsedContribution,
          frequency,
          startDate: startDate ?? getLocalISODate(),
          members: parsedMembers,
          myTurn: parsedTurn,
          payoutAmount: parsedPayout,
          accountId,
        },
        callbacks,
      );
    }
  };

  return (
    <View style={{ gap: 16 }}>
      <Input label="Name" placeholder="e.g. Office paluwagan" value={name} onChangeText={setName} />
      <Input label="Contribution per round" placeholder="0.00" keyboardType="decimal-pad" value={contribution} onChangeText={setContribution} />

      {!paluwagan && (
        <>
          <ChoicePills label="How often" choices={FREQUENCIES} value={frequency} onChange={setFrequency} />
          <DateField label="Round 1 date" value={startDate} onChange={setStartDate} />
          <Input label="Number of members" placeholder="e.g. 10" keyboardType="number-pad" value={members} onChangeText={setMembers} />
        </>
      )}
      <Input label="Your turn (round number)" placeholder="e.g. 4" keyboardType="number-pad" value={myTurn} onChangeText={setMyTurn} />
      <View style={{ gap: 6 }}>
        <Input
          label="Payout you receive"
          placeholder={defaultPayout > 0 ? defaultPayout.toFixed(2) : '0.00'}
          keyboardType="decimal-pad"
          value={payout}
          onChangeText={setPayout}
        />
        <Text className="text-sm text-text-secondary">
          {defaultPayout > 0
            ? `Usually contribution × members = ${formatCurrency(defaultPayout)}. Change it if the collector keeps a fee.`
            : 'Usually the contribution times the number of members.'}
        </Text>
      </View>
      <ChoicePills
        label="Wallet you pay from"
        choices={[
          ...(accounts ?? []).map((account) => ({ value: account.id as string | null, label: account.name })),
          { value: null, label: 'Choose each time' },
        ]}
        value={accountId}
        onChange={setAccountId}
      />
      <Text className="text-sm text-text-secondary">
        Contributions are set aside in Safe to Spend before they’re due. They and your payout move wallet money but aren’t
        counted as spending or income.
      </Text>
      {error && <Text style={{ fontSize: 13, color: '#DC2626' }}>{error}</Text>}
      <Button title={paluwagan ? 'Save Changes' : 'Add Paluwagan'} onPress={handleSave} loading={create.isPending || update.isPending} />
    </View>
  );
}

export default function PaluwaganFormModal({
  visible,
  paluwagan,
  onClose,
}: {
  visible: boolean;
  paluwagan: Paluwagan | null;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} onClose={onClose} title={paluwagan ? 'Edit Paluwagan' : 'New Paluwagan'}>
      {visible && <PaluwaganForm key={paluwagan?.id ?? 'new'} paluwagan={paluwagan} onClose={onClose} />}
    </Modal>
  );
}
