import { StyleProp, ViewStyle } from 'react-native';

export interface BadgeProps {
  label: string;
  variant?: 'primary' | 'success' | 'warning' | 'danger' | 'outline';
  size?: 'sm' | 'md';
  style?: StyleProp<ViewStyle>;
}