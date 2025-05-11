import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useEffect, useState } from "react";
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  TouchableOpacity,
  useColorScheme,
  View,
} from "react-native";
import { ThemedText } from "../../components/ThemedText";
import { VotingPoolCard } from "../../components/VotingPoolCard";
import { PoolSkeleton } from "../../components/PoolSkeleton";
import { Colors } from "../../constants/Colors";
import { useAuth } from "../../context/AuthContext";
import { votingPoolsApi } from "../../services/apiClient";
import { VotingPool } from "../../types";
import { CustomModal } from "../../components/CustomModal";
import { useModal } from "../../hooks/useModal";

export default function HomeScreen() {
  const [allPoolIds, setAllPoolIds] = useState<string[]>([]);
  const [loadedPools, setLoadedPools] = useState<Record<string, VotingPool>>(
    {}
  );
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const { user } = useAuth();
  const { visible, options, showModal, hideModal } = useModal();

  // Get route params to check if we should refresh
  const params = useLocalSearchParams();
  const shouldRefresh = params.refresh === "true";
  const refreshTimestamp = params.timestamp; // Used to trigger refresh when value changes

  // Check if user is admin (role = 2)
  const isAdmin = user?.role === 2;

  const fetchVotingPools = async (forceRefresh = false) => {
    try {
      // Only show loading state on initial load or forced refresh
      if (Object.keys(loadedPools).length === 0 || forceRefresh) {
        setIsLoading(true);
      }

      if (forceRefresh) {
        setLoadedPools({});
      }

      // First, get the list of all pool IDs with the forceRefresh parameter
      const pools = await votingPoolsApi.getActiveVotingPools(forceRefresh);

      // Set the IDs to render skeleton placeholders
      setAllPoolIds(pools.map((pool) => pool.id));

      // For each pool ID, either load from cache or fetch
      pools.forEach(async (basicPool) => {
        try {
          const pool = await votingPoolsApi.getVotingPoolById(
            basicPool.id,
            forceRefresh
          );

          if (pool) {
            // Add this pool to the loaded pools
            setLoadedPools((current) => ({
              ...current,
              [basicPool.id]: pool,
            }));
          }
        } catch (error) {
          console.error(`Error loading pool ${basicPool.id}:`, error);
        }
      });

      // Once all pools are processed, we can set isLoading to false
      setIsLoading(false);

      // Clear the refresh parameter after loading
      if (shouldRefresh) {
        // Use setTimeout to ensure this runs after the current render cycle
        setTimeout(() => {
          router.setParams({});
        }, 500);
      }
    } catch (error) {
      console.error("Error fetching voting pools:", error);
      showModal({
        title: "Erro",
        message: "Falha ao carregar as votações. Tente novamente mais tarde.",
        type: "error",
      });
      setIsLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    // Pass true to force refresh from API instead of cache
    await fetchVotingPools(true);
    setRefreshing(false);
  };

  // Fetch pools on initial load - don't force refresh
  useEffect(() => {
    fetchVotingPools(false);
  }, []);

  // Also fetch pools when the refresh parameter changes
  useEffect(() => {
    if (shouldRefresh && refreshTimestamp) {
      // Show a success toast if coming from pool creation
      showModal({
        title: "Nova Votação",
        message: "Sua votação foi criada e está disponível agora!",
        type: "success",
      });

      // Force refresh after pool creation
      fetchVotingPools(true);
    }
  }, [shouldRefresh, refreshTimestamp]);

  const handleCreatePool = () => {
    // Navigate to the create pool page
    router.push("/create-pool");
  };

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

    // If there are no pools at all
    if (!isLoading && allPoolIds.length === 0) {
      return (
        <View style={styles.centerContainer}>
          <ThemedText style={styles.emptyText}>
            Não há votações ativas no momento.
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

      {/* Admin-only FAB to create a new pool */}
      {isAdmin && (
        <TouchableOpacity
          style={[styles.fab, { backgroundColor: Colors.light.tint }]}
          onPress={handleCreatePool}
        >
          <Ionicons name="add" size={30} color="#FFFFFF" />
        </TouchableOpacity>
      )}

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
  fab: {
    position: "absolute",
    bottom: 20,
    right: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: "center",
    alignItems: "center",
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  skeletonContainer: {
    flex: 1,
  },
});
