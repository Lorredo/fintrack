import {
 useAuthHydration
} from "@/features/auth/hooks/useAuthHydration";


export default function AuthInitializer(){

 useAuthHydration();

 return null;

}