import { StatusBar } from "expo-status-bar";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
import { resultsApi, votingPoolsApi } from "../../services/apiClient";
import { VotingPool } from "../../types";

interface PoolResult {
  poolId: string;
  title: string;
  status: "active" | "closed";
  totalVotes: number;
  results: {
    id: string;
    text: string;
    voteCount: number;
    percentage: number;
  }[];
}

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
      console.log("Fetching voted pools for status:", activeTab);

      // Get user voted pools results
      const poolResults = await resultsApi.getUserVotedPoolsResults(activeTab);
      console.log("Received pool results:", poolResults?.length || 0);

      if (!poolResults || poolResults.length === 0) {
        setVotedPools([]);
        return;
      }

      // Now get the complete pool data for each result
      const poolIds = poolResults.map((result) => result.poolId);
      console.log("Pool IDs to fetch:", poolIds);

      try {
        const poolsData = await Promise.all(
          poolIds.map((id) => votingPoolsApi.getVotingPoolById(id))
        );

        // Filter out null values
        const validPools = poolsData.filter(
          (pool): pool is VotingPool => pool !== null
        );
        console.log(
          `Successfully fetched ${validPools.length} out of ${poolIds.length} pools`
        );
        setVotedPools(validPools);
      } catch (poolFetchError) {
        console.error("Error fetching individual pools:", poolFetchError);
        // Try to use the basic pool data from results
        const fallbackPools = poolResults.map((result) => ({
          id: result.poolId,
          title: result.title,
          status: result.status,
          description: "Dados completos indisponíveis",
          category: "Geral",
          startDate: new Date(),
          endDate: new Date(),
          anonymous: false,
          options: result.results.map((r) => ({
            id: r.id,
            text: r.text,
            voteCount: r.voteCount,
            description: "",
          })),
        })) as unknown as VotingPool[];

        setVotedPools(fallbackPools);
      }
    } catch (error) {
      console.error("Error fetching voted pools:", error);
      Alert.alert(
        "Erro",
        "Falha ao carregar os resultados. Tente novamente mais tarde."
      );
      setVotedPools([]);
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

  // Sort the pools options by vote count in each pool
  useEffect(() => {
    if (votedPools.length > 0) {
      const sortedPools = votedPools.map((pool) => {
        return {
          ...pool,
          options: [...pool.options].sort((a, b) => b.voteCount - a.voteCount),
        };
      });
      setVotedPools(sortedPools);
    }
  }, [votedPools.length]);

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
