import { AuthApi } from '../api/auth.api';
import { useAuthStore } from '../store/auth.store';

import { storage, StorageKeys } from '@/lib/storage';

import type {
  LoginRequest,
  RegisterRequest
} from "../types/auth.types";

export class AuthService {
  static async login(payload: LoginRequest) {
    const response = await AuthApi.login(payload);

    storage.set(
      StorageKeys.ACCESS_TOKEN,
      response.tokens.accessToken,
    );

    storage.set(
      StorageKeys.REFRESH_TOKEN,
      response.tokens.refreshToken,
    );

    storage.set(
        StorageKeys.USER,
        JSON.stringify(response.user)
    );

   useAuthStore.getState().setSession(
   response.user,
   response.tokens.accessToken,
   response.tokens.refreshToken,
);

    

    return response.user;
  }

  static async register(payload: RegisterRequest) {
    return AuthApi.register(payload);
  }

  static async logout() {
    storage.remove(StorageKeys.ACCESS_TOKEN);

    storage.remove(StorageKeys.REFRESH_TOKEN);

    storage.remove(
 StorageKeys.USER
);


    useAuthStore.getState().clearSession();

    await AuthApi.logout();
  }
}