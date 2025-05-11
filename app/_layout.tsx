import { DarkTheme, ThemeProvider } from "@react-navigation/native";
import { useFonts } from "expo-font";
import { Stack, router, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import React, { useEffect } from "react";
import "react-native-reanimated";
import { AuthProvider, useAuth } from "../context/AuthContext";
import { NetworkProvider } from "../context/NetworkContext";
import { OfflineBanner } from "../components/OfflineBanner";
import { PendingVotesIndicator } from "../components/PendingVotesIndicator";

// Prevent the splash screen from auto-hiding
SplashScreen.preventAutoHideAsync();

// This function wraps the app content and handles auth redirection
function RootLayoutContent() {
  const { user, isLoading } = useAuth();
  const segments = useSegments();

  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === "(auth)";

    if (!user && !inAuthGroup) {
      // Redirect to the login page if user is not logged in and not already in auth group
      router.replace("/(auth)/login");
    } else if (user && inAuthGroup) {
      // Redirect to the home page if user is logged in and still in auth group
      router.replace("/(tabs)");
    }
  }, [user, segments, isLoading]);

  if (isLoading) {
    return null; // Still loading, show nothing
  }

  return (
    <ThemeProvider value={DarkTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="pool/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="create-pool" options={{ headerShown: false }} />
        <Stack.Screen name="+not-found" />
      </Stack>
      <StatusBar style="auto" />
      <OfflineBanner />
      <PendingVotesIndicator />
    </ThemeProvider>
  );
}

export default function RootLayout() {
  const [fontsLoaded, error] = useFonts({
    SpaceMono: require("../assets/fonts/SpaceMono-Regular.ttf"),
  });

  // When fonts are loaded, hide the splash screen
  useEffect(() => {
    if (fontsLoaded || error) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, error]);

  // Return null until fonts are loaded
  if (!fontsLoaded && !error) {
    return null;
  }

  return (
    <NetworkProvider>
      <AuthProvider>
        <RootLayoutContent />
      </AuthProvider>
    </NetworkProvider>
  );
}
