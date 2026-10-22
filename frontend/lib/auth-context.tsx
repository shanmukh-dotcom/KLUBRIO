'use client';

import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import type { User } from '@/types';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  updateUser: (updates: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const MOCK_STUDENT: User = {
  id: 'user-1',
  fullName: 'Ballaya',
  email: 'ballaya@example.com',
  avatar: undefined,
  college: 'Presidency University',
  collegeId: 'col-1',
  branch: 'CSE (AI & ML)',
  yearOfStudy: 3,
  interests: ['Technology', 'AI/ML', 'Entrepreneurship'],
  role: 'student',
  createdAt: '2026-06-01T00:00:00Z',
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(MOCK_STUDENT);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Check localStorage for existing session
    const stored = localStorage.getItem('klubrio_user');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (parsed.fullName && parsed.fullName.toLowerCase().includes('shanmukh')) {
          parsed.fullName = 'Ballaya';
          parsed.email = 'ballaya@example.com';
          localStorage.setItem('klubrio_user', JSON.stringify(parsed));
        }
        setUser(parsed);
      } catch {
        setUser(MOCK_STUDENT);
      }
    } else {
      setUser(MOCK_STUDENT);
      localStorage.setItem('klubrio_user', JSON.stringify(MOCK_STUDENT));
    }
    setIsLoading(false);
  }, []);

  const login = async (email: string, _password: string) => {
    // Mock login — accept any credentials for demo
    setIsLoading(true);
    await new Promise(r => setTimeout(r, 800));
    const loggedInUser = { ...MOCK_STUDENT, email };
    setUser(loggedInUser);
    localStorage.setItem('klubrio_user', JSON.stringify(loggedInUser));
    setIsLoading(false);
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('klubrio_user');
  };

  const updateUser = (updates: Partial<User>) => {
    if (!user) return;
    const updated = { ...user, ...updates };
    setUser(updated);
    localStorage.setItem('klubrio_user', JSON.stringify(updated));
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
