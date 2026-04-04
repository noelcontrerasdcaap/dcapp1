import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';


const API_URL = "https://dcapp1-production.up.railway.app";


interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  agency: string;
}


interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
}


const AuthContext = createContext<AuthContextType | undefined>(undefined);


export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);


  useEffect(() => {
    loadStoredAuth();
  }, []);


  const loadStoredAuth = async () => {
    try {
      const storedToken =
        typeof window !== 'undefined' ? localStorage.getItem('token') : null;


      if (storedToken) {
        setToken(storedToken);


        const response = await fetch(`${API_URL}/api/auth/me`, {
          headers: {
            Authorization: `Bearer ${storedToken}`,
          },
        });


        if (!response.ok) {
          throw new Error('No se pudo obtener el usuario');
        }


        const data = await response.json();
        setUser(data);
      }
    } catch (error) {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('token');
      }
      setToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };


  const login = async (email: string, password: string) => {
    const response = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });


    if (!response.ok) {
      throw new Error('Error al iniciar sesión');
    }


    const data = await response.json();
    const { access_token } = data;


    if (typeof window !== 'undefined') {
      localStorage.setItem('token', access_token);
    }


    setToken(access_token);


    const userResponse = await fetch(`${API_URL}/api/auth/me`, {
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
    });


    if (!userResponse.ok) {
      throw new Error('No se pudo obtener el usuario');
    }


    const userData = await userResponse.json();
    setUser(userData);
  };


  const logout = async () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('token');
    }


    setToken(null);
    setUser(null);
  };


  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        login,
        logout,
        isAuthenticated: !!user && !!token,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}


export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}