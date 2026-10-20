import { useEffect } from "react";

import {
 storage,
 StorageKeys
} from "@/lib/storage";

import {
 useAuthStore
} from "../store/auth.store";
import { PinService } from "../services/pin.service";
import { useLockStore } from "../store/lock.store";


export function useAuthHydration(){


const setHydrated =
useAuthStore(
 state => state.setHydrated
);


const setSession =
useAuthStore(
 state => state.setSession
);



useEffect(()=>{

const token =
storage.get(
 StorageKeys.ACCESS_TOKEN
);


const user =
storage.get(
 StorageKeys.USER
);

const refreshToken =
storage.get(
  StorageKeys.REFRESH_TOKEN
);

if(token && refreshToken && user){

 setSession(
   JSON.parse(user),
   token,
   refreshToken
 );

 if (PinService.hasPin()) {
   useLockStore.getState().lock();
 }

}


setHydrated(true);


},[setHydrated, setSession]);


}