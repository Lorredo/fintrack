import { useEffect } from "react";

import {
 setupInterceptors
} from "@/lib/api.interceptor";


export default function ApiInitializer(){

useEffect(()=>{

 setupInterceptors();

},[]);


return null;

}