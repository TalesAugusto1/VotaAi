import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { ThemedText } from "../../components/ThemedText";
import { ThemedView } from "../../components/ThemedView";
import { Colors } from "../../constants/Colors";
import { useAuth } from "../../context/AuthContext";

export default function RegisterScreen() {
  const { register, isLoading, error: authError } = useAuth();
  const [name, setName] = useState("");
  const [cpf, setCpf] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
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

  // Set error from auth context if available
  React.useEffect(() => {
    if (authError) {
      setError(authError);
    }
  }, [authError]);

  const handleRegister = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    console.log("Starting registration process");

    // Clear previous errors
    setError("");

    // Validate name - minimum 3 characters
    if (!name.trim() || name.length < 3) {
      setError("Nome deve ter pelo menos 3 caracteres");
      console.log("Validation failed: Name must be at least 3 characters");
      return;
    }

    // CPF validation - must be exactly 11 digits without any special characters
    const cleanedCpf = cpf.replace(/\D/g, "");
    if (cleanedCpf.length !== 11) {
      setError("CPF inválido - deve conter exatamente 11 dígitos");
      console.log("Validation failed: CPF must be exactly 11 digits");
      return;
    }

    // Email validation - must be valid format
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setError("Formato de email inválido");
      console.log("Validation failed: Invalid email format");
      return;
    }

    // Password validation - minimum 8 characters
    if (password.length < 8) {
      setError("Senha deve ter pelo menos 8 caracteres");
      console.log("Validation failed: Password must be at least 8 characters");
      return;
    }

    // Password matching
    if (password !== confirmPassword) {
      setError("As senhas não coincidem");
      console.log("Validation failed: Passwords don't match");
      return;
    }

    console.log("All client-side validation passed");

    try {
      // Register user with API
      console.log("Submitting registration to API");
      await register({
        name,
        cpf: cleanedCpf, // Send cleaned CPF
        email,
        password,
      });

      console.log("Registration API call completed");
      // The AuthContext will handle the redirect after successful registration
    } catch (error) {
      console.error("Registration error in component:", error);
      // Error will be handled by the auth context
    }
  };

  const handleRetry = () => {
    // Clear error and try again
    setError("");
    handleRegister();
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <StatusBar style="light" />
        <View style={styles.headerContainer}>
          <Image
            source={require("../../assets/images/logo.png")}
            style={styles.logo}
            contentFit="contain"
          />
          <ThemedText style={styles.title}>Criar Conta</ThemedText>
        </View>

        <ThemedView style={styles.formContainer}>
          <ThemedText style={styles.label}>Nome Completo</ThemedText>
          <TextInput
            style={styles.input}
            placeholder="Seu nome completo"
            placeholderTextColor="#8E8E93"
            value={name}
            onChangeText={(text) => {
              setName(text);
              setError("");
            }}
          />

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

          <ThemedText style={styles.label}>Email</ThemedText>
          <TextInput
            style={styles.input}
            placeholder="seu@email.com"
            placeholderTextColor="#8E8E93"
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={(text) => {
              setEmail(text);
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

          <ThemedText style={styles.label}>Confirmar Senha</ThemedText>
          <TextInput
            style={styles.input}
            placeholder="******"
            placeholderTextColor="#8E8E93"
            secureTextEntry
            value={confirmPassword}
            onChangeText={(text) => {
              setConfirmPassword(text);
              setError("");
            }}
          />

          {error ? (
            <View style={styles.errorContainer}>
              <ThemedText style={styles.errorText}>{error}</ThemedText>
              {error.includes("conexão") && (
                <TouchableOpacity
                  style={styles.retryButton}
                  onPress={handleRetry}
                >
                  <ThemedText style={styles.retryText}>
                    Tentar Novamente
                  </ThemedText>
                </TouchableOpacity>
              )}
            </View>
          ) : null}

          <TouchableOpacity
            style={styles.registerButton}
            onPress={handleRegister}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <ThemedText style={styles.registerButtonText}>
                Cadastrar
              </ThemedText>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.loginLink}
            onPress={() => router.push("/(auth)/login")}
          >
            <ThemedText style={styles.loginText}>
              Já tem uma conta? Faça login
            </ThemedText>
          </TouchableOpacity>
        </ThemedView>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 30,
  },
  headerContainer: {
    alignItems: "center",
    marginTop: 40,
    marginBottom: 20,
  },
  logo: {
    width: 80,
    height: 80,
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    marginBottom: 8,
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
    marginBottom: 16,
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
  registerButton: {
    backgroundColor: Colors.light.tint,
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    marginTop: 16,
  },
  registerButtonText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "600",
  },
  loginLink: {
    marginTop: 24,
    alignItems: "center",
  },
  loginText: {
    color: Colors.light.tint,
    fontSize: 16,
  },
});
