import { createMMKV } from 'react-native-mmkv';
import type { Budget } from '@/features/budgets/types';

// We initialize a dedicated MMKV instance for the widget.
// In a production bare workflow, you would set `appGroup: 'group.com.yourcompany.fintrack'` 
// here to share this storage with the iOS Widget extension.
export const widgetStorage = createMMKV({
  id: 'widget-storage',
});

export const WidgetSyncService = {
  syncActiveBudgets(budgets: Budget[]) {
    try {
      // Native widgets have strict memory and processing limits.
      // We map the data to a highly condensed format specifically for the widget UI
      // and slice it to just the top 3-4 budgets that fit on a small home screen widget.
      const widgetPayload = budgets.map((b) => ({
        cat: b.category,
        rem: Math.max(b.remaining, 0),
        ovr: b.remaining < 0,
      })).slice(0, 4);

      // Save it to the shared native storage bridge
      widgetStorage.set('fintrack_widget_budgets', JSON.stringify(widgetPayload));
      widgetStorage.set('fintrack_widget_last_updated', new Date().toISOString());

      console.log('[WidgetSync] Successfully synced budgets to native storage');

      // In the future, if you add an Expo Widget Module, you would also trigger 
      // a native reload command here (e.g., WidgetReloader.reloadAll()) 
      // to force the iOS/Android home screen to immediately repaint.
    } catch (error) {
      console.error('[WidgetSync] Failed to sync data to native bridge', error);
    }
  },
};
