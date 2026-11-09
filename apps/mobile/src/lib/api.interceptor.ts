import { router } from "expo-router";

import { api } from "./api";
import { clearUserCache } from "./queryClient";

import {
  storage,
  StorageKeys,
} from "./storage";

import { AuthApi } from "@/features/auth/api/auth.api";
import { API_ENDPOINTS } from "@/shared/constants/api";

import {
  useAuthStore
} from "@/features/auth/store/auth.store";


let isRefreshing = false;


let failedQueue:any[] = [];


function processQueue(
  error:any,
  token:string | null = null
){

  failedQueue.forEach(prom => {

    if(error){
      prom.reject(error);
    }
    else{
      prom.resolve(token);
    }

  });


  failedQueue = [];

}

const TOKENLESS_ENDPOINTS: string[] = [
  API_ENDPOINTS.AUTH.LOGIN,
  API_ENDPOINTS.AUTH.PIN_LOGIN,
  API_ENDPOINTS.AUTH.GOOGLE,
  API_ENDPOINTS.AUTH.APPLE,
  API_ENDPOINTS.AUTH.REGISTER,
  API_ENDPOINTS.AUTH.REFRESH,
  API_ENDPOINTS.AUTH.RECOVER,
  API_ENDPOINTS.AUTH.RECOVER_GOOGLE,
];

let interceptorInitialized = false;

export function setupInterceptors(){

if(interceptorInitialized){
 return;
}

interceptorInitialized=true;

// The access token is attached by the request interceptor in api.ts.


/*
 RESPONSE
 Refresh token
*/


api.interceptors.response.use(


(response)=>response,


async(error)=>{


const originalRequest =
error.config;



// Their 401s mean wrong credentials, not an expired access token.
const isAuthEndpoint = TOKENLESS_ENDPOINTS.some(
  (endpoint) => originalRequest?.url?.endsWith(endpoint),
);

// Requests stopped before sending (offline) have no config to retry.
if(
 !originalRequest ||
 error.response?.status !== 401 ||
 originalRequest._retry ||
 isAuthEndpoint
){

 return Promise.reject(error);

}




if(isRefreshing){

 return new Promise(
(resolve,reject)=>{


failedQueue.push({
 resolve,
 reject
});


})
.then(token=>{


originalRequest.headers.Authorization = `Bearer ${token}`;


return api(originalRequest);

});


}





originalRequest._retry = true;


isRefreshing = true;



try{


const refreshToken =
storage.get(
 StorageKeys.REFRESH_TOKEN
);



if(!refreshToken){

 throw new Error(
 "No refresh token"
 );

}



const response =
await AuthApi.refresh({

refreshToken

});



const newAccessToken =
response.accessToken;

const newRefreshToken = 
response.refreshToken;

storage.set(
 StorageKeys.ACCESS_TOKEN,
newAccessToken
);

if(newRefreshToken){
  storage.set(
    StorageKeys.REFRESH_TOKEN,
    newRefreshToken
  );
}

useAuthStore
.getState()
.restoreToken(
 newAccessToken,
 newRefreshToken
);



processQueue(
 null,
 newAccessToken
);



originalRequest.headers.Authorization =
`Bearer ${newAccessToken}`;



return api(originalRequest);



}
catch(err:any){


processQueue(
 err,
 null
);


// A timeout or lost connection says nothing about the session, so stay
// signed in unless the server actually rejected it.
const sessionEnded =
 err?.response?.status === 401 ||
 !storage.get(StorageKeys.REFRESH_TOKEN);

if(!sessionEnded){
 return Promise.reject(error);
}


// Only clear session tokens, do NOT wipe user device PIN and settings
storage.remove(StorageKeys.ACCESS_TOKEN);
storage.remove(StorageKeys.REFRESH_TOKEN);
clearUserCache();


useAuthStore
.getState()
.clearSession();


router.replace("/login");



return Promise.reject(error);


}
finally{


isRefreshing=false;


}


}


);


}