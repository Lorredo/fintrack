import { StyleProp, ViewStyle, TextInputProps } from 'react-native';

export interface TextFieldProps
  extends Omit<TextInputProps, 'style'> {
  label?: string;
  error?: string;
  containerStyle?: StyleProp<ViewStyle>;
}