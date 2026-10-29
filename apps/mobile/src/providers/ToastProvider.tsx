import { View } from 'react-native';
import Animated, { FadeInUp, FadeOutUp, LinearTransition } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Toast } from '@/components/ui/Toast';
import { useToastStore } from '@/features/toast/store/toast.store';

export function ToastProvider() {
  const toasts = useToastStore((state) => state.toasts);
  const removeToast = useToastStore((state) => state.removeToast);
  const insets = useSafeAreaInsets();

  return (
    <View
      pointerEvents="box-none"
      className="absolute left-md right-md z-[9999]"
      style={{ top: insets.top + 8 }}
    >
      {toasts.map((toast) => (
        <Animated.View
          key={toast.id}
          entering={FadeInUp.springify().damping(18)}
          exiting={FadeOutUp.duration(180)}
          layout={LinearTransition.springify().damping(18)}
        >
          <Toast
            message={toast.message}
            type={toast.type}
            onDismiss={() => removeToast(toast.id)}
          />
        </Animated.View>
      ))}
    </View>
  );
}
