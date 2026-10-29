import type { User } from './user.types';

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface LoginResponse {
  user: User;
  tokens: AuthTokens;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

export interface RefreshTokenResponse {
  accessToken: string;
  refreshToken?: string;
}

export interface AuthResponse {
  message: string;
}

// The server reads the user's identity from the verified token only.
export interface GoogleAuthRequest {
  idToken: string;
}

export interface AppleAuthRequest {
  identityToken: string;
  // Apple shares the name only once, on first sign-in.
  fullName?: string;
}

export interface SetPinRequest {
  pin: string;
}

export interface VerifyPinRequest {
  pin: string;
}

export interface PinLoginRequest {
  pin: string;
  email: string;
}

export interface PinResponse {
  message: string;
}