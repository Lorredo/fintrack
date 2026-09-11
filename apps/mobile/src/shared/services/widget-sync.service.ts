import React from 'react';
import { createMMKV } from 'react-native-mmkv';
import { requestWidgetUpdate } from 'react-native-android-widget';
import type { Budget } from '@/features/budgets/types';
import { FinanceWidget } from '../../../widget/FinanceWidget';

export const widgetStorage = createMMKV({
  id: 'widget-storage',
});

export const WidgetSyncService = {
  syncActiveBudgets(budgets: Budget[]) {
    try {
      const widgetPayload = budgets.map((b) => ({
        cat: b.category,
        rem: Math.max(b.remaining, 0),
        ovr: b.remaining < 0,
      })).slice(0, 4);
      
      const lastUpdated = new Date().toISOString();

      widgetStorage.set('fintrack_widget_budgets', JSON.stringify(widgetPayload));
      widgetStorage.set('fintrack_widget_last_updated', lastUpdated);

      requestWidgetUpdate({
        widgetName: 'FinanceWidget',
        renderWidget: () => React.createElement(FinanceWidget, { budgets: widgetPayload, lastUpdated }) as any,
      });

      console.log('[WidgetSync] Successfully synced budgets to native storage');
    } catch (error) {
      console.error('[WidgetSync] Failed to sync data to native bridge', error);
    }
  },
};
