import { Stack } from "expo-router";

import { AppProvider } from "@/providers/AppProvider";
import AuthInitializer from "@/providers/AuthInitializer";
import ApiInitializer from "@/providers/ApiInitializer";



export default function RootLayout(){

  return (

    <AppProvider>

    <ApiInitializer />
    <AuthInitializer />


        <Stack
        screenOptions={{
          headerShown:false
        }}
        />


    </AppProvider>
  );
}