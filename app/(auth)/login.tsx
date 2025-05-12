import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useState, useEffect, useRef } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
  Animated,
} from "react-native";
import { ThemedText } from "../../components/ThemedText";
import { ThemedView } from "../../components/ThemedView";
import { CustomModal } from "../../components/CustomModal";
import { Colors } from "../../constants/Colors";
import { useAuth } from "../../context/AuthContext";
import { Ionicons } from "@expo/vector-icons";

export default function LoginScreen() {
  const { login, isLoading, error: authError } = useAuth();
  const [cpf, setCpf] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [cpfValid, setCpfValid] = useState<boolean | null>(null);
  const [passwordValid, setPasswordValid] = useState<boolean | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  // Animation values
  const [shakeAnimation] = useState(new Animated.Value(0));
  const [buttonScale] = useState(new Animated.Value(1));

  // Modal state
  const [modalVisible, setModalVisible] = useState(false);
  const [modalMessage, setModalMessage] = useState("");
  const [modalTitle, setModalTitle] = useState("");

  // Keep track if a login was attempted
  const [loginAttempted, setLoginAttempted] = useState(false);
  const loginFailedRef = useRef(false);

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

  const validateCPF = (text: string) => {
    const cleaned = text.replace(/\D/g, "");
    setCpfValid(
      cleaned.length === 11 ? true : cleaned.length === 0 ? null : false
    );
  };

  const validatePassword = (text: string) => {
    setPasswordValid(
      text.length >= 8 ? true : text.length === 0 ? null : false
    );
  };

  // Shake animation
  const startShakeAnimation = () => {
    Animated.sequence([
      Animated.timing(shakeAnimation, {
        toValue: 10,
        duration: 50,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnimation, {
        toValue: -10,
        duration: 50,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnimation, {
        toValue: 10,
        duration: 50,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnimation, {
        toValue: 0,
        duration: 50,
        useNativeDriver: true,
      }),
    ]).start();
  };

  // Button press animation
  const animateButtonPress = () => {
    Animated.sequence([
      Animated.timing(buttonScale, {
        toValue: 0.95,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(buttonScale, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();
  };

  // Universal error display function that ensures modal is shown
  const displayError = (title: string, message: string) => {
    setModalTitle(title);
    setModalMessage(message);
    setModalVisible(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    startShakeAnimation();
    loginFailedRef.current = true;
  };

  const handleButtonPress = () => {
    animateButtonPress();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    loginAttempt();
  };

  const loginAttempt = async () => {
    // Clear previous errors
    setError("");
    loginFailedRef.current = false;
    setLoginAttempted(true);

    // Basic validation
    const cleanedCpf = cpf.replace(/\D/g, "");
    if (cleanedCpf.length !== 11) {
      displayError("CPF Inválido", "CPF deve conter 11 dígitos.");
      setCpfValid(false);
      return;
    }

    if (password.length < 8) {
      displayError("Senha Inválida", "Senha deve ter pelo menos 8 caracteres.");
      setPasswordValid(false);
      return;
    }

    try {
      // Call the login function from AuthContext
      await login(cleanedCpf, password);

      // If we get here without an error, login was successful
      // The AuthContext will handle the redirect
    } catch (err) {
      // Format error message
      let errorTitle = "Erro de Login";
      let errorMessage = "Falha ao fazer login. Tente novamente.";

      if (err instanceof Error) {
        if (err.message.includes("Invalid credentials")) {
          errorTitle = "Credenciais Inválidas";
          errorMessage =
            "CPF ou senha incorretos. Verifique e tente novamente.";
        } else if (err.message.includes("Network")) {
          errorTitle = "Erro de Conexão";
          errorMessage =
            "Erro de conexão. Verifique sua internet e tente novamente.";
        } else if (err.message.includes("timeout")) {
          errorTitle = "Tempo Esgotado";
          errorMessage =
            "Tempo de conexão esgotado. Tente novamente mais tarde.";
        } else if (err.message.includes("token")) {
          errorTitle = "Erro de Autenticação";
          errorMessage = "Erro de autenticação. Por favor, tente novamente.";
        }
      }

      // Force display the error
      displayError(errorTitle, errorMessage);
      setPassword("");
    }
  };

  // Check for auth errors from context
  useEffect(() => {
    if (authError && loginAttempted) {
      let errorTitle = "Erro de Login";
      let errorMessage = authError;

      // Parse common auth errors for better titles
      if (
        authError.includes("Invalid credentials") ||
        authError.includes("CPF ou senha incorretos")
      ) {
        errorTitle = "Credenciais Inválidas";
        errorMessage = "CPF ou senha incorretos. Verifique e tente novamente.";
      } else if (authError.includes("conexão")) {
        errorTitle = "Erro de Conexão";
        errorMessage =
          "Erro de conexão. Verifique sua internet e tente novamente.";
      } else if (authError.includes("tempo")) {
        errorTitle = "Tempo Esgotado";
        errorMessage = "Tempo de conexão esgotado. Tente novamente mais tarde.";
      }

      // Ensure modal appears
      displayError(errorTitle, errorMessage);
      setPassword("");
    }
  }, [authError, loginAttempted]);

  // Backup error checker - ensure any login failure shows a modal
  useEffect(() => {
    // This runs when isLoading changes from true to false
    if (!isLoading && loginAttempted && loginFailedRef.current) {
      // If we had a login attempt, are not loading, and login failed
      if (!modalVisible) {
        // If modal is not already visible, show a generic error
        displayError(
          "Erro de Login",
          "Falha ao fazer login. Por favor, verifique seus dados e tente novamente."
        );
      }
    }
  }, [isLoading, loginAttempted, modalVisible]);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
    >
      <StatusBar style="light" />
      <Animated.View
        style={[
          styles.logoContainer,
          { transform: [{ translateX: shakeAnimation }] },
        ]}
      >
        <Image
          source={require("../../assets/images/logo.png")}
          style={styles.logo}
          contentFit="contain"
        />
        <ThemedText style={styles.appName}>VotaAí</ThemedText>
        <ThemedText style={styles.tagline}>
          Sua voz na cidade inteligente
        </ThemedText>
      </Animated.View>

      <ThemedView style={styles.formContainer}>
        <View style={styles.inputContainer}>
          <ThemedText style={styles.label}>CPF</ThemedText>
          <View
            style={[
              styles.inputWrapper,
              cpfValid === false && styles.inputError,
              cpfValid === true && styles.inputSuccess,
            ]}
          >
            <TextInput
              style={styles.input}
              placeholder="000.000.000-00"
              placeholderTextColor="#8E8E93"
              keyboardType="numeric"
              value={cpf}
              onChangeText={(text) => {
                const formatted = formatCPF(text);
                setCpf(formatted);
                validateCPF(formatted);
                setError("");
              }}
            />
            {cpfValid !== null && (
              <View style={styles.validationIcon}>
                <Ionicons
                  name={cpfValid ? "checkmark-circle" : "close-circle"}
                  size={24}
                  color={cpfValid ? "#4CAF50" : "#FF453A"}
                />
              </View>
            )}
          </View>
          {cpfValid === false && (
            <ThemedText style={styles.inputHelperText}>
              CPF deve conter 11 dígitos
            </ThemedText>
          )}
        </View>

        <View style={styles.inputContainer}>
          <ThemedText style={styles.label}>Senha</ThemedText>
          <View
            style={[
              styles.inputWrapper,
              passwordValid === false && styles.inputError,
              passwordValid === true && styles.inputSuccess,
            ]}
          >
            <TextInput
              style={styles.input}
              placeholder="••••••••"
              placeholderTextColor="#8E8E93"
              secureTextEntry={!showPassword}
              value={password}
              onChangeText={(text) => {
                setPassword(text);
                validatePassword(text);
                setError("");
              }}
            />
            <TouchableOpacity
              style={styles.validationIcon}
              onPress={() => setShowPassword(!showPassword)}
            >
              <Ionicons
                name={showPassword ? "eye-off" : "eye"}
                size={24}
                color="#8E8E93"
              />
            </TouchableOpacity>
          </View>
          {passwordValid === false && (
            <ThemedText style={styles.inputHelperText}>
              Senha deve ter pelo menos 8 caracteres
            </ThemedText>
          )}
        </View>

        {error ? (
          <View style={styles.errorContainer}>
            <ThemedText style={styles.errorText}>{error}</ThemedText>
            {error.includes("conexão") && (
              <TouchableOpacity
                style={styles.retryButton}
                onPress={loginAttempt}
              >
                <ThemedText style={styles.retryText}>
                  Tentar Novamente
                </ThemedText>
              </TouchableOpacity>
            )}
          </View>
        ) : null}

        <Animated.View
          style={{
            transform: [{ scale: buttonScale }],
            width: "100%",
          }}
        >
          <TouchableOpacity
            style={[
              styles.loginButton,
              (cpfValid === false || passwordValid === false) &&
                styles.loginButtonDisabled,
              error ? styles.loginButtonWithError : null,
            ]}
            onPress={handleButtonPress}
            disabled={
              isLoading || cpfValid === false || passwordValid === false
            }
          >
            {isLoading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <ThemedText style={styles.loginButtonText}>Entrar</ThemedText>
            )}
          </TouchableOpacity>
        </Animated.View>

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

      {/* Error Modal */}
      <CustomModal
        visible={modalVisible}
        title={modalTitle}
        message={modalMessage}
        type="error"
        onClose={() => {
          setModalVisible(false);
          loginFailedRef.current = false;
        }}
        actions={[
          {
            text: "OK",
            onPress: () => {
              setModalVisible(false);
              loginFailedRef.current = false;
            },
            style: "default",
          },
        ]}
      />
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
    marginBottom: 30,
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
  inputContainer: {
    marginBottom: 16,
  },
  label: {
    fontSize: 16,
    marginBottom: 8,
    fontWeight: "500",
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1C1C1E",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "transparent",
  },
  input: {
    flex: 1,
    padding: 16,
    fontSize: 16,
    color: "#FFFFFF",
  },
  inputError: {
    borderColor: "#FF453A",
  },
  inputSuccess: {
    borderColor: "#4CAF50",
  },
  validationIcon: {
    paddingRight: 16,
  },
  inputHelperText: {
    fontSize: 14,
    color: "#FF453A",
    marginTop: 4,
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
    marginTop: 8,
  },
  loginButtonDisabled: {
    backgroundColor: "#555555",
    opacity: 0.7,
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
