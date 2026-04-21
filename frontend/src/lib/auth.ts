// Authentication utilities
import axios from 'axios';

// API base from environment; no hardcoded fallback per deployment policy
const API_BASE = import.meta.env.VITE_API_URL as string;
if (!API_BASE) {
  console.error("VITE_API_URL is not set. Please configure it in your deployment environment.");
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
}

export const authClient = axios.create({
  baseURL: API_BASE,
});

// Add auth token to requests
authClient.interceptors.request.use((config) => {
  const tokens = getTokens();
  if (tokens?.access_token) {
    config.headers.Authorization = `Bearer ${tokens.access_token}`;
  }
  return config;
});

export const saveTokens = (tokens: AuthTokens) => {
  localStorage.setItem('auth_tokens', JSON.stringify(tokens));
};

export const getTokens = (): AuthTokens | null => {
  const stored = localStorage.getItem('auth_tokens');
  return stored ? JSON.parse(stored) : null;
};

export const clearTokens = () => {
  localStorage.removeItem('auth_tokens');
};

export const isAuthenticated = (): boolean => {
  return !!getTokens()?.access_token;
};

export const initiateLogin = async () => {
  console.log("🚀 Initiating login with backend:", API_BASE);
  try {
    const response = await axios.get(`${API_BASE}/auth/login`);
    console.log("✅ Login endpoint response:", response.data);
    if (response.data.url) {
      // State is managed server-side, just redirect
      console.log("🔄 Redirecting to Google OAuth:", response.data.url);
      window.location.href = response.data.url;
    } else {
      console.error("❌ Invalid response from /auth/login:", response.data);
    }
  } catch (error) {
    console.error("❌ Error initiating login:", error);
    throw error;
  }
};
