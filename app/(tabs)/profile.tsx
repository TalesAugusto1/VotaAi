import { FontAwesome5, Ionicons, MaterialIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { StatusBar } from "expo-status-bar";
import React, { useEffect, useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  useColorScheme,
  View,
} from "react-native";
import { ThemedText } from "../../components/ThemedText";
import { Colors } from "../../constants/Colors";
import { useAuth } from "../../context/AuthContext";
import {
  authApi,
  resultsApi,
  votesApi,
  votingPoolsApi,
} from "../../services/apiClient";
import { Vote } from "../../types";
import { CustomModal } from "../../components/CustomModal";
import { useModal } from "../../hooks/useModal";

interface UserVote extends Vote {
  pool?: {
    title: string;
    status: "active" | "closed";
  };
}

export default function ProfileScreen() {
  const { user, logout } = useAuth();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const { visible, options, showModal, hideModal } = useModal();
  const [voteStats, setVoteStats] = useState({
    totalVotes: 0,
    activeVotes: 0,
    closedVotes: 0,
  });
  const [recentVotes, setRecentVotes] = useState<UserVote[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchUserVoteStats = async () => {
      if (!user) return;

      try {
        setIsLoading(true);

        // Get all user votes
        const userVotes = await votesApi.getUserVotes();

        // Get active and closed pools
        const activeResults = await resultsApi.getUserVotedPoolsResults(
          "active"
        );
        const closedResults = await resultsApi.getUserVotedPoolsResults(
          "closed"
        );

        // Calculate stats
        setVoteStats({
          totalVotes: userVotes.length,
          activeVotes: activeResults.length,
          closedVotes: closedResults.length,
        });

        // Get recent votes with pool info
        if (userVotes.length > 0) {
          // Sort by most recent and limit to 3
          const sortedVotes = userVotes
            .sort(
              (a, b) =>
                new Date(b.timestamp).getTime() -
                new Date(a.timestamp).getTime()
            )
            .slice(0, 3);

          // Fetch pool details for each vote
          const votesWithPools = await Promise.all(
            sortedVotes.map(async (vote) => {
              try {
                const pool = await votingPoolsApi.getVotingPoolById(
                  vote.poolId
                );
                return {
                  ...vote,
                  pool: pool
                    ? {
                        title: pool.title,
                        status: pool.status as "active" | "closed",
                      }
                    : undefined,
                };
              } catch (error) {
                console.error(
                  `Error fetching pool for vote ${vote.id}:`,
                  error
                );
                return vote;
              }
            })
          );

          setRecentVotes(votesWithPools);
        }
      } catch (error) {
        console.error("Error fetching user vote stats:", error);
        Alert.alert(
          "Erro",
          "Falha ao carregar dados de votação. Tente novamente mais tarde."
        );
      } finally {
        setIsLoading(false);
      }
    };

    fetchUserVoteStats();
  }, [user]);

  const handleLogout = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    showModal({
      title: "Sair",
      message: "Tem certeza que deseja sair?",
      type: "warning",
      actions: [
        {
          text: "Cancelar",
          onPress: () => hideModal(),
          style: "cancel",
        },
        {
          text: "Sair",
          onPress: () => {
            hideModal();
            logout();
          },
          style: "destructive",
        },
      ],
    });
  };

  if (!user) {
    return null;
  }

  return (
    <ScrollView
      style={[
        styles.container,
        {
          backgroundColor: isDark
            ? Colors.dark.background
            : Colors.light.background,
        },
      ]}
      contentContainerStyle={styles.contentContainer}
    >
      <StatusBar style={isDark ? "light" : "dark"} />

      <View style={styles.profileHeader}>
        {user.avatarUrl ? (
          <Image
            source={{ uri: authApi.getAvatarUrl(user.id) }}
            style={styles.avatar}
            contentFit="cover"
          />
        ) : (
          <View
            style={[
              styles.avatarPlaceholder,
              { backgroundColor: isDark ? "#2C2C2E" : "#F2F2F7" },
            ]}
          >
            <FontAwesome5
              name="user"
              size={40}
              color={isDark ? "#AEAEB2" : "#8E8E93"}
            />
          </View>
        )}

        <ThemedText style={styles.userName}>{user.name}</ThemedText>
        <ThemedText style={styles.userInfo}>{user.email}</ThemedText>

        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <ThemedText style={styles.statValue}>
              {voteStats.totalVotes}
            </ThemedText>
            <ThemedText style={styles.statLabel}>Votos Totais</ThemedText>
          </View>

          <View style={styles.statDivider} />

          <View style={styles.statItem}>
            <ThemedText style={styles.statValue}>
              {voteStats.activeVotes}
            </ThemedText>
            <ThemedText style={styles.statLabel}>Votações Ativas</ThemedText>
          </View>

          <View style={styles.statDivider} />

          <View style={styles.statItem}>
            <ThemedText style={styles.statValue}>
              {voteStats.closedVotes}
            </ThemedText>
            <ThemedText style={styles.statLabel}>
              Votações Encerradas
            </ThemedText>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <ThemedText style={styles.sectionTitle}>
          Informações Pessoais
        </ThemedText>

        <View
          style={[
            styles.infoItem,
            { backgroundColor: isDark ? "#1C1C1E" : "#FFFFFF" },
          ]}
        >
          <Ionicons name="person" size={20} color={Colors.light.tint} />
          <ThemedText style={styles.infoLabel}>Nome:</ThemedText>
          <ThemedText style={styles.infoValue}>{user.name}</ThemedText>
        </View>

        <View
          style={[
            styles.infoItem,
            { backgroundColor: isDark ? "#1C1C1E" : "#FFFFFF" },
          ]}
        >
          <MaterialIcons name="email" size={20} color={Colors.light.tint} />
          <ThemedText style={styles.infoLabel}>Email:</ThemedText>
          <ThemedText style={styles.infoValue}>{user.email}</ThemedText>
        </View>

        <View
          style={[
            styles.infoItem,
            { backgroundColor: isDark ? "#1C1C1E" : "#FFFFFF" },
          ]}
        >
          <MaterialIcons
            name="credit-card"
            size={20}
            color={Colors.light.tint}
          />
          <ThemedText style={styles.infoLabel}>CPF:</ThemedText>
          <ThemedText style={styles.infoValue}>{user.cpf}</ThemedText>
        </View>
      </View>

      {recentVotes.length > 0 && (
        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Votos Recentes</ThemedText>

          {recentVotes.map((vote) => (
            <View
              key={vote.id}
              style={[
                styles.voteItem,
                { backgroundColor: isDark ? "#1C1C1E" : "#FFFFFF" },
              ]}
            >
              <FontAwesome5
                name="vote-yea"
                size={20}
                color={Colors.light.tint}
              />
              <View style={styles.voteInfo}>
                <ThemedText style={styles.voteTitle}>
                  {vote.pool?.title || "Votação"}
                </ThemedText>
                <ThemedText style={styles.voteDate}>
                  {new Date(vote.timestamp).toLocaleDateString("pt-BR")}
                </ThemedText>
              </View>
              <View
                style={[
                  styles.voteStatus,
                  {
                    backgroundColor:
                      vote.pool?.status === "active" ? "#E8F5E9" : "#FFEBEE",
                  },
                ]}
              >
                <ThemedText
                  style={[
                    styles.voteStatusText,
                    {
                      color:
                        vote.pool?.status === "active" ? "#4CAF50" : "#F44336",
                    },
                  ]}
                >
                  {vote.pool?.status === "active" ? "Ativa" : "Encerrada"}
                </ThemedText>
              </View>
            </View>
          ))}
        </View>
      )}

      <TouchableOpacity
        style={[
          styles.logoutButton,
          { backgroundColor: isDark ? "#2C2C2E" : "#F2F2F7" },
        ]}
        onPress={handleLogout}
      >
        <Ionicons name="log-out" size={20} color="#FF3B30" />
        <ThemedText style={styles.logoutText}>Sair da Conta</ThemedText>
      </TouchableOpacity>

      <CustomModal
        visible={visible}
        title={options.title || ""}
        message={options.message}
        type={options.type}
        onClose={hideModal}
        actions={options.actions}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: 50,
  },
  profileHeader: {
    alignItems: "center",
    paddingTop: 24,
    paddingBottom: 24,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 16,
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  userName: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 4,
  },
  userInfo: {
    fontSize: 16,
    opacity: 0.6,
    marginBottom: 24,
  },
  statsContainer: {
    flexDirection: "row",
    width: "90%",
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: Colors.light.tint + "20",
    justifyContent: "space-between",
  },
  statItem: {
    alignItems: "center",
    flex: 1,
  },
  statValue: {
    fontSize: 20,
    fontWeight: "bold",
    color: Colors.light.tint,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    opacity: 0.7,
    textAlign: "center",
  },
  statDivider: {
    width: 1,
    height: "80%",
    backgroundColor: "rgba(150, 150, 150, 0.3)",
    alignSelf: "center",
  },
  section: {
    marginTop: 24,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 12,
  },
  infoItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    elevation: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  infoLabel: {
    fontSize: 14,
    fontWeight: "500",
    marginLeft: 12,
    minWidth: 50,
  },
  infoValue: {
    fontSize: 14,
    marginLeft: 8,
    flex: 1,
  },
  voteItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    elevation: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  voteInfo: {
    flex: 1,
    marginLeft: 12,
  },
  voteTitle: {
    fontSize: 14,
    fontWeight: "500",
  },
  voteDate: {
    fontSize: 12,
    opacity: 0.6,
    marginTop: 4,
  },
  voteStatus: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  voteStatusText: {
    fontSize: 12,
    fontWeight: "500",
  },
  logoutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 32,
    marginHorizontal: 16,
    padding: 16,
    borderRadius: 12,
  },
  logoutText: {
    fontSize: 16,
    fontWeight: "500",
    color: "#FF3B30",
    marginLeft: 8,
  },
});
