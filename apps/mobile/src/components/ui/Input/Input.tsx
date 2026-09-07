import { useState } from "react";
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
  const [isFocused, setIsFocused] = useState(false);

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
        className={`rounded-xl px-md py-[15px] text-body text-text bg-surface border-2 ${
          error
            ? "border-danger"
            : isFocused
            ? "border-primary"
            : "border-border"
        }`}
        placeholderTextColor="#9CA3AF"
        onFocus={(e) => {
          setIsFocused(true);
          props.onFocus?.(e);
        }}
        onBlur={(e) => {
          setIsFocused(false);
          props.onBlur?.(e);
        }}
      />

      {error && (
        <Text className="text-danger mt-1 text-small">
          {error}
        </Text>
      )}
    </View>
  );
}