import React, { useEffect } from "react";
import {
  View,
  StyleSheet,
  useColorScheme,
  Animated,
  ActivityIndicator,
} from "react-native";
import { Colors } from "../constants/Colors";
import { FontAwesome5 } from "@expo/vector-icons";

interface PoolSkeletonProps {
  index?: number;
}

export function PoolSkeleton({ index = 0 }: PoolSkeletonProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const backgroundColor = isDark ? "#1C1C1E" : "#FFFFFF";
  const highlightColor = isDark ? "#2C2C2E" : "#F2F2F7";

  // Animation for the shimmer effect
  const shimmerAnimation = new Animated.Value(0);
  const pulseAnimation = new Animated.Value(0);

  // Stagger animation based on index
  const STAGGER_DELAY = 150; // 150ms between each item

  useEffect(() => {
    // Delay animation start based on index
    const startDelay = index * STAGGER_DELAY;

    const timer = setTimeout(() => {
      // Shimmer animation
      Animated.loop(
        Animated.sequence([
          Animated.timing(shimmerAnimation, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(shimmerAnimation, {
            toValue: 0,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      ).start();

      // Pulse animation for the icon
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnimation, {
            toValue: 1,
            duration: 1200,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnimation, {
            toValue: 0.6,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      ).start();
    }, startDelay);

    return () => clearTimeout(timer);
  }, []);

  // Shimmer effect
  const shimmerTranslate = shimmerAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [-300, 300],
  });

  // Scale effect for the loading icon
  const iconScale = pulseAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [0.8, 1.1],
  });

  return (
    <View style={[styles.container, { backgroundColor }]}>
      {/* Image placeholder with centered loading animation */}
      <View style={styles.image}>
        <Animated.View
          style={[
            styles.shimmer,
            {
              backgroundColor: highlightColor,
              transform: [{ translateX: shimmerTranslate }],
            },
          ]}
        />

        {/* Loading indicator in the center */}
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.light.tint} />
          {/* <Animated.View
            style={[
              styles.iconContainer,
              { transform: [{ scale: iconScale }] },
            ]}
          >
            <FontAwesome5
              name="vote-yea"
              size={36}
              color={isDark ? "rgba(255,255,255,0.3)" : "rgba(0,0,0,0.2)"}
            />
          </Animated.View> */}
        </View>
      </View>

      {/* Content placeholders */}
      <View style={styles.contentContainer}>
        <View style={styles.header}>
          <View style={[styles.category, { backgroundColor: highlightColor }]}>
            <Animated.View
              style={[
                styles.shimmer,
                {
                  backgroundColor: highlightColor,
                  transform: [{ translateX: shimmerTranslate }],
                },
              ]}
            />
          </View>
          <View style={[styles.status, { backgroundColor: highlightColor }]}>
            <Animated.View
              style={[
                styles.shimmer,
                {
                  backgroundColor: highlightColor,
                  transform: [{ translateX: shimmerTranslate }],
                },
              ]}
            />
          </View>
        </View>

        <View style={[styles.title, { backgroundColor: highlightColor }]}>
          <Animated.View
            style={[
              styles.shimmer,
              {
                backgroundColor: highlightColor,
                transform: [{ translateX: shimmerTranslate }],
              },
            ]}
          />
        </View>

        <View style={[styles.description, { backgroundColor: highlightColor }]}>
          <Animated.View
            style={[
              styles.shimmer,
              {
                backgroundColor: highlightColor,
                transform: [{ translateX: shimmerTranslate }],
              },
            ]}
          />
        </View>

        <View style={styles.footer}>
          <View
            style={[styles.footerItem, { backgroundColor: highlightColor }]}
          >
            <Animated.View
              style={[
                styles.shimmer,
                {
                  backgroundColor: highlightColor,
                  transform: [{ translateX: shimmerTranslate }],
                },
              ]}
            />
          </View>
          <View
            style={[styles.footerItem, { backgroundColor: highlightColor }]}
          >
            <Animated.View
              style={[
                styles.shimmer,
                {
                  backgroundColor: highlightColor,
                  transform: [{ translateX: shimmerTranslate }],
                },
              ]}
            />
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    marginBottom: 16,
    overflow: "hidden",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  shimmer: {
    height: "100%",
    width: 50,
    position: "absolute",
    opacity: 0.5,
  },
  image: {
    height: 180,
    width: "100%",
    backgroundColor: "#2C2C2E",
    position: "relative",
    overflow: "hidden",
    justifyContent: "center",
    alignItems: "center",
  },
  loadingContainer: {
    position: "absolute",
    justifyContent: "center",
    alignItems: "center",
  },
  iconContainer: {
    marginTop: 16,
    opacity: 0.7,
  },
  contentContainer: {
    padding: 16,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  category: {
    width: 80,
    height: 20,
    borderRadius: 4,
    overflow: "hidden",
  },
  status: {
    width: 60,
    height: 20,
    borderRadius: 10,
    overflow: "hidden",
  },
  title: {
    height: 24,
    borderRadius: 4,
    marginBottom: 8,
    overflow: "hidden",
  },
  description: {
    height: 60,
    borderRadius: 4,
    marginBottom: 12,
    overflow: "hidden",
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
  },
  footerItem: {
    width: 80,
    height: 16,
    borderRadius: 4,
    marginRight: 12,
    overflow: "hidden",
  },
});
