import { Ionicons } from "@expo/vector-icons";
import { Stack, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  useColorScheme,
  View,
} from "react-native";
import { Colors } from "../constants/Colors";
import { useNetwork } from "../context/NetworkContext";
import { votingPoolsApi } from "../services/apiClient";
import { OfflineVote } from "../services/offlineStorage";
import { offlineVoteManager } from "../services/offlineVoteManager";
import { timeAgo } from "../services/utils";

export default function OfflineVotesScreen() {
  const [votes, setVotes] = useState<OfflineVote[]>([]);
  const [poolNames, setPoolNames] = useState<Record<string, string>>({});
  const [isSyncing, setIsSyncing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { isConnected } = useNetwork();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const themeColors = isDark ? Colors.dark : Colors.light;

  useEffect(() => {
    loadVotes();
  }, []);

  const loadVotes = async () => {
    try {
      setIsLoading(true);
      const allVotes = await offlineVoteManager.getAllOfflineVotes();
      setVotes(allVotes);

      // Get pool names for display
      const poolIds = [...new Set(allVotes.map((vote) => vote.poolId))];
      const poolNamesMap: Record<string, string> = {};

      await Promise.all(
        poolIds.map(async (poolId) => {
          try {
            const pool = await votingPoolsApi.getVotingPoolById(poolId, undefined, false);
            if (pool) {
              poolNamesMap[poolId] = pool.title;
            }
          } catch (error) {
            console.error(`Error fetching pool ${poolId}:`, error);
          }
        })
      );

      setPoolNames(poolNamesMap);
    } catch (error) {
      console.error("Error loading offline votes:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadVotes();
    setRefreshing(false);
  };

  const handleSyncAll = async () => {
    if (!isConnected || isSyncing) return;

    setIsSyncing(true);
    try {
      const result = await offlineVoteManager.syncAllPendingVotes();
      console.log("Sync result:", result);
      await loadVotes(); // Reload votes after sync
    } catch (error) {
      console.error("Error syncing votes:", error);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSyncVote = async (voteId: string) => {
    if (!isConnected) return;

    try {
      const vote = votes.find((v) => v.id === voteId);
      if (!vote) return;

      // Update UI state
      setVotes((current) =>
        current.map((v) =>
          v.id === voteId ? { ...v, status: "syncing" as any } : v
        )
      );

      // Try to sync
      const success = await offlineVoteManager.syncVote(voteId);

      // Reload votes to get updated status
      await loadVotes();
    } catch (error) {
      console.error(`Error syncing vote ${voteId}:`, error);
      // Reload votes to get current state
      await loadVotes();
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "#FF9800";
      case "synced":
        return "#4CAF50";
      case "error":
        return "#F44336";
      default:
        return "#999";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "pending":
        return "time-outline";
      case "synced":
        return "checkmark-circle-outline";
      case "error":
        return "alert-circle-outline";
      default:
        return "help-circle-outline";
    }
  };

  const renderItem = ({ item }: { item: OfflineVote }) => {
    const poolName =
      poolNames[item.poolId] || `Pool ${item.poolId.substring(0, 6)}...`;
    const statusColor = getStatusColor(item.status);
    const statusIcon = getStatusIcon(item.status);
    const canSync = isConnected && item.status !== "synced";

    return (
      <View
        style={[styles.voteItem, { backgroundColor: isDark ? "#222" : "#fff" }]}
      >
        <View style={styles.voteHeader}>
          <Text style={[styles.poolName, { color: themeColors.text }]}>
            {poolName}
          </Text>
          <View
            style={[
              styles.statusBadge,
              { backgroundColor: statusColor + "20" },
            ]}
          >
            <Ionicons name={statusIcon} size={14} color={statusColor} />
            <Text style={[styles.statusText, { color: statusColor }]}>
              {item.status === "pending"
                ? "Pendente"
                : item.status === "synced"
                ? "Sincronizado"
                : "Erro"}
            </Text>
          </View>
        </View>

        <View style={styles.voteDetails}>
          <Text style={[styles.voteTime, { color: themeColors.text }]}>
            {timeAgo(item.timestamp)}
          </Text>
          <Text style={[styles.voteId, { color: isDark ? "#aaa" : "#666" }]}>
            ID: {item.id.substring(0, 8)}
          </Text>
        </View>

        {item.error && <Text style={styles.errorText}>{item.error}</Text>}

        {canSync && (
          <TouchableOpacity
            style={[
              styles.syncButton,
              {
                backgroundColor: isDark
                  ? themeColors.tint + "30"
                  : themeColors.tint + "10",
              },
            ]}
            onPress={() => handleSyncVote(item.id)}
            disabled={!isConnected}
          >
            <Ionicons
              name="cloud-upload-outline"
              size={16}
              color={themeColors.tint}
            />
            <Text style={[styles.syncButtonText, { color: themeColors.tint }]}>
              Sincronizar
            </Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const renderEmpty = () => {
    if (isLoading) {
      return (
        <View style={styles.emptyContainer}>
          <ActivityIndicator size="large" color={themeColors.tint} />
          <Text style={[styles.emptyText, { color: themeColors.text }]}>
            Carregando votos...
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="checkmark-circle" size={48} color={themeColors.tint} />
        <Text style={[styles.emptyText, { color: themeColors.text }]}>
          Não há votos offline
        </Text>
      </View>
    );
  };

  return (
    <View
      style={[styles.container, { backgroundColor: themeColors.background }]}
    >
      <Stack.Screen
        options={{
          title: "Votos Offline",
          headerStyle: {
            backgroundColor: isDark ? "#1C1C1E" : themeColors.background,
          },
          headerTintColor: themeColors.text,
          headerLeft: () => (
            <TouchableOpacity
              onPress={() => router.back()}
              style={styles.backButton}
            >
              <Ionicons name="arrow-back" size={24} color={themeColors.text} />
            </TouchableOpacity>
          ),
        }}
      />

      {votes.length > 0 && (
        <View style={styles.summaryContainer}>
          <Text style={[styles.summaryText, { color: themeColors.text }]}>
            {votes.filter((v) => v.status === "pending").length} pendentes,{" "}
            {votes.filter((v) => v.status === "synced").length} sincronizados,{" "}
            {votes.filter((v) => v.status === "error").length} com erro
          </Text>

          {isConnected &&
            votes.filter((v) => v.status === "pending").length > 0 && (
              <TouchableOpacity
                style={[
                  styles.syncAllButton,
                  { backgroundColor: themeColors.tint },
                ]}
                onPress={handleSyncAll}
                disabled={isSyncing || !isConnected}
              >
                {isSyncing ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="sync" size={16} color="#fff" />
                    <Text style={styles.syncAllText}>Sincronizar Todos</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
        </View>
      )}

      <FlatList
        data={votes}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={renderEmpty}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[themeColors.tint]}
            tintColor={themeColors.tint}
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
  backButton: {
    padding: 8,
  },
  list: {
    padding: 16,
    flexGrow: 1,
  },
  voteItem: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.41,
    elevation: 2,
  },
  voteHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  poolName: {
    fontWeight: "600",
    fontSize: 16,
    flex: 1,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "500",
    marginLeft: 4,
  },
  voteDetails: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  voteTime: {
    fontSize: 14,
  },
  voteId: {
    fontSize: 12,
  },
  errorText: {
    color: "#F44336",
    fontSize: 14,
    marginTop: 8,
    marginBottom: 8,
  },
  syncButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    borderRadius: 8,
    marginTop: 8,
  },
  syncButtonText: {
    fontWeight: "600",
    marginLeft: 8,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  emptyText: {
    fontSize: 16,
    marginTop: 16,
    textAlign: "center",
  },
  summaryContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  summaryText: {
    fontSize: 14,
    flex: 1,
  },
  syncAllButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  syncAllText: {
    color: "#fff",
    fontWeight: "600",
    marginLeft: 6,
  },
});
