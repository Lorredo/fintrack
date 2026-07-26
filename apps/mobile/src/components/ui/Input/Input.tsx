import {
  View,
  Text,
  TextInput,
} from "react-native";

import { InputProps } from "./Input.types";

export default function Input({
  label,
  error,
  containerStyle,
  ...props
}: InputProps) {
  return (
    <View
      className="mb-md"
      style={containerStyle}
    >
      {label && (
        <Text className="mb-[6px] text-caption font-semibold text-text">
          {label}
        </Text>
      )}

      <TextInput
        {...props}
        className={`border rounded-xl px-md py-[14px] text-body text-text bg-surface ${
          error ? "border-danger" : "border-[#D1D5DB]"
        }`}
      />

      {error && (
        <Text className="text-danger mt-1 text-small">
          {error}
        </Text>
      )}
    </View>
  );
}