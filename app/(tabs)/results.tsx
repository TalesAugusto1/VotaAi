import { StatusBar } from "expo-status-bar";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  TouchableOpacity,
  useColorScheme,
  View,
} from "react-native";
import { ThemedText } from "../../components/ThemedText";
import { VotingPoolCard } from "../../components/VotingPoolCard";
import { Colors } from "../../constants/Colors";
import { useAuth } from "../../context/AuthContext";
import { votesService, votingPoolsService } from "../../services/api";
import { VotingPool } from "../../types";

export default function ResultsScreen() {
  const [votedPools, setVotedPools] = useState<VotingPool[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<"active" | "closed">("active");
  const { user } = useAuth();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";

  const fetchVotedPools = async () => {
    if (!user) return;

    try {
      setIsLoading(true);

      // Get user votes
      const userVotes = await votesService.getUserVotes(user.id);

      // Get all pools
      const allPools = await votingPoolsService.getVotingPools();

      // Filter pools that user has voted on
      const userVotedPools = allPools.filter((pool) =>
        userVotes.some((vote) => vote.poolId === pool.id)
      );

      // Filter based on active tab
      const filteredPools = userVotedPools.filter((pool) =>
        activeTab === "active"
          ? pool.status === "active"
          : pool.status === "closed"
      );

      setVotedPools(filteredPools);
    } catch (error) {
      console.error("Error fetching voted pools:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchVotedPools();
    setRefreshing(false);
  };

  useEffect(() => {
    fetchVotedPools();
  }, [user, activeTab]);

  const renderEmptyComponent = () => {
    if (isLoading) {
      return (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={Colors.light.tint} />
          <ThemedText style={styles.loadingText}>
            Carregando resultados...
          </ThemedText>
        </View>
      );
    }

    return (
      <View style={styles.centerContainer}>
        <ThemedText style={styles.emptyText}>
          {activeTab === "active"
            ? "Você ainda não votou em nenhuma votação ativa."
            : "Você não participou de votações encerradas."}
        </ThemedText>
      </View>
    );
  };

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: isDark
            ? Colors.dark.background
            : Colors.light.background,
        },
      ]}
    >
      <StatusBar style={isDark ? "light" : "dark"} />

      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === "active" && styles.activeTab,
            { borderColor: Colors.light.tint },
          ]}
          onPress={() => setActiveTab("active")}
        >
          <ThemedText
            style={[
              styles.tabText,
              activeTab === "active" && styles.activeTabText,
            ]}
          >
            Em Andamento
          </ThemedText>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === "closed" && styles.activeTab,
            { borderColor: Colors.light.tint },
          ]}
          onPress={() => setActiveTab("closed")}
        >
          <ThemedText
            style={[
              styles.tabText,
              activeTab === "closed" && styles.activeTabText,
            ]}
          >
            Encerradas
          </ThemedText>
        </TouchableOpacity>
      </View>

      <FlatList
        data={votedPools}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <VotingPoolCard pool={item} />}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={renderEmptyComponent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[Colors.light.tint]}
            tintColor={isDark ? Colors.dark.tint : Colors.light.tint}
          />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  tabContainer: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  activeTab: {
    borderBottomWidth: 2,
  },
  tabText: {
    fontSize: 14,
    fontWeight: "500",
  },
  activeTabText: {
    color: Colors.light.tint,
    fontWeight: "600",
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 32,
    flexGrow: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    textAlign: "center",
  },
  emptyText: {
    fontSize: 16,
    textAlign: "center",
    opacity: 0.7,
  },
});
