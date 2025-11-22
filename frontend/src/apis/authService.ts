import api, { API_BASE_URL } from './api';

// Types
export interface User {
  id: number;
  username: string;
  email: string;
  full_name: string | null;
  is_active: boolean;
  is_verified: boolean;
  created_at: string;
}

export interface LoginResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  user: User;
}

export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
  full_name?: string;
}

export interface RegisterResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  user: User;
}

export interface RefreshTokenResponse {
  access_token: string;
  token_type: string;
}

// Auth Service
export const authService = {
  /**
   * Login with username and password
   */
  async login(username: string, password: string): Promise<LoginResponse> {
    const formData = new URLSearchParams();
    formData.append('username', username);
    formData.append('password', password);

    const response = await api.post<LoginResponse>('/auth/login', formData, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    return response.data;
  },

  /**
   * Register a new user
   */
  async register(data: RegisterRequest): Promise<RegisterResponse> {
    const response = await api.post<RegisterResponse>('/auth/register', data);
    return response.data;
  },

  /**
   * Logout current user
   */
  async logout(): Promise<void> {
    await api.post('/auth/logout');
  },

  /**
   * Get current user info
   */
  async getCurrentUser(): Promise<User> {
    const response = await api.get<User>('/auth/me');
    return response.data;
  },

  /**
   * Refresh access token
   */
  async refreshToken(refreshToken: string): Promise<RefreshTokenResponse> {
    const response = await api.post<RefreshTokenResponse>('/auth/refresh', {
      refresh_token: refreshToken,
    });
    return response.data;
  },

  /**
   * Check auth health
   */
  async checkHealth(): Promise<{ status: string; secret_key_loaded: boolean }> {
    const response = await api.get('/auth/health');
    return response.data;
  },
};

export default authService;
