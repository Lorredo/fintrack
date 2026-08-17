// src/components/ui/Screen.tsx
import { ReactNode } from 'react';
import { View, ViewProps, ScrollView, RefreshControl } from 'react-native';

interface ScreenProps extends ViewProps {
  children: ReactNode;
  scrollable?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
}

export function Screen({
  children,
  className = '',
  scrollable = false,
  refreshing = false,
  onRefresh,
  ...props
}: ScreenProps) {
  if (scrollable) {
    return (
      <View style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
        <ScrollView
          className={`flex-1 px-4 ${className}`}
          contentContainerStyle={{ paddingBottom: 32 }}
          refreshControl={
            onRefresh ? (
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            ) : undefined
          }
          {...props}
        >
          {children}
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
      <View className={`flex-1 px-4 ${className}`} {...props}>
        {children}
      </View>
    </View>
  );
}
