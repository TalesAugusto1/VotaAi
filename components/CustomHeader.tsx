import React from "react";
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Platform,
  useColorScheme,
} from "react-native";
import { ThemedText } from "./ThemedText";
import { Ionicons, FontAwesome5 } from "@expo/vector-icons";
import { Colors } from "../constants/Colors";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface CustomHeaderProps {
  title: string;
  showBack?: boolean;
  rightAction?: "search" | "filter" | "help" | "notification" | "none";
  onRightActionPress?: () => void;
  subtitle?: string;
  transparent?: boolean;
}

export function CustomHeader({
  title,
  showBack = false,
  rightAction = "none",
  onRightActionPress,
  subtitle,
  transparent = false,
}: CustomHeaderProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const insets = useSafeAreaInsets();

  const backgroundColor = transparent
    ? "transparent"
    : isDark
    ? Colors.dark.background
    : Colors.light.background;

  const textColor = transparent
    ? "white"
    : isDark
    ? Colors.dark.text
    : Colors.light.text;

  const getRightIcon = () => {
    switch (rightAction) {
      case "search":
        return "search";
      case "filter":
        return "filter";
      case "help":
        return "help-circle";
      case "notification":
        return "notifications";
      default:
        return null;
    }
  };

  return (
    <View
      style={[
        styles.header,
        {
          backgroundColor,
          paddingTop: insets.top + 10,
          height: insets.top + 60,
          borderBottomColor: transparent
            ? "transparent"
            : isDark
            ? "#2C2C2E"
            : "#F2F2F7",
        },
      ]}
    >
      <View style={styles.leftContainer}>
        {showBack && (
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="arrow-back" size={24} color={textColor} />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.centerContainer}>
        <ThemedText
          style={[styles.title, { color: textColor }]}
          numberOfLines={1}
        >
          {title}
        </ThemedText>
        {subtitle && (
          <ThemedText style={[styles.subtitle, { color: textColor + "99" }]}>
            {subtitle}
          </ThemedText>
        )}
      </View>

      <View style={styles.rightContainer}>
        {rightAction !== "none" && getRightIcon() && (
          <TouchableOpacity
            style={styles.actionButton}
            onPress={onRightActionPress}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons
              name={getRightIcon() as any}
              size={24}
              color={textColor}
            />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    borderBottomWidth: 0.5,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
  },
  leftContainer: {
    width: 40,
    alignItems: "flex-start",
  },
  centerContainer: {
    flex: 1,
    alignItems: "center",
  },
  rightContainer: {
    width: 40,
    alignItems: "flex-end",
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
  },
  subtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  backButton: {
    padding: 4,
  },
  actionButton: {
    padding: 4,
  },
});
