import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { offlineVoteManager } from "../services/offlineVoteManager";
import { useNetwork } from "../context/NetworkContext";
import { Colors } from "../constants/Colors";
import { useColorScheme } from "react-native";

export const PendingVotesIndicator: React.FC = () => {
  const [pendingVotes, setPendingVotes] = useState<number>(0);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const { isConnected } = useNetwork();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";

  // Check for pending votes on mount and when connection changes
  useEffect(() => {
    checkPendingVotes();
  }, [isConnected]);

  // Check every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      checkPendingVotes();
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  const checkPendingVotes = async () => {
    try {
      const votes = await offlineVoteManager.getPendingVotes();
      setPendingVotes(votes.length);
    } catch (error) {
      console.error(
        "[PendingVotesIndicator] Error checking pending votes:",
        error
      );
    }
  };

  const handleSync = async () => {
    if (!isConnected || isSyncing) return;

    setIsSyncing(true);
    try {
      const result = await offlineVoteManager.syncAllPendingVotes();
      console.log("[PendingVotesIndicator] Sync result:", result);
      await checkPendingVotes(); // Refresh count after sync
    } catch (error) {
      console.error("[PendingVotesIndicator] Error syncing votes:", error);
    } finally {
      setIsSyncing(false);
    }
  };

  // Don't render anything if there are no pending votes
  if (pendingVotes === 0) return null;

  return (
    <TouchableOpacity
      style={[
        styles.container,
        { backgroundColor: isDark ? "#222" : Colors.light.tint },
      ]}
      onPress={handleSync}
      disabled={!isConnected || isSyncing}
    >
      {isSyncing ? (
        <ActivityIndicator size="small" color="#fff" />
      ) : (
        <Ionicons
          name={isConnected ? "cloud-upload" : "cloud-offline"}
          size={16}
          color="#fff"
        />
      )}
      <Text style={styles.text}>
        {isSyncing
          ? "Sincronizando votos..."
          : `${pendingVotes} ${
              pendingVotes === 1 ? "voto pendente" : "votos pendentes"
            }`}
      </Text>
      {isConnected && !isSyncing && (
        <TouchableOpacity style={styles.syncButton} onPress={handleSync}>
          <Text style={styles.syncText}>Sincronizar</Text>
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    bottom: 16,
    left: 16,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  text: {
    color: "#fff",
    marginLeft: 8,
    flex: 1,
    fontWeight: "500",
  },
  syncButton: {
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
  },
  syncText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 12,
  },
});
