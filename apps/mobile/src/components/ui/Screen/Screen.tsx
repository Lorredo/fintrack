import { ReactNode } from 'react';
import { View, ViewProps, ScrollView, RefreshControl, Platform, KeyboardAvoidingView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface ScreenProps extends ViewProps {
  children: ReactNode;
  scrollable?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  floatingComponent?: ReactNode;
}

export function Screen({
  children,
  className = '',
  scrollable = false,
  refreshing = false,
  onRefresh,
  floatingComponent,
  ...props
}: ScreenProps) {
  const insets = useSafeAreaInsets();
  const paddingTop = Platform.OS === 'android' ? Math.max(insets.top, 16) : insets.top;

  if (scrollable) {
    return (
      <KeyboardAvoidingView 
        style={{ flex: 1, backgroundColor: '#F5F7FA', paddingTop }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          className={`flex-1 px-5 ${className}`}
          contentContainerStyle={{ paddingBottom: 40 }}
          refreshControl={
            onRefresh ? (
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#2563EB" />
            ) : undefined
          }
          showsVerticalScrollIndicator={false}
          {...props}
        >
          {children}
        </ScrollView>
        {floatingComponent}
      </KeyboardAvoidingView>
    );
  }

  return (
    <KeyboardAvoidingView 
      style={{ flex: 1, backgroundColor: '#F5F7FA', paddingTop }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View className={`flex-1 px-5 ${className}`} {...props}>
        {children}
      </View>
      {floatingComponent}
    </KeyboardAvoidingView>
  );
}
