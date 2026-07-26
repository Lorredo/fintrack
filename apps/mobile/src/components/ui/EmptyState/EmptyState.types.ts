import { ReactNode } from 'react';
import { StyleProp, ViewStyle } from 'react-native';

export interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  style?: StyleProp<ViewStyle>;
}