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
  Platform,
  Text,
  TextInput,
  Modal,
  ScrollView,
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
import { Ionicons, MaterialIcons, FontAwesome5 } from "@expo/vector-icons";
import { useRouter } from "expo-router";

// Type definition for pool result
interface PoolResult {
  poolId: string;
  title?: string;
  totalVotes?: number;
}

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
  const router = useRouter();

  // Admin specific states
  const [searchTerm, setSearchTerm] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [showAdminActions, setShowAdminActions] = useState(false);
  const [selectedPool, setSelectedPool] = useState<VotingPool | null>(null);

  // Check if user is admin (role == 2)
  const isAdmin = user?.role === 2;

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
      let poolResults: PoolResult[] = [];
      try {
        // For admin users, get all pools instead of just voted pools
        if (isAdmin) {
          // Use existing methods to get all pools for admin users
          // First, get all pools through the voting pools API
          const { data: allPools } =
            activeTab === "active"
              ? await votingPoolsApi.getActiveVotingPools(forceRefresh)
              : await votingPoolsApi.getClosedVotingPools(forceRefresh);

          // Convert to pool results format
          poolResults = allPools.map((pool) => ({
            poolId: pool.id,
            title: pool.title,
          }));
        } else {
          poolResults = await resultsApi.getUserVotedPoolsResults(
            activeTab,
            forceRefresh
          );
        }
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
      const poolIds = poolResults.map((result: PoolResult) => result.poolId);
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
          // Ensure pool is valid
          if (!pool || !pool.options) {
            console.log(`Skipping invalid pool ${id}`);
            return;
          }

          // Validate options and vote counts
          const validatedOptions = pool.options.map((option) => ({
            ...option,
            voteCount:
              typeof option.voteCount === "number" && !isNaN(option.voteCount)
                ? option.voteCount
                : 0,
          }));

          // Sort options by vote count
          const sortedPool = {
            ...pool,
            options: validatedOptions.sort((a, b) => b.voteCount - a.voteCount),
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
              ? isAdmin
                ? "Não há votações ativas no momento."
                : "Você ainda não votou em nenhuma votação ativa."
              : isAdmin
              ? "Não há votações encerradas no momento."
              : "Você não participou de votações encerradas."}
          </ThemedText>
        </View>
      );
    }

    return null;
  };

  // Filter pools if search term is present (admin only)
  const getFilteredPools = () => {
    if (!searchTerm || !isAdmin) {
      // Return all pool IDs if no search term or not admin
      return allPoolIds;
    }

    // Filter pool IDs based on search term
    return allPoolIds.filter((id) => {
      const pool = loadedPools[id];
      if (!pool) return false;

      const searchLower = searchTerm.toLowerCase();
      return (
        pool.title.toLowerCase().includes(searchLower) ||
        pool.description.toLowerCase().includes(searchLower) ||
        pool.category.toLowerCase().includes(searchLower) ||
        pool.options.some((opt) => opt.text.toLowerCase().includes(searchLower))
      );
    });
  };

  // Prepare data for FlatList
  const renderData = getFilteredPools().map((id) => ({
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

    // For admin view, render enhanced card
    if (isAdmin) {
      return renderAdminPoolCard(item.pool!);
    }

    // For regular users, use the standard card
    return <VotingPoolCard pool={item.pool!} />;
  };

  // Admin specific functions
  const handlePoolAction = (pool: VotingPool) => {
    setSelectedPool(pool);
    setShowAdminActions(true);
  };

  const renderAdminPoolCard = (pool: VotingPool) => {
    const totalVotes = pool.options.reduce(
      (sum, option) => sum + (option.voteCount || 0),
      0
    );

    return (
      <TouchableOpacity
        style={[
          styles.adminPoolCard,
          {
            backgroundColor: isDark ? "#1C1C1E" : "#FFFFFF",
            borderLeftColor: pool.status === "active" ? "#4CAF50" : "#F44336",
          },
        ]}
        onPress={() =>
          router.push({
            pathname: "/pool/[id]",
            params: { id: pool.id },
          })
        }
        activeOpacity={0.7}
      >
        <View style={styles.adminPoolHeader}>
          <View style={styles.adminPoolInfo}>
            <Text
              style={[
                styles.adminPoolCategory,
                { color: isDark ? "#AEAEB2" : "#666666" },
              ]}
            >
              {pool.category}
            </Text>
            <Text
              style={[
                styles.adminPoolTitle,
                { color: isDark ? "#FFFFFF" : "#000000" },
              ]}
              numberOfLines={1}
            >
              {pool.title}
            </Text>
          </View>

          <TouchableOpacity
            style={styles.adminPoolMoreButton}
            onPress={() => handlePoolAction(pool)}
          >
            <Ionicons
              name="ellipsis-vertical"
              size={20}
              color={isDark ? "#FFFFFF" : "#000000"}
            />
          </TouchableOpacity>
        </View>

        <View style={styles.adminPoolBody}>
          <View style={styles.adminPoolStats}>
            <View style={styles.adminStatItem}>
              <Ionicons
                name="people-outline"
                size={16}
                color={isDark ? "#AEAEB2" : "#666666"}
              />
              <Text
                style={[
                  styles.adminStatText,
                  { color: isDark ? "#AEAEB2" : "#666666" },
                ]}
              >
                {totalVotes} votos
              </Text>
            </View>

            <View style={styles.adminStatItem}>
              <Ionicons
                name={
                  pool.status === "active"
                    ? "checkmark-circle-outline"
                    : "close-circle-outline"
                }
                size={16}
                color={pool.status === "active" ? "#4CAF50" : "#F44336"}
              />
              <Text
                style={[
                  styles.adminStatText,
                  {
                    color: pool.status === "active" ? "#4CAF50" : "#F44336",
                    fontWeight: "500",
                  },
                ]}
              >
                {pool.status === "active" ? "Ativa" : "Encerrada"}
              </Text>
            </View>
          </View>

          {/* Top options display */}
          <View style={styles.adminOptionsContainer}>
            {pool.options.slice(0, 2).map((option, index) => {
              const percentage =
                totalVotes > 0
                  ? Math.round((option.voteCount / totalVotes) * 100)
                  : 0;

              return (
                <View key={index} style={styles.adminOptionItem}>
                  <View style={styles.adminOptionTitleRow}>
                    <Text
                      style={[
                        styles.adminOptionTitle,
                        { color: isDark ? "#FFFFFF" : "#000000" },
                      ]}
                      numberOfLines={1}
                    >
                      {option.text}
                    </Text>
                    <Text
                      style={[
                        styles.adminOptionVotes,
                        { color: isDark ? "#FFFFFF" : "#000000" },
                      ]}
                    >
                      {option.voteCount || 0}
                    </Text>
                  </View>

                  <View style={styles.adminProgressContainer}>
                    <View
                      style={[
                        styles.adminProgressBar,
                        {
                          width: `${percentage}%`,
                          backgroundColor: index === 0 ? "#4CAF50" : "#FF9800",
                        },
                      ]}
                    />
                    <Text
                      style={[
                        styles.adminProgressText,
                        { color: isDark ? "#AEAEB2" : "#666666" },
                      ]}
                    >
                      {percentage}%
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  // Render admin search bar
  const renderAdminSearchBar = () => {
    if (!isAdmin) return null;

    return (
      <View style={styles.searchContainer}>
        <View
          style={[
            styles.searchInputContainer,
            {
              backgroundColor: isDark ? "#2C2C2E" : "#F2F2F7",
              borderColor: isSearchOpen ? Colors.light.tint : "transparent",
              borderWidth: isSearchOpen ? 1 : 0,
            },
          ]}
        >
          <Ionicons
            name="search"
            size={20}
            color={isDark ? "#AEAEB2" : "#8E8E93"}
          />
          <TextInput
            style={[
              styles.searchInput,
              { color: isDark ? "#FFFFFF" : "#000000" },
            ]}
            placeholder="Buscar votações..."
            placeholderTextColor={isDark ? "#AEAEB2" : "#8E8E93"}
            value={searchTerm}
            onChangeText={setSearchTerm}
            onFocus={() => setIsSearchOpen(true)}
            onBlur={() => setIsSearchOpen(false)}
          />
          {searchTerm.length > 0 && (
            <TouchableOpacity onPress={() => setSearchTerm("")}>
              <Ionicons
                name="close-circle"
                size={20}
                color={isDark ? "#AEAEB2" : "#8E8E93"}
              />
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity
          style={[styles.newPoolButton, { backgroundColor: Colors.light.tint }]}
          onPress={() => router.push("/create-pool")}
        >
          <Ionicons name="add" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
    );
  };

  // Admin actions modal
  const renderAdminActionsModal = () => {
    if (!isAdmin) return null;

    return (
      <Modal
        transparent={true}
        visible={showAdminActions}
        animationType="fade"
        onRequestClose={() => setShowAdminActions(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowAdminActions(false)}
        >
          <View
            style={[
              styles.modalContainer,
              { backgroundColor: isDark ? "#1C1C1E" : "#FFFFFF" },
            ]}
          >
            <Text
              style={[
                styles.modalTitle,
                { color: isDark ? "#FFFFFF" : "#000000" },
              ]}
            >
              Ações da Votação
            </Text>

            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => {
                if (selectedPool) {
                  // Navigate to the pool details with analytics flag
                  router.push({
                    pathname: "/pool/[id]",
                    params: { id: selectedPool.id, analytics: "true" },
                  });
                  setShowAdminActions(false);
                }
              }}
            >
              <Ionicons
                name="bar-chart-outline"
                size={22}
                color={Colors.light.tint}
              />
              <Text
                style={[
                  styles.actionText,
                  { color: isDark ? "#FFFFFF" : "#000000" },
                ]}
              >
                Ver Análises Detalhadas
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => {
                if (selectedPool) {
                  // Navigate to the export results screen
                  router.push({
                    pathname: "/export-results",
                    params: { id: selectedPool.id },
                  });
                  setShowAdminActions(false);
                }
              }}
            >
              <Ionicons
                name="download-outline"
                size={22}
                color={Colors.light.tint}
              />
              <Text
                style={[
                  styles.actionText,
                  { color: isDark ? "#FFFFFF" : "#000000" },
                ]}
              >
                Exportar Resultados
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, { borderBottomWidth: 0 }]}
              onPress={() => {
                if (selectedPool?.status === "active") {
                  Alert.alert(
                    "Encerrar Votação",
                    "Tem certeza que deseja encerrar esta votação? Esta ação não pode ser desfeita.",
                    [
                      { text: "Cancelar", style: "cancel" },
                      {
                        text: "Encerrar",
                        style: "destructive",
                        onPress: () => {
                          // Call API to close the voting pool
                          setShowAdminActions(false);
                          // After success, refresh the data
                          fetchVotedPools(true);
                        },
                      },
                    ]
                  );
                } else {
                  // Show alert that pool is already closed
                  Alert.alert(
                    "Votação Encerrada",
                    "Esta votação já está encerrada.",
                    [{ text: "OK" }]
                  );
                  setShowAdminActions(false);
                }
              }}
            >
              <Ionicons name="close-circle-outline" size={22} color="#F44336" />
              <Text style={[styles.actionText, { color: "#F44336" }]}>
                {selectedPool?.status === "active"
                  ? "Encerrar Votação"
                  : "Votação Encerrada"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => setShowAdminActions(false)}
            >
              <Text
                style={{
                  color: isDark ? "#FFFFFF" : "#000000",
                  fontWeight: "500",
                }}
              >
                Cancelar
              </Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
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

      {/* Admin Search Bar */}
      {renderAdminSearchBar()}

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

      {/* Admin Actions Modal */}
      {renderAdminActionsModal()}

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
  // Admin styles
  searchContainer: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "space-between",
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: "row",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: "center",
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 16,
    height: 36,
  },
  newPoolButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },
  adminPoolCard: {
    marginBottom: 16,
    borderRadius: 12,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    borderLeftWidth: 4,
  },
  adminPoolHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  adminPoolInfo: {
    flex: 1,
  },
  adminPoolCategory: {
    fontSize: 12,
    marginBottom: 4,
  },
  adminPoolTitle: {
    fontSize: 18,
    fontWeight: "600",
  },
  adminPoolMoreButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  adminPoolBody: {
    padding: 16,
    paddingTop: 0,
  },
  adminPoolStats: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  adminStatItem: {
    flexDirection: "row",
    alignItems: "center",
  },
  adminStatText: {
    marginLeft: 4,
    fontSize: 14,
  },
  adminOptionsContainer: {
    marginTop: 8,
  },
  adminOptionItem: {
    marginBottom: 12,
  },
  adminOptionTitleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  adminOptionTitle: {
    fontSize: 14,
    fontWeight: "500",
    flex: 1,
  },
  adminOptionVotes: {
    fontSize: 14,
    fontWeight: "600",
    marginLeft: 8,
  },
  adminProgressContainer: {
    height: 8,
    backgroundColor: "rgba(0, 0, 0, 0.05)",
    borderRadius: 4,
    overflow: "hidden",
    position: "relative",
  },
  adminProgressBar: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: 4,
  },
  adminProgressText: {
    position: "absolute",
    right: 0,
    top: 10,
    fontSize: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContainer: {
    width: "80%",
    borderRadius: 16,
    padding: 20,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 20,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0, 0, 0, 0.1)",
  },
  actionText: {
    fontSize: 16,
    marginLeft: 12,
  },
  cancelButton: {
    marginTop: 20,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    backgroundColor: "rgba(0, 0, 0, 0.05)",
  },
});
