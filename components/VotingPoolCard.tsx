import { FontAwesome5, MaterialIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
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
import { votesApi } from "../services/apiClient";
import { useAuth } from "../context/AuthContext";

interface VotingPoolCardProps {
  pool: VotingPool;
}

export function VotingPoolCard({ pool }: VotingPoolCardProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const { user } = useAuth();
  const [hasVoted, setHasVoted] = useState(false);

  // Check if the current user has voted in this pool
  useEffect(() => {
    // Only check for active pools
    if (pool.status === "active" && user) {
      const checkVoteStatus = async () => {
        try {
          const result = await votesApi.hasUserVoted(pool.id);
          setHasVoted(result.hasVoted);
        } catch (error) {
          console.error("Error checking vote status:", error);
        }
      };

      checkVoteStatus();
    } else if (pool.status === "closed") {
      // For closed pools, always show the winner regardless of voting status
      setHasVoted(true);
    }
  }, [pool.id, pool.status, user]);

  // Log image data for debugging
  useEffect(() => {
    console.log(`Pool ${pool.id} - Has image data: ${!!pool.imageData}`);
    if (pool.imageData) {
      console.log(
        `Pool ${pool.id} - Image data length: ${pool.imageData.length}`
      );
    }
  }, [pool]);

  // Calculate total votes
  const totalVotes = pool.options.reduce(
    (sum, option) => sum + option.voteCount,
    0
  );

  // Get winning option (for closed pools) or current leading option
  const winningOption =
    pool.options.length > 0
      ? [...pool.options].sort((a, b) => b.voteCount - a.voteCount)[0]
      : null;

  const showWinner =
    pool.status === "closed" && winningOption && winningOption.voteCount > 0;

  // Only show leader if the user has already voted or the pool is closed
  const showLeader =
    pool.status === "active" &&
    hasVoted &&
    winningOption &&
    winningOption.voteCount > 0;

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
      {pool.imageData ? (
        <Image
          source={{ uri: pool.imageData }}
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

        {/* Winner information for closed pools */}
        {showWinner && winningOption && (
          <View style={styles.winnerContainer}>
            <MaterialIcons name="emoji-events" size={16} color="#FFD700" />
            <ThemedText style={styles.winnerText}>
              Vencedor: {truncateText(winningOption.text, 40)} (
              {winningOption.voteCount} votos)
            </ThemedText>
          </View>
        )}

        {/* Current leader for active pools only if user has voted */}
        {showLeader && winningOption && (
          <View style={styles.leaderContainer}>
            <MaterialIcons
              name="trending-up"
              size={16}
              color={Colors.light.tint}
            />
            <ThemedText style={styles.leaderText}>
              Mais votado no momento: {truncateText(winningOption.text, 40)} (
              {winningOption.voteCount} votos)
            </ThemedText>
          </View>
        )}

        {/* Message for active pools where user hasn't voted yet */}
        {pool.status === "active" && !hasVoted && user && (
          <View
            style={[
              styles.voteToSeeContainer,
              {
                backgroundColor: isDark
                  ? "rgba(142, 142, 147, 0.2)"
                  : "rgba(142, 142, 147, 0.1)",
              },
            ]}
          >
            <MaterialIcons
              name="how-to-vote"
              size={16}
              color={isDark ? "#AEAEB2" : "#8E8E93"}
            />
            <ThemedText style={styles.voteToSeeText}>
              Vote para ver os resultados parciais
            </ThemedText>
          </View>
        )}

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
  winnerContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 215, 0, 0.1)",
    padding: 8,
    borderRadius: 8,
    marginBottom: 12,
  },
  winnerText: {
    fontSize: 14,
    fontWeight: "600",
    marginLeft: 6,
    flex: 1,
  },
  leaderContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(33, 150, 243, 0.1)",
    padding: 8,
    borderRadius: 8,
    marginBottom: 12,
  },
  leaderText: {
    fontSize: 14,
    fontWeight: "500",
    marginLeft: 6,
    flex: 1,
  },
  voteToSeeContainer: {
    flexDirection: "row",
    alignItems: "center",
    padding: 8,
    borderRadius: 8,
    marginBottom: 12,
    marginTop: 8,
  },
  voteToSeeText: {
    fontSize: 14,
    fontWeight: "500",
    marginLeft: 6,
    color: "#8E8E93",
  },
});
