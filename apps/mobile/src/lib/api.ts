import axios from 'axios';

import { env } from '@/config/env';

import {
  storage,
  StorageKeys,
} from './storage';

import {
  AuthApi,
} from '@/features/auth/api/auth.api';

import {
  useAuthStore,
} from '@/features/auth/store/auth.store';


export const api = axios.create({

  baseURL: env.API_URL,

  timeout: 10000,

  headers:{
    'Content-Type':'application/json',
  },

});



// =============================
// REQUEST INTERCEPTOR
// =============================

api.interceptors.request.use(

(config)=>{


  const token =
    storage.get(
      StorageKeys.ACCESS_TOKEN
    );


  if(token){

    config.headers.Authorization =
      `Bearer ${token}`;

  }


  return config;

},


(error)=>{

  return Promise.reject(error);

});





// =============================
// RESPONSE INTERCEPTOR
// =============================

api.interceptors.response.use(

(response)=>response,


async(error)=>{


  const originalRequest =
    error.config;



  if(
    error.response?.status === 401 &&
    !originalRequest._retry
  ){


    originalRequest._retry = true;



    try{


      const refreshToken =
        storage.get(
          StorageKeys.REFRESH_TOKEN
        );



      if(!refreshToken){

        throw error;

      }



      const response =
        await AuthApi.refresh({

          refreshToken,

        });



      const newAccessToken =
        response.accessToken;



      storage.set(

        StorageKeys.ACCESS_TOKEN,

        newAccessToken

      );



      useAuthStore
        .getState()
        .restoreToken(

          newAccessToken,

          refreshToken

        );



      originalRequest.headers.Authorization =
        `Bearer ${newAccessToken}`;



      return api(originalRequest);



    }
    catch(refreshError){



      storage.remove(
        StorageKeys.ACCESS_TOKEN
      );


      storage.remove(
        StorageKeys.REFRESH_TOKEN
      );


      storage.remove(
        StorageKeys.USER
      );


      useAuthStore
        .getState()
        .clearSession();



      return Promise.reject(refreshError);

    }


  }



  return Promise.reject(error);


});