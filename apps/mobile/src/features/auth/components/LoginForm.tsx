import {
  View,
  Text,
  TextInput,
  Pressable,
} from "react-native";

import { useState } from "react";
import { loginSchema } from "../validation/login.schema";
import { useLogin } from "../hooks/useLogin";
import { useRouter } from "expo-router";



export default function LoginForm() {

  const [email,setEmail] = useState("");
  const [password,setPassword] = useState("");

  const [error,setError] = useState("");


const router = useRouter();

const {
  loginAsync,
  loading,
  error: loginError,
} = useLogin();


async function handleSubmit(){

  const result =
    loginSchema.safeParse({
      email,
      password,
    });


  if(!result.success){

    setError(
      result.error
        .issues[0]
        .message
    );

    return;
  }


  try {

    setError("");


    await loginAsync({
      email,
      password,
    });


    router.replace("/");


  } catch(error){

    console.log(error);

  }

}

return (
  <View>
    <TextInput
      value={email}
      onChangeText={setEmail}
      placeholder="Email"
      autoCapitalize="none"
    />

    <TextInput
      value={password}
      onChangeText={setPassword}
      placeholder="Password"
      secureTextEntry
    />

  {error || loginError ? (
<Text>
  {error || loginError?.message}
</Text>
) : null}

  <Pressable
  onPress={handleSubmit}
  disabled={loading}
>

<Text>
  {loading ? "Logging in..." : "Login"}
</Text>

</Pressable>
  </View>
);
}