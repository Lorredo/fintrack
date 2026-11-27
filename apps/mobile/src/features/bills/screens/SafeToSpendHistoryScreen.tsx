import { FlatList, Pressable, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { Button, EmptyState, Loader, Screen } from '@/components/ui';
import { formatCurrency } from '@/shared/utils/categories';
import { useSafeToSpendHistory } from '../hooks/useBills';
import type { PayPeriodSummary, SafeToSpendHistory } from '../types';
import { leftOver, periodOutcome, periodRange, periodResult, spentShare, type Figure, type ResultTone } from '../utils/historyLabels';

const TONES: Record<ResultTone, { background: string; text: string }> = {
  under: { background: '#ECFDF5', text: '#047857' },
  over: { background: '#FEF2F2', text: '#B91C1C' },
  neutral: { background: '#F3F4F6', text: '#374151' },
};

function Line({ label, value, minus }: { label: string; value: number; minus?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3, gap: 12 }}>
      <Text style={{ flex: 1, fontSize: 13, color: '#4B5563' }}>{label}</Text>
      <Text style={{ fontSize: 13, fontWeight: '500', color: '#111827' }}>
        {minus && value > 0 ? '−' : ''}
        {formatCurrency(value)}
      </Text>
    </View>
  );
}

function SpentBar({ period }: { period: PayPeriodSummary }) {
  const { share, over } = spentShare(period);
  return (
    <View style={{ marginTop: 10 }}>
      <View style={{ height: 8, borderRadius: 4, backgroundColor: '#E5E7EB', overflow: 'hidden' }}>
        <View style={{ width: `${share * 100}%`, height: '100%', borderRadius: 4, backgroundColor: over ? '#DC2626' : '#10B981' }} />
      </View>
      <Text style={{ fontSize: 12, color: '#6B7280', marginTop: 4 }}>
        Spent {formatCurrency(period.spent)} of {formatCurrency(period.spendingMoney)} planned
      </Text>
    </View>
  );
}

function FigureBox({ figure, align = 'left' }: { figure: Figure; align?: 'left' | 'right' }) {
  return (
    <View style={{ flex: 1, alignItems: align === 'right' ? 'flex-end' : 'flex-start' }}>
      <Text style={{ fontSize: 12, color: '#6B7280' }}>{figure.label}</Text>
      <Text style={{ fontSize: 18, fontWeight: '800', color: TONES[figure.tone].text, marginTop: 2 }}>
        {formatCurrency(figure.amount)}
      </Text>
    </View>
  );
}

