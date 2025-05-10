import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { ThemedText } from "../../components/ThemedText";
import { ThemedView } from "../../components/ThemedView";
import { Colors } from "../../constants/Colors";
import { useAuth } from "../../context/AuthContext";

export default function LoginScreen() {
  const { login, isLoading, error: authError } = useAuth();
  const [cpf, setCpf] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const formatCPF = (text: string) => {
    // Remove non-numeric characters
    const cleaned = text.replace(/\D/g, "");

    // Limit to 11 digits (CPF length)
    const digits = cleaned.slice(0, 11);

    // Apply CPF format (XXX.XXX.XXX-XX)
    let formatted = digits;

    if (digits.length > 0) {
      formatted = digits.replace(
        /(\d{3})(\d{0,3})(\d{0,3})(\d{0,2})/,
        (_, g1, g2, g3, g4) => {
          let result = g1;
          if (g2) result += `.${g2}`;
          if (g3) result += `.${g3}`;
          if (g4) result += `-${g4}`;
          return result;
        }
      );
    }

    return formatted;
  };

  const handleLogin = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // Clear previous errors
    setError("");

    // Basic validation
    const cleanedCpf = cpf.replace(/\D/g, "");
    if (cleanedCpf.length !== 11) {
      setError("CPF inválido - deve conter 11 dígitos");
      return;
    }

    if (password.length < 8) {
      // Changed from 6 to 8 to match registration requirements
      setError("Senha deve ter pelo menos 8 caracteres");
      return;
    }

    try {
      console.log("Attempting login with cleaned CPF");
      // Call the login function from AuthContext with cleaned CPF
      await login(cleanedCpf, password);

      // The AuthContext will handle the redirect after successful login
    } catch (err) {
      console.error("Login error:", err);

      // More descriptive error messages based on the error
      let errorMessage = "Falha ao fazer login. Tente novamente.";

      if (err instanceof Error) {
        if (err.message.includes("Invalid credentials")) {
          errorMessage =
            "CPF ou senha incorretos. Verifique e tente novamente.";
        } else if (err.message.includes("Network")) {
          errorMessage =
            "Erro de conexão. Verifique sua internet e tente novamente.";
        } else if (err.message.includes("timeout")) {
          errorMessage =
            "Tempo de conexão esgotado. Tente novamente mais tarde.";
        } else if (err.message.includes("token")) {
          errorMessage = "Erro de autenticação. Por favor, tente novamente.";
        }
      }

      // Display error message
      setError(errorMessage);

      // Vibrate to indicate error
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);

      // Optionally clear the password for security
      setPassword("");
    }
  };

  // Set error from auth context if available
  React.useEffect(() => {
    if (authError) {
      setError(authError);
      // Clear password field on auth error for security
      setPassword("");
      // Provide haptic feedback
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }, [authError]);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
    >
      <StatusBar style="light" />
      <View style={styles.logoContainer}>
        <Image
          source={require("../../assets/images/logo.png")}
          style={styles.logo}
          contentFit="contain"
        />
        <ThemedText style={styles.appName}>VotaAí</ThemedText>
        <ThemedText style={styles.tagline}>
          Sua voz na cidade inteligente
        </ThemedText>
      </View>

      <ThemedView style={styles.formContainer}>
        <ThemedText style={styles.label}>CPF</ThemedText>
        <TextInput
          style={styles.input}
          placeholder="000.000.000-00"
          placeholderTextColor="#8E8E93"
          keyboardType="numeric"
          value={cpf}
          onChangeText={(text) => {
            setCpf(formatCPF(text));
            setError("");
          }}
        />

        <ThemedText style={styles.label}>Senha</ThemedText>
        <TextInput
          style={styles.input}
          placeholder="******"
          placeholderTextColor="#8E8E93"
          secureTextEntry
          value={password}
          onChangeText={(text) => {
            setPassword(text);
            setError("");
          }}
        />

        {error ? (
          <View style={styles.errorContainer}>
            <ThemedText style={styles.errorText}>{error}</ThemedText>
            {error.includes("conexão") && (
              <TouchableOpacity
                style={styles.retryButton}
                onPress={handleLogin}
              >
                <ThemedText style={styles.retryText}>
                  Tentar Novamente
                </ThemedText>
              </TouchableOpacity>
            )}
          </View>
        ) : null}

        <TouchableOpacity
          style={[
            styles.loginButton,
            error ? styles.loginButtonWithError : null,
          ]}
          onPress={handleLogin}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <ThemedText style={styles.loginButtonText}>Entrar</ThemedText>
          )}
        </TouchableOpacity>

        <View style={styles.forgotPasswordContainer}>
          <TouchableOpacity
            onPress={() => {
              // For now just show an alert - you can implement password recovery later
              Alert.alert(
                "Recuperação de Senha",
                "Entre em contato com o administrador para redefinir sua senha.",
                [{ text: "OK", onPress: () => console.log("OK Pressed") }]
              );
            }}
          >
            <ThemedText style={styles.forgotPasswordText}>
              Esqueceu sua senha?
            </ThemedText>
          </TouchableOpacity>
        </View>

        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <ThemedText style={styles.dividerText}>ou</ThemedText>
          <View style={styles.dividerLine} />
        </View>

        <TouchableOpacity
          style={styles.registerButton}
          onPress={() => router.push("/(auth)/register")}
        >
          <ThemedText style={styles.registerButtonText}>
            Criar Nova Conta
          </ThemedText>
        </TouchableOpacity>
      </ThemedView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  logoContainer: {
    alignItems: "center",
    marginTop: 60,
    marginBottom: 40,
  },
  logo: {
    width: 120,
    height: 120,
    marginBottom: 16,
  },
  appName: {
    fontSize: 32,
    fontWeight: "bold",
    marginBottom: 8,
    color: Colors.light.tint,
  },
  tagline: {
    fontSize: 16,
    color: "#A0A0A0",
  },
  formContainer: {
    paddingHorizontal: 24,
  },
  label: {
    fontSize: 16,
    marginBottom: 8,
    fontWeight: "500",
  },
  input: {
    backgroundColor: "#1C1C1E",
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    fontSize: 16,
    color: "#FFFFFF",
  },
  errorText: {
    color: "#FF453A",
    marginBottom: 16,
  },
  errorContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: Colors.light.tint,
    borderRadius: 12,
    padding: 16,
    marginLeft: 16,
  },
  retryText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  loginButton: {
    backgroundColor: Colors.light.tint,
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    marginTop: 16,
  },
  loginButtonWithError: {
    backgroundColor: "#FF453A",
  },
  loginButtonText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "600",
  },
  forgotPasswordContainer: {
    marginTop: 24,
    alignItems: "center",
  },
  forgotPasswordText: {
    color: Colors.light.tint,
    fontSize: 16,
  },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 24,
    marginBottom: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#8E8E93",
  },
  dividerText: {
    color: "#8E8E93",
    fontSize: 16,
    marginHorizontal: 16,
  },
  registerButton: {
    backgroundColor: "#2C2C2E", // Darker background for contrast
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.light.tint,
  },
  registerButtonText: {
    color: Colors.light.tint,
    fontSize: 18,
    fontWeight: "600",
  },
  registerLink: {
    marginTop: 16,
    alignItems: "center",
  },
  registerText: {
    color: "#8E8E93",
    fontSize: 14,
  },
});
