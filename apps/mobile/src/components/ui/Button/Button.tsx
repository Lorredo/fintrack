import { Pressable, Text, ActivityIndicator } from "react-native";

import { ButtonProps } from "./Button.types";

const variantClasses: Record<string, string> = {
  primary: "bg-primary",
  secondary: "bg-secondary",
  outline: "border border-primary bg-transparent",
  danger: "bg-danger",
};

const textClasses: Record<string, string> = {
  primary: "text-white",
  secondary: "text-white",
  outline: "text-primary",
  danger: "text-white",
};

export default function Button({
  title,
  loading,
  variant = "primary",
  style,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <Pressable
      disabled={disabled || loading}
      className={`py-[14px] rounded-lg items-center justify-center ${variantClasses[variant]}`}
      style={style}
      {...props}
    >
      {loading ? (
        <ActivityIndicator color="#fff" />
      ) : (
        <Text
          className={`font-semibold text-body ${textClasses[variant]}`}
        >
          {title}
        </Text>
      )}
    </Pressable>
  );
}