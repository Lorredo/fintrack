import {
  TextInputProps,
  StyleProp,
  ViewStyle,
} from "react-native";

export interface InputProps
  extends Omit<TextInputProps, "style"> {

  label?: string;

  error?: string;

  containerStyle?: StyleProp<ViewStyle>;
}