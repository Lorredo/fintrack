import React from 'react';
import { FlexWidget, TextWidget, ListWidget, ListWidgetStyle } from 'react-native-android-widget';

export function FinanceWidget({ budgets, lastUpdated }: { budgets: any[], lastUpdated: string }) {
  if (!budgets || budgets.length === 0) {
    return (
      <FlexWidget
        style={{
          height: 'match_parent',
          width: 'match_parent',
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: '#FFFFFF',
          borderRadius: 16,
        }}
      >
        <TextWidget text="No Active Budgets" style={{ fontSize: 16, color: '#6B7280' }} />
      </FlexWidget>
    );
  }

  return (
    <FlexWidget
      style={{
        height: 'match_parent',
        width: 'match_parent',
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 16,
        flexDirection: 'column',
      }}
    >
      <FlexWidget style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <TextWidget text="Safe to Spend" style={{ fontSize: 16, fontWeight: 'bold', color: '#111827' }} />
        <TextWidget text="FinTrack" style={{ fontSize: 12, color: '#2563EB', fontWeight: 'bold' }} />
      </FlexWidget>

      <FlexWidget style={{ flexDirection: 'column' }}>
        {budgets.map((b, i) => (
          <FlexWidget key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <TextWidget text={b.cat} style={{ fontSize: 14, color: '#374151' }} />
            <FlexWidget style={{ backgroundColor: b.ovr ? '#FEF2F2' : '#F0FDF4', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 }}>
              <TextWidget 
                text={b.ovr ? 'Overspent' : `$${b.rem}`} 
                style={{ fontSize: 14, fontWeight: 'bold', color: b.ovr ? '#EF4444' : '#16A34A' }} 
              />
            </FlexWidget>
          </FlexWidget>
        ))}
      </FlexWidget>
    </FlexWidget>
  );
}
