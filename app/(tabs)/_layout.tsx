import { FontAwesome5, Ionicons, MaterialIcons } from "@expo/vector-icons";
import { Tabs, router } from "expo-router";
import React, { useEffect } from "react";
import { Platform, useColorScheme } from "react-native";
import { Colors } from "../../constants/Colors";
import { useAuth } from "../../context/AuthContext";

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const { user, isLoading } = useAuth();

  // Check if user is logged in
  useEffect(() => {
    if (!isLoading && !user) {
      // Redirect to auth flow if not logged in
      router.replace("/(auth)/login");
    }
  }, [user, isLoading]);

  // Don't render tabs if user is not logged in
  if (!user) {
    return null;
  }

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor:
          Colors[colorScheme === "dark" ? "dark" : "light"].tint,
        tabBarStyle: {
          height: Platform.OS === "ios" ? 85 : 60,
          paddingBottom: Platform.OS === "ios" ? 30 : 10,
        },
        headerStyle: {
          backgroundColor:
            Colors[colorScheme === "dark" ? "dark" : "light"].background,
        },
        headerTintColor: Colors[colorScheme === "dark" ? "dark" : "light"].text,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Votações Abertas",
          tabBarIcon: ({ color }) => (
            <FontAwesome5 name="vote-yea" size={24} color={color} />
          ),
          tabBarLabel: "Votações",
        }}
      />

      <Tabs.Screen
        name="calendar-pools"
        options={{
          title: "Calendário",
          tabBarIcon: ({ color }) => (
            <MaterialIcons name="event" size={24} color={color} />
          ),
          tabBarLabel: "Calendário",
        }}
      />

      <Tabs.Screen
        name="results"
        options={{
          title: "Resultados",
          tabBarIcon: ({ color }) => (
            <Ionicons name="stats-chart" size={24} color={color} />
          ),
          tabBarLabel: "Resultados",
        }}
      />

      <Tabs.Screen
        name="profile"
        options={{
          title: "Meu Perfil",
          tabBarIcon: ({ color }) => (
            <Ionicons name="person" size={24} color={color} />
          ),
          tabBarLabel: "Perfil",
        }}
      />
    </Tabs>
  );
}
