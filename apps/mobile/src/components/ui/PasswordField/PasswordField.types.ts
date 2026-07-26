import { StyleProp, ViewStyle, TextInputProps } from 'react-native';

export interface PasswordFieldProps
  extends Omit<TextInputProps, 'style' | 'secureTextEntry'> {
  label?: string;
  error?: string;
  containerStyle?: StyleProp<ViewStyle>;
}