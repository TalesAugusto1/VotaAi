import { FontAwesome5 } from "@expo/vector-icons";
import { Image } from "expo-image";
import React from "react";
import {
  StyleSheet,
  TouchableOpacity,
  View,
  useColorScheme,
} from "react-native";
import { Colors } from "../constants/Colors";
import { VotingOption } from "../types";
import { calculatePercentage } from "../utils/helpers";
import { ThemedText } from "./ThemedText";

interface VotingOptionCardProps {
  option: VotingOption;
  isSelected: boolean;
  isVoted: boolean;
  totalVotes: number;
  onSelect: () => void;
  showResults: boolean;
}

export function VotingOptionCard({
  option,
  isSelected,
  isVoted,
  totalVotes,
  onSelect,
  showResults,
}: VotingOptionCardProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";

  const percentage = calculatePercentage(option.voteCount, totalVotes);

  return (
    <TouchableOpacity
      style={[
        styles.container,
        {
          backgroundColor: isDark ? "#1C1C1E" : "#FFFFFF",
          borderColor: isSelected ? Colors.light.tint : "transparent",
        },
      ]}
      onPress={onSelect}
      disabled={isVoted || showResults}
      activeOpacity={0.7}
    >
      {option.imageUrl ? (
        <Image
          source={{ uri: option.imageUrl }}
          style={styles.image}
          contentFit="cover"
          transition={300}
        />
      ) : (
        <View
          style={[
            styles.placeholderImage,
            { backgroundColor: isDark ? "#2C2C2E" : "#F2F2F7" },
          ]}
        >
          <FontAwesome5
            name="poll-h"
            size={30}
            color={isDark ? "#4A4A4A" : "#C7C7CC"}
          />
        </View>
      )}

      <View style={styles.content}>
        <ThemedText style={styles.title}>{option.text}</ThemedText>

        {option.description && (
          <ThemedText style={styles.description}>
            {option.description}
          </ThemedText>
        )}

        {(showResults || isVoted) && (
          <View style={styles.resultsContainer}>
            <View style={styles.progressBarContainer}>
              <View
                style={[
                  styles.progressBar,
                  {
                    width: `${percentage}%`,
                    backgroundColor: Colors.light.tint,
                  },
                ]}
              />
            </View>

            <View style={styles.voteInfo}>
              <ThemedText style={styles.voteCount}>
                {option.voteCount} votos
              </ThemedText>
              <ThemedText style={styles.votePercentage}>
                {percentage}%
              </ThemedText>
            </View>
          </View>
        )}

        {isSelected && !isVoted && !showResults && (
          <View style={styles.selectedBadge}>
            <ThemedText style={styles.selectedText}>Selecionado</ThemedText>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    marginBottom: 16,
    overflow: "hidden",
    borderWidth: 2,
    elevation: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  image: {
    height: 150,
    width: "100%",
  },
  placeholderImage: {
    height: 100,
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    padding: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    marginBottom: 16,
    opacity: 0.8,
  },
  resultsContainer: {
    marginTop: 12,
  },
  progressBarContainer: {
    height: 12,
    backgroundColor: "#E0E0E0",
    borderRadius: 6,
    overflow: "hidden",
    marginBottom: 8,
  },
  progressBar: {
    height: "100%",
    borderRadius: 6,
  },
  voteInfo: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  voteCount: {
    fontSize: 12,
    opacity: 0.7,
  },
  votePercentage: {
    fontSize: 12,
    fontWeight: "600",
  },
  selectedBadge: {
    backgroundColor: Colors.light.tint + "20",
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 12,
  },
  selectedText: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.light.tint,
  },
});
