import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
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
import { votingPoolsApi } from "../../services/apiClient";
import { VotingPool } from "../../types";

export default function HomeScreen() {
  const [votingPools, setVotingPools] = useState<VotingPool[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const { user } = useAuth();

  // Check if user is admin (role = 2)
  const isAdmin = user?.role === 2;

  const fetchVotingPools = async () => {
    try {
      setIsLoading(true);
      const pools = await votingPoolsApi.getActiveVotingPools();
      setVotingPools(pools);
    } catch (error) {
      console.error("Error fetching voting pools:", error);
      Alert.alert(
        "Erro",
        "Falha ao carregar as votações. Tente novamente mais tarde."
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchVotingPools();
    setRefreshing(false);
  };

  useEffect(() => {
    fetchVotingPools();
  }, []);

  const handleCreatePool = () => {
    // Navigate to the create pool page
    router.push("/create-pool");
  };

  const renderEmptyComponent = () => {
    if (isLoading) {
      return (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={Colors.light.tint} />
          <ThemedText style={styles.loadingText}>
            Carregando votações...
          </ThemedText>
        </View>
      );
    }

    return (
      <View style={styles.centerContainer}>
        <ThemedText style={styles.emptyText}>
          Não há votações ativas no momento.
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
      <FlatList
        data={votingPools}
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

      {/* Admin-only FAB to create a new pool */}
      {isAdmin && (
        <TouchableOpacity
          style={[styles.fab, { backgroundColor: Colors.light.tint }]}
          onPress={handleCreatePool}
        >
          <Ionicons name="add" size={30} color="#FFFFFF" />
        </TouchableOpacity>
      )}
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
});
