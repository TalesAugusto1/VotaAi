import React, { createContext, useContext, useEffect, useState } from "react";
import { authApi } from "../services/apiClient";
import { User } from "../types";

interface AuthState {
  user: User | null;
  isLoading: boolean;
  error: string | null;
}

// Define a more appropriate registration data type
interface RegistrationData {
  name: string;
  cpf: string;
  email: string;
  password: string;
  avatarUrl?: string;
}

interface AuthContextData extends AuthState {
  login: (cpf: string, password: string) => Promise<void>;
  register: (userData: RegistrationData) => Promise<void>;
  logout: () => Promise<void>;
}

// Create the context
const AuthContext = createContext<AuthContextData>({} as AuthContextData);

// Auth Provider component
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    isLoading: true,
    error: null,
  });

  // Load user from API on mount
  useEffect(() => {
    async function loadUser() {
      try {
        const user = await authApi.getCurrentUser();

        setState({
          user,
          isLoading: false,
          error: null,
        });
      } catch (error) {
        console.error("Error loading user:", error);
        setState({
          user: null,
          isLoading: false,
          error: "Failed to load user data",
        });
      }
    }

    loadUser();
  }, []);

  // Login function
  const login = async (cpf: string, password: string) => {
    try {
      setState({ ...state, isLoading: true, error: null });

      const { user } = await authApi.login(cpf, password);

      setState({
        user,
        isLoading: false,
        error: null,
      });
    } catch (error) {
      console.error("Login error:", error);
      setState({
        user: null,
        isLoading: false,
        error:
          error instanceof Error
            ? error.message
            : "Falha ao fazer login. Tente novamente.",
      });
    }
  };

  // Register function
  const register = async (userData: RegistrationData) => {
    try {
      console.log("AuthContext: Starting registration process");
      setState({ ...state, isLoading: true, error: null });

      // Log sanitized data (for debugging)
      console.log("AuthContext: Registering with data:", {
        name: userData.name,
        cpfLength: userData.cpf.length,
        email: userData.email,
        passwordLength: userData.password.length,
      });

      const { user } = await authApi.register(userData);
      console.log(
        "AuthContext: Registration successful, user created:",
        user.id
      );

      setState({
        user,
        isLoading: false,
        error: null,
      });
    } catch (error) {
      console.error("AuthContext: Registration error:", error);

      // Check if error is a validation error with details
      let errorMessage = "Falha ao registrar. Tente novamente.";

      if (error instanceof Error) {
        errorMessage = error.message;

        // Handle common error cases
        if (
          errorMessage.includes("CPF already") ||
          errorMessage.includes("Email already")
        ) {
          errorMessage = errorMessage.includes("CPF")
            ? "CPF já cadastrado no sistema"
            : "Email já cadastrado no sistema";
        } else if (errorMessage.includes("Validation error")) {
          errorMessage = "Erro de validação. Verifique todos os campos.";

          // Log detailed debug info
          console.log("AuthContext: Data that failed validation:", {
            nameLength: userData.name.length,
            cpfLength: userData.cpf.length,
            cpfDigitsOnly: userData.cpf.match(/^\d+$/) ? "Yes" : "No",
            emailValid: /^\S+@\S+\.\S+$/.test(userData.email),
            passwordLength: userData.password.length,
          });
        }
      }

      console.log("AuthContext: Setting error state:", errorMessage);
      setState({
        user: null,
        isLoading: false,
        error: errorMessage,
      });
    }
  };

  // Logout function
  const logout = async () => {
    try {
      await authApi.logout();

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
