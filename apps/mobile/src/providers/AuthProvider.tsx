import {
  ReactNode,
  useEffect,
  useState,
} from "react";

import {
  useAuthStore,
} from "@/features/auth/store/auth.store";

import {
  storage,
  StorageKeys,
} from "@/lib/storage";


interface Props {
  children: ReactNode;
}


export function AuthProvider({
  children,
}: Props) {


  const [loading,setLoading] =
    useState(true);


  const restoreToken =
    useAuthStore(
      state => state.restoreToken
    );



  useEffect(()=>{


    function restoreSession(){


      const token =
        storage.get(
          StorageKeys.ACCESS_TOKEN
        );



      if(token){

        restoreToken(token);

      }



      setLoading(false);

    }



    restoreSession();


  },[restoreToken]);




  if(loading){

    return null;

  }



  return children;

}