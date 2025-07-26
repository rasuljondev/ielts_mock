export type UserRole = "super_admin" | "edu_admin" | "student";

export interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  username: string;
  phone: string;
  role: UserRole;
  edu_center_id?: string;
  created_at: string;
  updated_at: string;
}

export interface EduCenter {
  id: string;
  name: string;
  location: string;
  created_at: string;
  updated_at: string;
}

export interface AuthState {
  user: User | null;
  loading: boolean;
  isAuthenticated: boolean;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface SignupData {
  first_name: string;
  last_name: string;
  username: string;
  phone: string;
  email: string;
  password: string;
  edu_center_id: string;
}
