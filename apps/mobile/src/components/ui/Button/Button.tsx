import { Pressable, Text, ActivityIndicator } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";

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

const spinnerColors: Record<string, string> = {
  primary: "#fff",
  secondary: "#fff",
  outline: "#2563EB",
  danger: "#fff",
};

export default function Button({
  title,
  loading,
  variant = "primary",
  style,
  disabled,
  icon,
  iconSize = 20,
  ...props
}: ButtonProps) {
  return (
    <Pressable
      disabled={disabled || loading}
      className={`py-[14px] rounded-lg items-center justify-center flex-row gap-sm ${variantClasses[variant]}`}
      style={style}
      {...props}
    >
      {loading ? (
        <ActivityIndicator color={spinnerColors[variant]} />
      ) : (
        <>
          {icon && (
            <MaterialCommunityIcons
              name={icon}
              size={iconSize}
              color={variant === "outline" ? "#2563EB" : "#fff"}
            />
          )}
          {title && (
            <Text
              className={`font-semibold text-body ${textClasses[variant]}`}
            >
              {title}
            </Text>
          )}
        </>
      )}
    </Pressable>
  );
}