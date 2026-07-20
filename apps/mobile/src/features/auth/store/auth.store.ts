import { create } from 'zustand';

import type { User } from '../types/user.types';

interface AuthState {

  user: User | null;

  accessToken: string | null;

  refreshToken: string | null;

  isAuthenticated: boolean;

  hydrated:boolean;


  setSession:
  (
    user:User,
    accessToken:string,
    refreshToken:string
  )=>void;


  restoreToken:
  (
    accessToken:string,
    refreshToken:string
  )=>void;


  clearSession:
  ()=>void;


  setHydrated:
  (value:boolean)=>void;

}
export const useAuthStore = create<AuthState>((set)=>({

 user:null,

 accessToken:null,

 refreshToken:null,

 isAuthenticated:false,

 hydrated:false,


 setSession:
 (
   user,
   accessToken,
   refreshToken
 )=>
 set({
   user,
   accessToken,
   refreshToken,
   isAuthenticated:true
 }),



 restoreToken:
 (
   accessToken,
   refreshToken
 )=>
 set({
   accessToken,
   refreshToken,
   isAuthenticated:true
 }),



 clearSession:
 ()=>set({
   user:null,
   accessToken:null,
   refreshToken:null,
   isAuthenticated:false
 }),



 setHydrated:
 (value)=>
 set({
   hydrated:value
 })

}));