import { View } from "react-native";

import { useState } from "react";
import { loginSchema } from "../validation/login.schema";
import { useLogin } from "../hooks/useLogin";
import { useAppNavigation } from "@/shared/navigation/navigationHelpers";
import { Button, Input, FormError } from "@/components/ui";
import { useApiErrorHandler } from "@/hooks/useApiErrorHandler";

export default function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [validationError, setValidationError] = useState("");

  const router = useAppNavigation();
  const { handleError } = useApiErrorHandler();

  const {
    loginAsync,
    loading,
    error: loginError,
  } = useLogin();

  async function handleSubmit() {
    const result = loginSchema.safeParse({ email, password });

    if (!result.success) {
      setValidationError(result.error.issues[0].message);
      return;
    }

    try {
      setValidationError("");

      await loginAsync({ email, password });

      router.goToHome();
    } catch (error) {
      handleError(error);
    }
  }

  return (
    <View className="gap-md p-md">
      <Input
        label="Email"
        value={email}
        onChangeText={setEmail}
        placeholder="Email"
        autoCapitalize="none"
        keyboardType="email-address"
      />

      <Input
        label="Password"
        value={password}
        onChangeText={setPassword}
        placeholder="Password"
        secureTextEntry
      />

     {Boolean(validationError) && (
  <FormError message={validationError} />
)}

      {loginError && !validationError && (
        <FormError message={loginError?.message} />
      )}

      <Button
        title="Login"
        onPress={handleSubmit}
        loading={loading}
      />
    </View>
  );
}