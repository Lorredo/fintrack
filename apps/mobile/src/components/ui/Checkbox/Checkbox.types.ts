import { StyleProp, ViewStyle } from 'react-native';

export interface CheckboxProps {
  checked: boolean;
  onToggle: () => void;
  label?: string;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}