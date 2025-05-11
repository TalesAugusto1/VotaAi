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
import { CustomModal } from "../../components/CustomModal";
import { useModal } from "../../hooks/useModal";
import { PoolSkeleton } from "../../components/PoolSkeleton";

export default function ResultsScreen() {
  const [allPoolIds, setAllPoolIds] = useState<string[]>([]);
  const [loadedPools, setLoadedPools] = useState<Record<string, VotingPool>>(
    {}
  );
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"active" | "closed">("active");
  const { user } = useAuth();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const { visible, options, showModal, hideModal, showErrorModal } = useModal();

  const fetchVotedPools = async (forceRefresh = false) => {
    if (!user) return;

    try {
      // Only show loading on initial load or forced refresh
      if (Object.keys(loadedPools).length === 0 || forceRefresh) {
        setIsLoading(true);
      }

      if (forceRefresh) {
        setLoadedPools({}); // Clear loaded pools only when forcing refresh
      }

      // Reset error state on new fetch
      setErrorMessage(null);

      console.log("Fetching voted pools for status:", activeTab);

      // Get user voted pools results with proper error handling
      let poolResults = [];
      try {
        poolResults = await resultsApi.getUserVotedPoolsResults(
          activeTab,
          forceRefresh
        );
        console.log("Received pool results:", poolResults?.length || 0);
      } catch (apiError: any) {
        console.error("API error fetching voted pools:", apiError);
        setErrorMessage(
          "Não foi possível carregar as votações. Servidor indisponível."
        );
        setAllPoolIds([]);
        setIsLoading(false);
        return;
      }

      if (!poolResults || poolResults.length === 0) {
        setAllPoolIds([]);
        setIsLoading(false);
        return;
      }

      // Extract pool IDs
      const poolIds = poolResults.map((result) => result.poolId);
      setAllPoolIds(poolIds);

      console.log("Pool IDs to fetch:", poolIds);

      try {
        // Use the new batch endpoint to fetch all pools at once
        const batchResults = await votingPoolsApi.getBatchVotingPools(
          poolIds,
          forceRefresh
        );

        // Process the results and sort options by vote count
        const processedPools: Record<string, VotingPool> = {};

        Object.entries(batchResults).forEach(([id, pool]) => {
          // Sort options by vote count
          const sortedPool = {
            ...pool,
            options: [...pool.options].sort(
              (a, b) => b.voteCount - a.voteCount
            ),
          };

          processedPools[id] = sortedPool;
        });

        // Update state with all processed pools
        setLoadedPools(processedPools);
        setIsLoading(false);
      } catch (error) {
        console.error("Error loading pools batch:", error);
        setErrorMessage("Falha ao carregar detalhes das votações.");
        setIsLoading(false);
      }
    } catch (error: any) {
      console.error("Error fetching voted pools:", error);
      setErrorMessage(
        "Falha ao carregar votações. Tente novamente mais tarde."
      );

      // Use the new error handling system
      if (error.response?.status === 429) {
        showErrorModal(error, "rateLimit");
      } else {
        showErrorModal(error);
      }

      setAllPoolIds([]);
      setIsLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    // Force refresh from API on manual refresh
    await fetchVotedPools(true);
    setRefreshing(false);
  };

  useEffect(() => {
    // Use cached data first
    fetchVotedPools(false);
  }, [user, activeTab]);

  const renderEmptyComponent = () => {
    // If we have IDs but none have loaded yet, show skeletons
    if (allPoolIds.length > 0 && Object.keys(loadedPools).length === 0) {
      return (
        <View style={styles.skeletonContainer}>
          {Array.from({ length: Math.min(allPoolIds.length, 3) }).map(
            (_, index) => (
              <PoolSkeleton key={index} index={index} />
            )
          )}
        </View>
      );
    }

    // If there's an error message, show it
    if (errorMessage) {
      return (
        <View style={styles.centerContainer}>
          <ThemedText style={styles.errorText}>{errorMessage}</ThemedText>
          <TouchableOpacity
            style={[styles.retryButton, { backgroundColor: Colors.light.tint }]}
            onPress={() => fetchVotedPools(true)}
          >
            <ThemedText style={styles.retryButtonText}>
              Tentar Novamente
            </ThemedText>
          </TouchableOpacity>
        </View>
      );
    }

    // If loading is complete and there are no pools
    if (!isLoading && allPoolIds.length === 0) {
      return (
        <View style={styles.centerContainer}>
          <ThemedText style={styles.emptyText}>
            {activeTab === "active"
              ? "Você ainda não votou em nenhuma votação ativa."
              : "Você não participou de votações encerradas."}
          </ThemedText>
        </View>
      );
    }

    return null;
  };

  // Prepare data for FlatList
  const renderData = allPoolIds.map((id) => ({
    id,
    loaded: !!loadedPools[id],
    pool: loadedPools[id],
  }));

  // Render item based on loaded state
  const renderItem = ({
    item,
    index,
  }: {
    item: { id: string; loaded: boolean; pool?: VotingPool };
    index: number;
  }) => {
    if (!item.loaded) {
      return <PoolSkeleton index={index} />;
    }

    return <VotingPoolCard pool={item.pool!} />;
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
        data={renderData}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
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

      {/* Custom Modal */}
      <CustomModal
        visible={visible}
        title={options.title || ""}
        message={options.message}
        type={options.type}
        onClose={hideModal}
        actions={options.actions}
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
  errorText: {
    fontSize: 16,
    textAlign: "center",
    color: "#E53935",
    marginBottom: 16,
  },
  retryButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginTop: 16,
  },
  retryButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  skeletonContainer: {
    flex: 1,
  },
});
