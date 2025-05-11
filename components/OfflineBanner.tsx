import React from "react";
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  Animated,
  Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNetwork } from "../context/NetworkContext";
import { useColorScheme } from "react-native";
import { Colors } from "../constants/Colors";

export const OfflineBanner: React.FC = () => {
  const { showOfflineBanner, hideOfflineBanner } = useNetwork();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";

  // Animation value for the banner
  const [slideAnimation] = React.useState(new Animated.Value(-60));

  React.useEffect(() => {
    if (showOfflineBanner) {
      // Slide in
      Animated.timing(slideAnimation, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else {
      // Slide out
      Animated.timing(slideAnimation, {
        toValue: -60,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [showOfflineBanner, slideAnimation]);

  if (!showOfflineBanner) return null;

  return (
    <Animated.View
      style={[
        styles.container,
        {
          backgroundColor: isDark ? "#222" : "#F44336",
          transform: [{ translateY: slideAnimation }],
        },
      ]}
    >
      <View style={styles.content}>
        <Ionicons name="cloud-offline" size={20} color="#FFF" />
        <Text style={styles.text}>Você está offline</Text>
      </View>
      <TouchableOpacity style={styles.closeButton} onPress={hideOfflineBanner}>
        <Ionicons name="close" size={20} color="#FFF" />
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 60,
    paddingTop: 30, // Account for status bar
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    zIndex: 9999,
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
  },
  text: {
    color: "#FFF",
    marginLeft: 8,
    fontWeight: "600",
  },
  closeButton: {
    padding: 4,
  },
});
