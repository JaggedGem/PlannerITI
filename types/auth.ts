export interface AuthResponse {
  token?: string;
  access_token?: string;
  message?: string;
}

export interface UserData {
  email: string;
  idnp?: string;
  is_verified: boolean;
}
