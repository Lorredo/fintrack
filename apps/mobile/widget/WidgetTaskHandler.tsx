import React from 'react';
import { WidgetTaskHandlerProps } from 'react-native-android-widget';
import { FinanceWidget } from './FinanceWidget';
import { widgetStorage } from '../src/shared/services/widget-sync.service';

export async function widgetTaskHandler(props: WidgetTaskHandlerProps) {
  let budgets = [];
  let lastUpdated = '';
  
  try {
    const raw = widgetStorage.getString('fintrack_widget_budgets');
    if (raw) {
      budgets = JSON.parse(raw);
    }
    lastUpdated = widgetStorage.getString('fintrack_widget_last_updated') || new Date().toISOString();
  } catch (e) {
    console.error('Failed to read widget data from MMKV', e);
  }

  props.renderWidget(
    <FinanceWidget budgets={budgets} lastUpdated={lastUpdated} />
  );
}
