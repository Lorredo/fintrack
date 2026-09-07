import { Pressable, Text, ActivityIndicator, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import { ButtonProps } from "./Button.types";

const variantClasses: Record<string, string> = {
  primary: "bg-primary",
  secondary: "bg-secondary",
  outline: "border-2 border-primary bg-transparent",
  danger: "bg-danger",
  ghost: "bg-transparent",
};

const textClasses: Record<string, string> = {
  primary: "text-white",
  secondary: "text-white",
  outline: "text-primary",
  danger: "text-white",
  ghost: "text-primary",
};

const spinnerColors: Record<string, string> = {
  primary: "#fff",
  secondary: "#fff",
  outline: "#2563EB",
  danger: "#fff",
  ghost: "#2563EB",
};

const shadowStyle = {
  shadowColor: "#2563EB",
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.2,
  shadowRadius: 8,
  elevation: 4,
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
  const isPrimary = variant === "primary";

  return (
    <Pressable
      disabled={disabled || loading}
      className={`py-[15px] rounded-xl items-center justify-center flex-row gap-sm active:opacity-75 ${variantClasses[variant]} ${disabled ? "opacity-50" : ""}`}
      style={[isPrimary && !disabled ? shadowStyle : undefined, style]}
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
              color={variant === "outline" || variant === "ghost" ? "#2563EB" : "#fff"}
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