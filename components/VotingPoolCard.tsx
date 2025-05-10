import { FontAwesome5, MaterialIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router } from "expo-router";
import React from "react";
import {
  StyleSheet,
  TouchableOpacity,
  View,
  useColorScheme,
} from "react-native";
import { Colors } from "../constants/Colors";
import { VotingPool } from "../types";
import { formatDate, truncateText } from "../utils/helpers";
import { ThemedText } from "./ThemedText";

interface VotingPoolCardProps {
  pool: VotingPool;
}

export function VotingPoolCard({ pool }: VotingPoolCardProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";

  // Calculate total votes
  const totalVotes = pool.options.reduce(
    (sum, option) => sum + option.voteCount,
    0
  );

  // Get status text and color
  const getStatusInfo = () => {
    switch (pool.status) {
      case "active":
        return {
          text: "Ativa",
          color: "#4CAF50",
          icon: "check-circle" as const,
        };
      case "upcoming":
        return {
          text: "Em breve",
          color: "#FFC107",
          icon: "schedule" as const,
        };
      case "closed":
        return {
          text: "Encerrada",
          color: "#F44336",
          icon: "cancel" as const,
        };
      default:
        return {
          text: "Desconhecido",
          color: "#9E9E9E",
          icon: "help" as const,
        };
    }
  };

  const status = getStatusInfo();

  const handlePress = () => {
    router.push({
      pathname: "/pool/[id]",
      params: { id: pool.id },
    });
  };

  return (
    <TouchableOpacity
      style={[
        styles.container,
        { backgroundColor: isDark ? "#1C1C1E" : "#FFFFFF" },
      ]}
      onPress={handlePress}
      activeOpacity={0.7}
    >
      {pool.imageUrl ? (
        <Image
          source={{ uri: pool.imageUrl }}
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
            name="vote-yea"
            size={40}
            color={isDark ? "#4A4A4A" : "#C7C7CC"}
          />
        </View>
      )}

      <View style={styles.contentContainer}>
        <View style={styles.header}>
          <ThemedText style={styles.category}>{pool.category}</ThemedText>
          <View style={styles.statusContainer}>
            <MaterialIcons name={status.icon} size={16} color={status.color} />
            <ThemedText style={[styles.status, { color: status.color }]}>
              {status.text}
            </ThemedText>
          </View>
        </View>

        <ThemedText style={styles.title}>
          {truncateText(pool.title, 60)}
        </ThemedText>

        <ThemedText style={styles.description}>
          {truncateText(pool.description, 100)}
        </ThemedText>

        <View style={styles.footer}>
          <View style={styles.dateContainer}>
            <MaterialIcons
              name="event"
              size={14}
              color={isDark ? "#AEAEB2" : "#8E8E93"}
            />
            <ThemedText style={styles.date}>
              {pool.status === "upcoming"
                ? `Inicia em ${formatDate(pool.startDate)}`
                : pool.status === "closed"
                ? `Encerrada em ${formatDate(pool.endDate)}`
                : `Termina em ${formatDate(pool.endDate)}`}
            </ThemedText>
          </View>

          {pool.anonymous && (
            <View style={styles.anonymousContainer}>
              <MaterialIcons
                name="visibility-off"
                size={14}
                color={isDark ? "#AEAEB2" : "#8E8E93"}
              />
              <ThemedText style={styles.anonymous}>Anônima</ThemedText>
            </View>
          )}

          <View style={styles.votesContainer}>
            <FontAwesome5
              name="vote-yea"
              size={14}
              color={isDark ? "#AEAEB2" : "#8E8E93"}
            />
            <ThemedText style={styles.votes}>{totalVotes} votos</ThemedText>
          </View>
        </View>
      </View>
    </TouchableOpacity>
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
  image: {
    height: 180,
    width: "100%",
  },
  placeholderImage: {
    height: 180,
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
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
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    color: Colors.light.tint,
  },
  statusContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  status: {
    fontSize: 12,
    fontWeight: "500",
    marginLeft: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    marginBottom: 12,
    opacity: 0.8,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
  },
  dateContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 12,
  },
  date: {
    fontSize: 12,
    marginLeft: 4,
    opacity: 0.7,
  },
  anonymousContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 12,
  },
  anonymous: {
    fontSize: 12,
    marginLeft: 4,
    opacity: 0.7,
  },
  votesContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  votes: {
    fontSize: 12,
    marginLeft: 4,
    opacity: 0.7,
  },
});
