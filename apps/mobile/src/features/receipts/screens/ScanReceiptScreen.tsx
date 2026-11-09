import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Pressable, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useIncomingShare } from 'expo-sharing';

import { Button, Screen } from '@/components/ui';
import { useAccounts } from '@/features/accounts/hooks/useAccounts';
import { formatCurrency } from '@/shared/utils/categories';
import { matchWallet, pickReceiptImage, ReceiptScanError, scanReceipt } from '../services/scanReceipt';
import { receiptDescription, type ParsedReceipt } from '../utils/parseReceipt';

type ScanState =
  | { status: 'waiting' }
  | { status: 'reading' }
  | { status: 'done'; receipt: ParsedReceipt }
  | { status: 'failed'; message: string };

const SOURCE_LABELS = { gcash: 'GCash', maya: 'Maya', bank: 'Bank' } as const;

function Field({ label, value }: { label: string; value?: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F3F4F6', gap: 12 }}>
      <Text style={{ fontSize: 14, color: '#6B7280' }}>{label}</Text>
      <Text style={{ flex: 1, textAlign: 'right', fontSize: 14, fontWeight: '600', color: value ? '#111827' : '#9CA3AF' }} numberOfLines={2}>
        {value ?? 'Not found'}
      </Text>
    </View>
  );
}

export default function ScanReceiptScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ uri?: string; shared?: string }>();
  const { resolvedSharedPayloads, isResolving, clearSharedPayloads } = useIncomingShare();
  const { data: accounts } = useAccounts();

  const sharedUri = resolvedSharedPayloads.find((payload) => payload.contentType === 'image')?.contentUri ?? undefined;
  const [pickedUri, setPickedUri] = useState<string | undefined>(undefined);
  // A picked image wins, then one passed in, then one shared from another app.
  const uri = pickedUri ?? params.uri ?? sharedUri;

  // Results are kept per image, so picking another starts a fresh read.
  const [result, setResult] = useState<{ uri: string; state: ScanState } | null>(null);
  const state: ScanState = !uri ? { status: 'waiting' } : result?.uri === uri ? result.state : { status: 'reading' };
  const started = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!uri || started.current === uri) return;
    started.current = uri;
    scanReceipt(uri)
      .then((receipt) => setResult({ uri, state: { status: 'done', receipt } }))
      .catch((err: unknown) =>
        setResult({
          uri,
          state: { status: 'failed', message: err instanceof ReceiptScanError ? err.message : "Couldn't read this image." },
        }),
      );
  }, [uri]);

  // Shared files are copies in the app's cache; let the next share start fresh.
  useEffect(() => () => clearSharedPayloads(), [clearSharedPayloads]);

  const handlePickAnother = useCallback(async () => {
    const picked = await pickReceiptImage();
    if (picked) setPickedUri(picked);
  }, []);

  const handleUse = (receipt: ParsedReceipt) => {
    const accountId = matchWallet(receipt.source, accounts);
    router.replace({
      pathname: '/transaction-form',
      params: {
        type: receipt.type,
        fromReceipt: '1',
        ...(receipt.amount !== undefined && { amount: String(receipt.amount) }),
        ...(receipt.date && { date: receipt.date }),
        ...(receiptDescription(receipt) && { description: receiptDescription(receipt) }),
        ...(receipt.category && { category: receipt.category }),
        ...(accountId && { accountId }),
      },
    });
  };

  const waitingForShare = !uri && params.shared === '1' && (isResolving || state.status === 'waiting');

  return (
    <Screen scrollable>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 8, paddingBottom: 16 }}>
        <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Go back" hitSlop={8}>
          <MaterialCommunityIcons name="arrow-left" size={24} color="#111827" />
        </Pressable>
        <Text style={{ flex: 1, fontSize: 18, fontWeight: '700', color: '#111827' }}>Scan Receipt</Text>
      </View>

      {uri ? (
        <Image
          source={{ uri }}
          resizeMode="contain"
          style={{ width: '100%', height: 280, borderRadius: 16, backgroundColor: '#E5E7EB', marginBottom: 16 }}
          accessibilityLabel="Receipt image"
        />
      ) : null}

      {waitingForShare ? (
        <View style={{ alignItems: 'center', paddingVertical: 40, gap: 12 }}>
          <ActivityIndicator color="#2563EB" />
          <Text style={{ color: '#6B7280' }}>Opening the shared image…</Text>
        </View>
      ) : !uri ? (
        <View style={{ alignItems: 'center', paddingVertical: 32, gap: 12 }}>
          <MaterialCommunityIcons name="receipt" size={40} color="#93C5FD" />
          <Text style={{ fontSize: 15, color: '#4B5563', textAlign: 'center' }}>
            Pick a screenshot of a GCash, Maya or bank receipt. It’s read on your phone and never uploaded.
          </Text>
          <Button title="Choose Screenshot" icon="image-outline" onPress={handlePickAnother} />
        </View>
      ) : state.status === 'reading' ? (
        <View style={{ alignItems: 'center', paddingVertical: 24, gap: 12 }}>
          <ActivityIndicator color="#2563EB" />
          <Text style={{ color: '#6B7280' }}>Reading receipt…</Text>
        </View>
      ) : state.status === 'failed' ? (
        <View style={{ gap: 12 }}>
          <Text style={{ fontSize: 14, color: '#B91C1C', textAlign: 'center' }}>{state.message}</Text>
          <Button title="Try Another Image" variant="outline" onPress={handlePickAnother} />
        </View>
      ) : state.status === 'done' ? (
        <View style={{ gap: 16 }}>
          <View style={{ backgroundColor: '#FFFFFF', borderRadius: 16, paddingHorizontal: 16, paddingVertical: 4 }}>
            <Field label="Amount" value={state.receipt.amount !== undefined ? formatCurrency(state.receipt.amount) : undefined} />
            <Field label="Date" value={state.receipt.date} />
            <Field label={state.receipt.type === 'income' ? 'From' : 'Paid to'} value={state.receipt.merchant} />
            <Field label="Reference" value={state.receipt.reference} />
            <Field label="Source" value={state.receipt.source ? SOURCE_LABELS[state.receipt.source] : undefined} />
          </View>
          {state.receipt.amount === undefined && (
            <Text style={{ fontSize: 13, color: '#B45309', textAlign: 'center' }}>
              Couldn’t find an amount. You can still continue and type it in.
            </Text>
          )}
          <Button title="Use These Details" onPress={() => handleUse(state.receipt)} />
          <Button title="Try Another Image" variant="outline" onPress={handlePickAnother} />
        </View>
      ) : null}
    </Screen>
  );
}
