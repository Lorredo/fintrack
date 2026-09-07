import { router } from "expo-router";

import { api } from "./api";

import {
  storage,
  StorageKeys,
} from "./storage";

import { AuthApi } from "@/features/auth/api/auth.api";

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

let interceptorInitialized = false;

export function setupInterceptors(){

if(interceptorInitialized){
 return;
}

interceptorInitialized=true;

/*
 REQUEST
 Attach access token
*/

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


(error)=>Promise.reject(error)

);





/*
 RESPONSE
 Refresh token
*/


api.interceptors.response.use(


(response)=>response,


async(error)=>{


const originalRequest =
error.config;



if(
 error.response?.status !== 401 ||
 originalRequest._retry ||
 originalRequest.url?.includes('auth/login') ||
 originalRequest.url?.includes('auth/register') ||
 originalRequest.url?.includes('auth/refresh')
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
catch(err){


processQueue(
 err,
 null
);



storage.clear();


useAuthStore
.getState()
.clearSession();


router.replace("/login");



return Promise.reject(err);


}
finally{


isRefreshing=false;


}


}


);


}