function PeriodRow({ period }: { period: PayPeriodSummary }) {
  const result = periodResult(period);
  const outcome = periodOutcome(period);
  return (
    <View style={{ backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, marginBottom: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 15, fontWeight: '700', color: '#111827' }}>{periodRange(period)}</Text>
          {period.current && (
            <Text style={{ fontSize: 12, color: '#2563EB', marginTop: 2 }}>
              In progress · {period.daysLeft} day{period.daysLeft === 1 ? '' : 's'} left
            </Text>
          )}
          {!period.current && period.planEstimated && (
            <Text style={{ fontSize: 12, color: '#B45309', marginTop: 2 }}>Estimated plan, from your current pay settings</Text>
          )}
        </View>
        {result && (
          <View style={{ backgroundColor: TONES[result.tone].background, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: TONES[result.tone].text }}>{result.label}</Text>
          </View>
        )}
      </View>

      {period.hasPlan && <SpentBar period={period} />}

      <View style={{ marginTop: 10 }}>
        <Line label={period.extraIncome > 0 ? `Received (${formatCurrency(period.extraIncome)} extra)` : 'Received'} value={period.received} />
        {period.hasPlan && period.payEstimated && (
          <Text style={{ fontSize: 12, color: '#B45309', paddingBottom: 2 }}>
            {"Your salary wasn't all recorded, so this is planned from your expected pay."}
          </Text>
        )}
        <Line label="Bills, paluwagan and utang" value={period.bills} minus />
        <Line label="Moved to savings" value={period.movedToSavings} minus />
        {period.hasPlan && <Line label="Planned spending" value={period.spendingMoney} />}
        <Line label="Spent" value={period.spent} minus />
      </View>

      <View style={{ flexDirection: 'row', gap: 12, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#F3F4F6' }}>
        <FigureBox figure={outcome.saved} />
        <FigureBox figure={outcome.left} align="right" />
      </View>
    </View>
  );
}

function Summary({ totals, left }: { totals: SafeToSpendHistory['totals']; left: number }) {
  if (totals.periods === 0) return null;
  const planned = totals.under + totals.over;
  const under = totals.result >= 0;
  return (
    <View style={{ backgroundColor: '#FFFFFF', borderRadius: 20, padding: 18, marginBottom: 16 }}>
      <Text style={{ fontSize: 13, fontWeight: '600', color: '#374151' }}>
        Last {totals.periods} finished pay period{totals.periods === 1 ? '' : 's'}
      </Text>
      <View style={{ flexDirection: 'row', gap: 12, marginTop: 10 }}>
        <FigureBox figure={{ label: 'Saved', amount: totals.movedToSavings, tone: totals.movedToSavings > 0 ? 'under' : 'neutral' }} />
        <FigureBox
          figure={left >= 0 ? { label: 'Left over', amount: left, tone: left > 0 ? 'under' : 'neutral' } : { label: 'Short', amount: -left, tone: 'over' }}
          align="right"
        />
      </View>
      {planned > 0 && (
        <Text style={{ fontSize: 13, color: under ? '#047857' : '#B91C1C', marginTop: 10 }}>
          {formatCurrency(Math.abs(totals.result))} {under ? 'under plan' : 'over plan'} · {totals.under} under, {totals.over} over
        </Text>
      )}
      <Text style={{ fontSize: 12, color: '#6B7280', marginTop: 6 }}>
        Saved is what you moved to savings. Left over is what you received minus bills, savings and spending.
      </Text>
    </View>
  );
}

export default function SafeToSpendHistoryScreen() {
  const router = useRouter();
  const { data, isLoading, isError, refetch, isRefetching, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useSafeToSpendHistory();

  const periods = data?.pages.flatMap((page) => page.periods) ?? [];
  // Left over across finished periods; the one in progress isn't done yet.
  const totalLeft =
    Math.round(periods.filter((period) => !period.current).reduce((sum, period) => sum + leftOver(period), 0) * 100) / 100;
  // Totals for every period loaded so far.
  const totals = (data?.pages ?? []).reduce(
    (sum, page) => ({
      periods: sum.periods + page.totals.periods,
      under: sum.under + page.totals.under,
      over: sum.over + page.totals.over,
      result: sum.result + page.totals.result,
      movedToSavings: sum.movedToSavings + page.totals.movedToSavings,
    }),
    { periods: 0, under: 0, over: 0, result: 0, movedToSavings: 0 },
  );

  return (
    <Screen>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 8, paddingBottom: 16 }}>
        <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Go back" hitSlop={8}>
          <MaterialCommunityIcons name="arrow-left" size={24} color="#111827" />
        </Pressable>
        <Text style={{ flex: 1, fontSize: 18, fontWeight: '700', color: '#111827' }}>Pay period history</Text>
      </View>

      {!data && isLoading ? (
        <Loader />
      ) : isError && !data ? (
        <View style={{ alignItems: 'center', paddingVertical: 32 }}>
          <Text style={{ fontSize: 15, color: '#6B7280', marginBottom: 12 }}>Failed to load your history</Text>
          <Button title="Retry" onPress={() => refetch()} />
        </View>
      ) : (
        <FlatList
          data={periods}
          keyExtractor={(period) => period.start}
          renderItem={({ item }) => <PeriodRow period={item} />}
          showsVerticalScrollIndicator={false}
          refreshing={isRefetching && !isFetchingNextPage}
          onRefresh={refetch}
          contentContainerStyle={{ paddingBottom: 32 }}
          ListHeaderComponent={
            <Summary totals={{ ...totals, result: Math.round(totals.result * 100) / 100 }} left={totalLeft} />
          }
          ListEmptyComponent={
            <EmptyState
              title="No history yet"
              description="Each pay period shows up here with what you received, paid and spent, and how it compared with your plan."
            />
          }
          ListFooterComponent={
            hasNextPage ? (
              <Button title="Load more" variant="outline" onPress={() => fetchNextPage()} loading={isFetchingNextPage} />
            ) : null
          }
        />
      )}
    </Screen>
  );
}
