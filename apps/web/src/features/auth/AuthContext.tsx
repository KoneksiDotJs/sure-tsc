import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { apiRequest, setStoredToken, ApiError } from '../../lib/api-client.js';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  mfaEnabled: boolean;
}

export interface AuthFamily {
  id: string;
  name: string;
  baseCurrency: string;
  aiEnabled: boolean;
}

export interface AuthMember {
  id: string;
  userId: string;
  name: string;
  email: string;
  role: 'OWNER' | 'ADMIN' | 'MEMBER';
}

export interface AuthApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  scopes: string[];
  lastUsedAt?: string | null;
  expiresAt?: string | null;
  createdAt: string;
}

export interface AuthSession {
  user: AuthUser;
  family: AuthFamily;
  role: 'OWNER' | 'ADMIN' | 'MEMBER';
  memberships: AuthMember[];
  apiKeys: AuthApiKey[];
}

interface AuthContextValue {
  session: AuthSession | null;
  isLoading: boolean;
  login: (input: { email: string; password: string; totpCode?: string }) => Promise<void>;
  register: (input: {
    email: string;
    password: string;
    name: string;
    familyName: string;
    baseCurrency: string;
  }) => Promise<void>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const authKeys = {
  session: ['auth', 'me'] as const,
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const queryClient = useQueryClient();
  const [session, setSession] = useState<AuthSession | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const refreshSession = useCallback(async () => {
    try {
      const data = await apiRequest<AuthSession>('/api/v1/auth/me');
      setSession(data);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setStoredToken(null);
      }
      setSession(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshSession();
  }, [refreshSession]);

  const login = useCallback(
    async (input: { email: string; password: string; totpCode?: string }) => {
      const res = await apiRequest<{ token: string }>('/api/v1/auth/login', {
        method: 'POST',
        body: JSON.stringify(input),
      });
      if (res?.token) {
        setStoredToken(res.token);
      }
      queryClient.clear();
      await refreshSession();
    },
    [queryClient, refreshSession]
  );

  const register = useCallback(
    async (input: {
      email: string;
      password: string;
      name: string;
      familyName: string;
      baseCurrency: string;
    }) => {
      const res = await apiRequest<{ token: string }>('/api/v1/auth/register', {
        method: 'POST',
        body: JSON.stringify(input),
      });
      if (res?.token) {
        setStoredToken(res.token);
      }
      queryClient.clear();
      await refreshSession();
    },
    [queryClient, refreshSession]
  );

  const logout = useCallback(async () => {
    try {
      await apiRequest('/api/v1/auth/logout', { method: 'POST' });
    } catch {
      // Clear local credentials even if the server request fails
    }
    setStoredToken(null);
    setSession(null);
    queryClient.clear();
  }, [queryClient]);

  return (
    <AuthContext.Provider
      value={{
        session,
        isLoading,
        login,
        register,
        logout,
        refreshSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return ctx;
}
