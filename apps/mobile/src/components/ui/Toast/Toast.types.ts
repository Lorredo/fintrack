import { StyleProp, ViewStyle } from 'react-native';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastData {
  id: string;
  message: string;
  type: ToastType;
}

export interface ToastProps {
  message: string;
  type: ToastType;
  onDismiss: () => void;
  style?: StyleProp<ViewStyle>;
}