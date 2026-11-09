import { useMemo, useState } from 'react';
import { Pressable, SectionList, Share, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { Button, EmptyState, FloatingAddButton, Loader, Screen } from '@/components/ui';
import { useToast } from '@/features/toast/hooks/useToast';
import { formatCurrency, getLocalISODate } from '@/shared/utils/categories';
import DebtFormModal from '../components/DebtFormModal';
import RecordPaymentModal from '../components/RecordPaymentModal';
import { useDebts } from '../hooks/useUtang';
import type { Debt, PersonBalance } from '../types';
import { dueLabel, reminderMessage } from '../utils/labels';

function personKey(name: string) {
  return name.trim().toLowerCase().split(/\s+/).join(' ');
}

function DebtRow({ debt, today, onPress, onPay }: { debt: Debt; today: string; onPress: () => void; onPay: () => void }) {
  const lent = debt.direction === 'lent';
  const due = dueLabel(debt, today);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      className="active:opacity-70"
      style={{ backgroundColor: '#FFFFFF', borderRadius: 14, padding: 14, gap: 8, opacity: debt.settled ? 0.6 : 1 }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <MaterialCommunityIcons name={lent ? 'arrow-top-right' : 'arrow-bottom-left'} size={18} color={lent ? '#059669' : '#DC2626'} />
        <Text style={{ flex: 1, fontSize: 14, color: '#374151' }} numberOfLines={1}>
          {lent ? 'You lent' : 'You borrowed'} {formatCurrency(debt.amount)} · {debt.date}
        </Text>
        <Text style={{ fontSize: 15, fontWeight: '700', color: '#111827' }}>{formatCurrency(debt.remaining)}</Text>
      </View>
      {(debt.paid > 0 || debt.notes) && (
        <Text style={{ fontSize: 12, color: '#6B7280' }} numberOfLines={2}>
          {debt.paid > 0 ? `${formatCurrency(debt.paid)} paid back` : ''}
          {debt.paid > 0 && debt.notes ? ' · ' : ''}
          {debt.notes ?? ''}
        </Text>
      )}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        {due ? (
          <Text style={{ fontSize: 12, fontWeight: '600', color: due.overdue ? '#B91C1C' : debt.settled ? '#059669' : '#6B7280' }}>{due.text}</Text>
        ) : (
          <View />
        )}
        {!debt.settled && (
          <Pressable
            onPress={onPay}
            hitSlop={6}
            accessibilityRole="button"
            className="active:opacity-70"
            style={{ backgroundColor: '#EFF6FF', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 }}
          >
            <Text style={{ fontSize: 12, fontWeight: '700', color: '#2563EB' }}>{lent ? 'They paid' : 'I paid'}</Text>
          </Pressable>
        )}
      </View>
    </Pressable>
  );
}

export default function UtangScreen() {
  const router = useRouter();
  const toast = useToast();
  const today = getLocalISODate();
  const { data, isLoading, isError, refetch, isRefetching } = useDebts();
  const [editing, setEditing] = useState<Debt | null>(null);
  const [adding, setAdding] = useState<{ person?: string } | null>(null);
  const [paying, setPaying] = useState<Debt | null>(null);
  const [showSettled, setShowSettled] = useState(false);

  const sections = useMemo(() => {
    if (!data) return [];
    return data.people
      .map((person: PersonBalance) => ({
        person,
        data: data.debts.filter(
          (debt) => personKey(debt.personName) === personKey(person.personName) && (showSettled || !debt.settled),
        ),
      }))
      .filter((section) => section.data.length > 0);
  }, [data, showSettled]);

  const settledCount = data?.debts.filter((debt) => debt.settled).length ?? 0;
  const people = data?.people.map((person) => person.personName) ?? [];

  const handleRemind = async (person: PersonBalance) => {
    const debts = data?.debts.filter((debt) => personKey(debt.personName) === personKey(person.personName)) ?? [];
    try {
      await Share.share({ message: reminderMessage(person.personName, debts) });
    } catch {
      toast.error("Couldn't open sharing");
    }
  };

  return (
    <Screen>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 8, paddingBottom: 16 }}>
        <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Go back" hitSlop={8}>
          <MaterialCommunityIcons name="arrow-left" size={24} color="#111827" />
        </Pressable>
        <Text style={{ flex: 1, fontSize: 18, fontWeight: '700', color: '#111827' }}>Utang</Text>
      </View>

      {data && (
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
          <View style={{ flex: 1, backgroundColor: '#ECFDF5', borderRadius: 16, padding: 14 }}>
            <Text style={{ fontSize: 12, fontWeight: '600', color: '#047857' }}>Owed to you</Text>
            <Text style={{ fontSize: 20, fontWeight: '800', color: '#065F46', marginTop: 4 }}>{formatCurrency(data.owedToYou)}</Text>
          </View>
          <View style={{ flex: 1, backgroundColor: '#FEF2F2', borderRadius: 16, padding: 14 }}>
            <Text style={{ fontSize: 12, fontWeight: '600', color: '#B91C1C' }}>You owe</Text>
            <Text style={{ fontSize: 20, fontWeight: '800', color: '#991B1B', marginTop: 4 }}>{formatCurrency(data.youOwe)}</Text>
          </View>
        </View>
      )}

      {!data && isLoading ? (
        <Loader />
      ) : isError && !data ? (
        <View style={{ alignItems: 'center', paddingVertical: 32 }}>
          <Text style={{ fontSize: 15, color: '#6B7280', marginBottom: 12 }}>Failed to load utang</Text>
          <Button title="Retry" onPress={() => refetch()} />
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          stickySectionHeadersEnabled={false}
          showsVerticalScrollIndicator={false}
          refreshing={isRefetching}
          onRefresh={refetch}
          contentContainerStyle={{ paddingBottom: 110 }}
          renderSectionHeader={({ section }) => {
            const { person } = section;
            const owesYou = person.net > 0;
            return (
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 16, marginBottom: 8, gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 16, fontWeight: '700', color: '#111827' }}>{person.personName}</Text>
                  <Text style={{ fontSize: 12, color: person.net === 0 ? '#6B7280' : owesYou ? '#047857' : '#B91C1C' }}>
                    {person.net === 0 ? 'All settled' : owesYou ? `Owes you ${formatCurrency(person.net)}` : `You owe ${formatCurrency(-person.net)}`}
                  </Text>
                </View>
                {person.owedToYou > 0 && (
                  <Pressable onPress={() => handleRemind(person)} hitSlop={6} accessibilityRole="button" accessibilityLabel={`Remind ${person.personName}`}>
                    <Text style={{ fontSize: 13, fontWeight: '600', color: '#2563EB' }}>Remind</Text>
                  </Pressable>
                )}
                <Pressable
                  onPress={() => setAdding({ person: person.personName })}
                  hitSlop={6}
                  accessibilityRole="button"
                  accessibilityLabel={`Add utang with ${person.personName}`}
                >
                  <MaterialCommunityIcons name="plus-circle-outline" size={22} color="#2563EB" />
                </Pressable>
              </View>
            );
          }}
          renderItem={({ item }) => (
            <View style={{ marginBottom: 8 }}>
              <DebtRow debt={item} today={today} onPress={() => setEditing(item)} onPay={() => setPaying(item)} />
            </View>
          )}
          ListEmptyComponent={
            <EmptyState
              title="No utang yet"
              description="Keep track of money you lend or borrow. Record payments as they come, and send a friendly reminder."
              action={<Button title="Add Utang" icon="plus" onPress={() => setAdding({})} />}
            />
          }
          ListFooterComponent={
            settledCount > 0 ? (
              <Pressable onPress={() => setShowSettled((value) => !value)} style={{ alignItems: 'center', paddingVertical: 16 }}>
                <Text style={{ fontSize: 13, fontWeight: '600', color: '#6B7280' }}>
                  {showSettled ? 'Hide paid utang' : `Show ${settledCount} paid utang`}
                </Text>
              </Pressable>
            ) : null
          }
        />
      )}

      {data && data.debts.length > 0 && <FloatingAddButton label="Add Utang" onPress={() => setAdding({})} />}

      <DebtFormModal
        visible={adding !== null || editing !== null}
        debt={editing}
        people={people}
        initialPerson={adding?.person}
        onClose={() => {
          setAdding(null);
          setEditing(null);
        }}
      />
      <RecordPaymentModal debt={paying} onClose={() => setPaying(null)} />
    </Screen>
  );
}
