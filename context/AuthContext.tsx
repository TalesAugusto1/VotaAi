import * as SecureStore from "expo-secure-store";
import React, { createContext, useContext, useEffect, useState } from "react";
import { authService } from "../services/api";
import { User } from "../types";

interface AuthState {
  user: User | null;
  isLoading: boolean;
  error: string | null;
}

interface AuthContextData extends AuthState {
  login: (cpf: string, password: string) => Promise<void>;
  register: (userData: Omit<User, "id">) => Promise<void>;
  logout: () => Promise<void>;
}

// Create the context
const AuthContext = createContext<AuthContextData>({} as AuthContextData);

// Storage key for user data
const USER_STORAGE_KEY = "VotaAi_user";

// Auth Provider component
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    isLoading: true,
    error: null,
  });

  // Load user from storage on mount
  useEffect(() => {
    async function loadStoredUser() {
      try {
        const storedUser = await SecureStore.getItemAsync(USER_STORAGE_KEY);

        if (storedUser) {
          setState({
            user: JSON.parse(storedUser),
            isLoading: false,
            error: null,
          });
        } else {
          setState({
            user: null,
            isLoading: false,
            error: null,
          });
        }
      } catch (error) {
        console.error("Error loading stored user:", error);
        setState({
          user: null,
          isLoading: false,
          error: "Failed to load user data",
        });
      }
    }

    loadStoredUser();
  }, []);

  // Login function
  const login = async (cpf: string, password: string) => {
    try {
      setState({ ...state, isLoading: true, error: null });

      const user = await authService.login(cpf, password);

      if (user) {
        // Store user in secure storage
        await SecureStore.setItemAsync(USER_STORAGE_KEY, JSON.stringify(user));

        setState({
          user,
          isLoading: false,
          error: null,
        });
      } else {
        setState({
          user: null,
          isLoading: false,
          error: "Credenciais inválidas",
        });
      }
    } catch (error) {
      console.error("Login error:", error);
      setState({
        user: null,
        isLoading: false,
        error: "Falha ao fazer login. Tente novamente.",
      });
    }
  };

  // Register function
  const register = async (userData: Omit<User, "id">) => {
    try {
      setState({ ...state, isLoading: true, error: null });

      const newUser = await authService.register(userData);

      // Store user in secure storage
      await SecureStore.setItemAsync(USER_STORAGE_KEY, JSON.stringify(newUser));

      setState({
        user: newUser,
        isLoading: false,
        error: null,
      });
    } catch (error) {
      console.error("Registration error:", error);
      setState({
        user: null,
        isLoading: false,
        error: "Falha ao registrar. Tente novamente.",
      });
    }
  };

  // Logout function
  const logout = async () => {
    try {
      await SecureStore.deleteItemAsync(USER_STORAGE_KEY);

      setState({
        user: null,
        isLoading: false,
        error: null,
      });
    } catch (error) {
      console.error("Logout error:", error);
      setState({
        ...state,
        error: "Falha ao sair. Tente novamente.",
      });
    }
  };

  return (
    <AuthContext.Provider
      value={{
        ...state,
        login,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// Hook to use the auth context
export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }

  return context;
}
