import { StyleProp, ViewStyle } from 'react-native';

export interface SubmitButtonProps {
  title: string;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'danger';
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
}