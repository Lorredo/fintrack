import { useState } from 'react';
import { View, Text, Pressable, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Button, Input, Modal } from '@/components/ui';
import { useToast } from '@/features/toast/hooks/useToast';
import { getErrorMessage } from '@/shared/utils/apiErrors';
import { useCreateAccount, useUpdateAccount } from '../hooks/useAccounts';
import type { Account, AccountType } from '../types';

const WALLET_TYPES: AccountType[] = ['cash', 'bank', 'ewallet', 'investment'];
const WALLET_COLORS = ['#2563EB', '#7C3AED', '#059669', '#DC2626', '#D97706', '#4F46E5', '#0891B2', '#BE185D', '#EA580C'];

interface WalletFormModalProps {
  visible: boolean;
  /** The wallet being edited, or null to add a new one. */
  wallet: Account | null;
  onClose: () => void;
}

function WalletForm({ wallet, onClose }: { wallet: Account | null; onClose: () => void }) {
  const toast = useToast();
  const createAccount = useCreateAccount();
  const updateAccount = useUpdateAccount();

  const [name, setName] = useState(wallet?.name ?? '');
  const [type, setType] = useState<AccountType>(wallet?.type ?? 'cash');
  const [color, setColor] = useState(wallet?.color || '#2563EB');
  const [inSafeToSpend, setInSafeToSpend] = useState(wallet?.inSafeToSpend ?? true);
  const [nameError, setNameError] = useState<string | undefined>();

  const handleSave = () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setNameError('Wallet name is required');
      return;
    }
    const callbacks = {
      onSuccess: onClose,
      onError: (err: unknown) => toast.error(getErrorMessage(err) || "Couldn't save the wallet"),
    };
    if (wallet) {
      updateAccount.mutate({ id: wallet.id, name: trimmedName, type, color, inSafeToSpend }, callbacks);
    } else {
      createAccount.mutate({ name: trimmedName, type, color, inSafeToSpend }, callbacks);
    }
  };

  return (
    <View style={{ gap: 16 }}>
      <Input
        label="Wallet Name"
        placeholder="e.g. BPI, GCash, Secret Stash"
        value={name}
        onChangeText={setName}
        error={nameError}
      />
      <View>
        <Text className="text-sm font-medium text-text mb-xs">Type</Text>
        <View className="flex-row flex-wrap gap-xs">
          {WALLET_TYPES.map((t) => (
            <Pressable
              key={t}
              onPress={() => setType(t)}
              className={`px-sm py-xs rounded-lg border ${
                type === t ? 'bg-primary border-primary' : 'bg-background border-border'
              }`}
            >
              <Text className={`capitalize text-sm font-medium ${type === t ? 'text-white' : 'text-text'}`}>{t}</Text>
            </Pressable>
          ))}
        </View>
      </View>
      <View>
        <Text className="text-sm font-medium text-text mb-xs">Wallet Color</Text>
        <View className="flex-row gap-sm flex-wrap">
          {WALLET_COLORS.map((c) => (
            <Pressable
              key={c}
              onPress={() => setColor(c)}
              accessibilityRole="radio"
              accessibilityState={{ selected: color === c }}
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
              {color === c && <Ionicons name="checkmark" size={20} color="#fff" />}
            </Pressable>
          ))}
        </View>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ flex: 1 }}>
          <Text className="text-sm font-medium text-text">Count in Safe to Spend</Text>
          <Text className="text-sm text-text-secondary mt-1">
            Turn off for savings or emergency funds you don’t spend from.
          </Text>
        </View>
        <Switch
          value={inSafeToSpend}
          onValueChange={setInSafeToSpend}
          trackColor={{ false: '#D1D5DB', true: '#93C5FD' }}
          thumbColor={inSafeToSpend ? '#2563EB' : '#F9FAFB'}
          accessibilityLabel="Count in Safe to Spend"
        />
      </View>
      <Button
        title="Save"
        onPress={handleSave}
        loading={createAccount.isPending || updateAccount.isPending}
      />
    </View>
  );
}

export default function WalletFormModal({ visible, wallet, onClose }: WalletFormModalProps) {
  return (
    <Modal visible={visible} onClose={onClose} title={wallet ? 'Edit Wallet' : 'New Wallet'}>
      {visible && <WalletForm key={wallet?.id ?? 'new'} wallet={wallet} onClose={onClose} />}
    </Modal>
  );
}
