import { Redirect } from "expo-router";
import {
  useAuthStore
} from "@/features/auth/store/auth.store";


export default function AuthGuard({
 children
}:{
 children: React.ReactNode
}){


const accessToken =
useAuthStore(
 state=>state.accessToken
);


const hydrated =
useAuthStore(
 state=>state.hydrated
);



if(!hydrated){
  return null;
}



if(!accessToken){

 return (
   <Redirect
    href="/login"
   />
 );

}



return children;


}