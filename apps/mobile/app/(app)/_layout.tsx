import AuthGuard from "@/shared/navigation/AuthGuard";
import { Stack } from "expo-router";

export default function AppLayout(){

return (

    <AuthGuard>

    <Stack
    screenOptions={{
        headerShown:false
    }}
    />

    </AuthGuard>

);

}