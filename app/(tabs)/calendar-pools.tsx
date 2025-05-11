import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
  StyleSheet,
  View,
  Text,
  ActivityIndicator,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  useColorScheme,
  FlatList,
} from "react-native";
import { Ionicons, FontAwesome5, MaterialIcons } from "@expo/vector-icons";
import { Colors } from "../../constants/Colors";
import { VotingPoolCard } from "../../components/VotingPoolCard";
import { format, parseISO, isSameDay, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import PoolCalendar from "../../components/PoolCalendar";
import { VotingPool } from "../../types";
import { CATEGORY_COLORS, getPoolColor } from "../../components/PoolCalendar";
import { votingPoolsApi } from "../../services/apiClient";
import { PoolSkeleton } from "../../components/PoolSkeleton";
import { CustomModal } from "../../components/CustomModal";
import { useModal } from "../../hooks/useModal";
import { StatusBar } from "expo-status-bar";

function groupPoolsByDate(pools: VotingPool[]) {
  const grouped: { [key: string]: VotingPool[] } = {};
  pools.forEach((pool) => {
    // Use start date for upcoming and active, end date for closed
    const dateToUse =
      pool.status === "closed"
        ? parseISO(pool.endDate)
        : parseISO(pool.startDate);

    const key = format(dateToUse, "yyyy-MM-dd");
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(pool);
  });
  return grouped;
}

function getDateParts(dateString: string) {
  const date = parseISO(dateString);
  const day = format(date, "d", { locale: ptBR });
  const month = format(date, "MMMM", { locale: ptBR });
  return { day, month };
}

type TabType = "all" | "active" | "upcoming" | "closed";

// Filter pools to show in calendar based on active tab
// This helps prevent information overload when "Todas" is selected
const getCalendarPools = (allLoadedPools: VotingPool[], activeTab: TabType) => {
  // For non-"all" tabs, just show the filtered pools as before
  if (activeTab !== "all") {
    return allLoadedPools.filter((pool) => pool.status === activeTab);
  }

  // For "all" tab, prioritize active and upcoming pools, and limit total displayed
  const active = allLoadedPools.filter((pool) => pool.status === "active");
  const upcoming = allLoadedPools.filter((pool) => pool.status === "upcoming");
  const closed = allLoadedPools.filter((pool) => pool.status === "closed");

  // Start with active and upcoming pools as they're more important
  const priorityPools = [...active, ...upcoming];

  // Limit closed pools to prevent calendar overflow
  // If there are many active/upcoming pools, show fewer closed ones
  const maxClosedPools = Math.max(5, 20 - priorityPools.length);
  const selectedClosed = closed.slice(0, maxClosedPools);

  return [...priorityPools, ...selectedClosed];
};

export default function CalendarPoolsScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const themeColors = Colors[isDark ? "dark" : "light"];

  const [allPoolIds, setAllPoolIds] = useState<string[]>([]);
  const [loadedPools, setLoadedPools] = useState<Record<string, VotingPool>>(
    {}
  );
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>("all");
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const { visible, options, showModal, hideModal } = useModal();

  // Fetch pools from API
  const fetchPools = async (
    tabType: TabType = activeTab,
    forceRefresh = false
  ) => {
    try {
      // Only show loading indicator on initial load or when forcing refresh
      if (Object.keys(loadedPools).length === 0 || forceRefresh) {
        setLoading(true);
      }

      if (forceRefresh) {
        setLoadedPools({}); // Clear loaded pools only on forced refresh
      }

      let poolIds: string[] = [];

      // Get pools based on tab type, with forceRefresh parameter
      if (tabType === "all") {
        const activePools = await votingPoolsApi.getActiveVotingPools(
          forceRefresh
        );
        const upcomingPools = await votingPoolsApi.getUpcomingVotingPools(
          forceRefresh
        );
        const closedPools = await votingPoolsApi.getClosedVotingPools(
          forceRefresh
        );

        const allPools = [...activePools, ...upcomingPools, ...closedPools];
        poolIds = allPools.map((pool) => pool.id);
      } else if (tabType === "active") {
        const pools = await votingPoolsApi.getActiveVotingPools(forceRefresh);
        poolIds = pools.map((pool) => pool.id);
      } else if (tabType === "upcoming") {
        const pools = await votingPoolsApi.getUpcomingVotingPools(forceRefresh);
        poolIds = pools.map((pool) => pool.id);
      } else if (tabType === "closed") {
        const pools = await votingPoolsApi.getClosedVotingPools(forceRefresh);
        poolIds = pools.map((pool) => pool.id);
      }

      // Set the IDs to render skeleton placeholders
      setAllPoolIds(poolIds);

      // Now fetch each pool individually, using cache when possible
      poolIds.forEach(async (id) => {
        try {
          // Remove artificial delay - it's no longer needed with caching
          // Get pool with forceRefresh parameter
          const pool = await votingPoolsApi.getVotingPoolById(id, forceRefresh);

          if (pool) {
            // Add this pool to the loaded pools
            setLoadedPools((current) => ({
              ...current,
              [id]: pool,
            }));
          }
        } catch (error) {
          console.error(`Error loading pool ${id}:`, error);
        }
      });

      setError(null);
      setLoading(false);
    } catch (err) {
      console.error("Error loading pools:", err);
      showModal({
        title: "Erro",
        message:
          "Não foi possível carregar as votações. Tente novamente mais tarde.",
        type: "error",
      });
      setAllPoolIds([]);
      setLoadedPools({});
      setLoading(false);
    }
  };

  const filterPoolsByDate = (date: Date | null) => {
    // When no date is selected, we don't need to filter
    if (!date) return Object.values(loadedPools);

    // Filter pools that are active on the selected date
    return Object.values(loadedPools).filter((pool) => {
      try {
        const startDate = startOfDay(parseISO(pool.startDate));
        const endDate = startOfDay(parseISO(pool.endDate));
        const selectedDay = startOfDay(date);

        // The pool is active on the selected date if the selected date
        // falls between start and end dates (inclusive)
        return (
          (selectedDay >= startDate && selectedDay <= endDate) ||
          isSameDay(selectedDay, startDate) ||
          isSameDay(selectedDay, endDate)
        );
      } catch (error) {
        console.error("Error filtering pool by date:", error, pool);
        return false;
      }
    });
  };

  const handleDateSelect = (date: Date | null) => {
    setSelectedDate(date);
  };

  useEffect(() => {
    // When changing tabs, try to use cached data first
    fetchPools(activeTab, false);
  }, [activeTab]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    // Force refresh from API on manual refresh
    await fetchPools(activeTab, true);
    setRefreshing(false);
  }, [activeTab]);

  const handleTabChange = (tab: TabType) => {
    if (tab !== activeTab) {
      setActiveTab(tab);
      // Reset date filter when changing tabs
      setSelectedDate(null);
    }
  };

  // Get filtered and sorted pools
  const getFilteredPools = () => {
    const poolsArray = filterPoolsByDate(selectedDate);

    // Sort pools by date
    return poolsArray.sort((a, b) => {
      // For upcoming and active pools, sort by start date
      // For closed pools, sort by end date
      const dateA =
        a.status === "closed"
          ? parseISO(a.endDate).getTime()
          : parseISO(a.startDate).getTime();

      const dateB =
        b.status === "closed"
          ? parseISO(b.endDate).getTime()
          : parseISO(b.startDate).getTime();

      return dateA - dateB;
    });
  };

  // Group pools by date
  const groupedPools = groupPoolsByDate(getFilteredPools());
  const dateKeys = Object.keys(groupedPools).sort((a, b) => {
    // Sort by date (closest to today first)
    return new Date(a).getTime() - new Date(b).getTime();
  });

  const renderTabButton = (title: string, type: TabType) => {
    const isActive = activeTab === type;

    // Define a background color and icon for each tab type
    const getTabDetails = (tabType: TabType) => {
      switch (tabType) {
        case "all":
          return {
            icon: "apps",
            color: "#7B78FF", // More vibrant purple
            lightBg: "rgba(123, 120, 255, 0.15)", // More opacity
          };
        case "active":
          return {
            icon: "checkmark-circle",
            color: "#2E9935", // More vibrant green
            lightBg: "rgba(46, 153, 53, 0.15)", // More opacity
          };
        case "upcoming":
          return {
            icon: "time",
            color: "#FF8C00", // More vibrant orange
            lightBg: "rgba(255, 140, 0, 0.15)", // More opacity
          };
        case "closed":
          return {
            icon: "lock-closed",
            color: "#E53935", // More vibrant red
            lightBg: "rgba(229, 57, 53, 0.15)", // More opacity
          };
        default:
          return {
            icon: "apps",
            color: themeColors.tint,
            lightBg: `${themeColors.tint}20`, // More opacity
          };
      }
    };

    const { icon, color, lightBg } = getTabDetails(type);

    // Use shorter text for smaller screens
    const displayTitle = type === "closed" ? "Finalizadas" : title;

    return (
      <TouchableOpacity
        style={[
          styles.tabButton,
          isActive && [
            styles.activeTabButton,
            { backgroundColor: isDark ? color + "20" : lightBg },
          ],
        ]}
        onPress={() => handleTabChange(type)}
        activeOpacity={0.7}
      >
        <Ionicons
          name={icon as any}
          size={16}
          color={isActive ? color : isDark ? "#888" : "#666"}
          style={styles.tabIcon}
        />
        <Text
          style={[
            styles.tabButtonText,
            {
              color: isActive ? color : isDark ? "#ccc" : "#666",
              fontWeight: isActive ? "600" : "500",
            },
          ]}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {displayTitle}
        </Text>
        {isActive && (
          <View
            style={[styles.tabButtonIndicator, { backgroundColor: color }]}
          />
        )}
      </TouchableOpacity>
    );
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

    // If there are no pools after filtering
    if (
      Object.keys(loadedPools).length > 0 &&
      getFilteredPools().length === 0
    ) {
      return (
        <View
          style={[
            styles.emptyContainer,
            { backgroundColor: themeColors.background },
          ]}
        >
          <Text style={{ color: themeColors.text }}>
            {selectedDate
              ? "Nenhuma votação nesta data"
              : activeTab === "all"
              ? "Nenhuma votação disponível"
              : activeTab === "active"
              ? "Nenhuma votação ativa"
              : activeTab === "upcoming"
              ? "Nenhuma votação futura"
              : "Nenhuma votação encerrada"}
          </Text>
          {selectedDate && (
            <TouchableOpacity
              style={styles.clearFilterButton}
              onPress={() => setSelectedDate(null)}
            >
              <Text style={{ color: themeColors.tint }}>
                Limpar filtro de data
              </Text>
            </TouchableOpacity>
          )}
        </View>
      );
    }

    // If there are no pools at all
    if (!loading && allPoolIds.length === 0) {
      return (
        <View
          style={[
            styles.emptyContainer,
            { backgroundColor: themeColors.background },
          ]}
        >
          <Text style={{ color: themeColors.text }}>
            {activeTab === "all"
              ? "Nenhuma votação disponível"
              : activeTab === "active"
              ? "Nenhuma votação ativa"
              : activeTab === "upcoming"
              ? "Nenhuma votação futura"
              : "Nenhuma votação encerrada"}
          </Text>
        </View>
      );
    }

    return null;
  };

  const renderPoolsList = () => {
    return (
      <>
        {dateKeys.map((dateKey) => {
          const { day, month } = getDateParts(dateKey);
          return (
            <View key={dateKey} style={styles.dateSection}>
              {/* Date header with line separators */}
              <View style={styles.dateHeaderContainer}>
                <View
                  style={[
                    styles.headerLine,
                    {
                      backgroundColor: isDark
                        ? "rgba(255, 255, 255, 0.25)"
                        : themeColors.tint,
                    },
                  ]}
                />
                <View style={styles.dateColumn}>
                  <Text
                    style={[
                      styles.day,
                      {
                        color: isDark ? "#E0E0E0" : themeColors.tint,
                        textShadowColor: isDark
                          ? "rgba(0,0,0,0.4)"
                          : "transparent",
                        textShadowOffset: { width: 0, height: 1 },
                        textShadowRadius: isDark ? 2 : 0,
                      },
                    ]}
                  >
                    {day}
                  </Text>
                  <Text
                    style={[
                      styles.month,
                      {
                        color: isDark ? "#E0E0E0" : themeColors.tint,
                        opacity: isDark ? 0.9 : 1,
                      },
                    ]}
                  >
                    {month.charAt(0).toUpperCase() + month.slice(1)}
                  </Text>
                </View>
                <View
                  style={[
                    styles.headerLine,
                    {
                      backgroundColor: isDark
                        ? "rgba(255, 255, 255, 0.25)"
                        : themeColors.tint,
                    },
                  ]}
                />
              </View>

              {/* Pool cards - now as a flat list without nesting */}
              {groupedPools[dateKey].map((pool: VotingPool) => (
                <View
                  key={pool.id}
                  style={[
                    styles.poolCard,
                    {
                      backgroundColor: isDark ? "#1C1C1E" : "#FFFFFF",
                      shadowOpacity: isDark ? 0.3 : 0.1,
                    },
                  ]}
                >
                  {/* Category color indicator */}
                  <View
                    style={[
                      styles.poolCategoryIndicator,
                      {
                        backgroundColor: getPoolColor(pool),
                        opacity: isDark ? 0.9 : 1,
                      },
                    ]}
                  />

                  {/* Pool details */}
                  <View style={styles.poolContent}>
                    {/* We'll extract relevant info from VotingPoolCard and display it directly */}
                    <View style={styles.poolHeaderRow}>
                      <Text
                        style={[
                          styles.poolCategory,
                          { color: themeColors.text },
                        ]}
                      >
                        {pool.category}
                      </Text>
                      <View style={styles.statusContainer}>
                        <MaterialIcons
                          name={
                            pool.status === "active"
                              ? "check-circle"
                              : pool.status === "upcoming"
                              ? "schedule"
                              : "cancel"
                          }
                          size={14}
                          color={
                            pool.status === "active"
                              ? "#4CAF50"
                              : pool.status === "upcoming"
                              ? "#FF9800"
                              : "#F44336"
                          }
                        />
                        <Text
                          style={[
                            styles.poolStatus,
                            {
                              color:
                                pool.status === "active"
                                  ? "#4CAF50"
                                  : pool.status === "upcoming"
                                  ? "#FF9800"
                                  : "#F44336",
                            },
                          ]}
                        >
                          {pool.status === "active"
                            ? "Ativa"
                            : pool.status === "upcoming"
                            ? "Em breve"
                            : "Finalizada"}
                        </Text>
                      </View>
                    </View>

                    <Text
                      style={[
                        styles.poolTitle,
                        {
                          color: themeColors.text,
                          textShadowColor: "rgba(0,0,0,0.05)",
                          textShadowOffset: { width: 0, height: 1 },
                          textShadowRadius: 1,
                        },
                      ]}
                    >
                      {pool.title}
                    </Text>

                    <Text
                      style={[
                        styles.poolDescription,
                        { color: isDark ? "#AEAEB2" : "#666666" },
                      ]}
                      numberOfLines={2}
                    >
                      {pool.description}
                    </Text>

                    <View style={styles.poolFooter}>
                      <View style={styles.footerItem}>
                        <MaterialIcons
                          name="event"
                          size={12}
                          color={isDark ? "#AEAEB2" : "#8E8E93"}
                        />
                        <Text
                          style={[
                            styles.footerText,
                            { color: isDark ? "#AEAEB2" : "#8E8E93" },
                          ]}
                        >
                          {pool.status === "upcoming"
                            ? `Inicia em ${format(
                                parseISO(pool.startDate),
                                "dd/MM/yyyy"
                              )}`
                            : pool.status === "closed"
                            ? `Encerrada em ${format(
                                parseISO(pool.endDate),
                                "dd/MM/yyyy"
                              )}`
                            : `Termina em ${format(
                                parseISO(pool.endDate),
                                "dd/MM/yyyy"
                              )}`}
                        </Text>
                      </View>

                      <View style={styles.footerItem}>
                        <FontAwesome5
                          name="vote-yea"
                          size={12}
                          color={isDark ? "#AEAEB2" : "#8E8E93"}
                        />
                        <Text
                          style={[
                            styles.footerText,
                            { color: isDark ? "#AEAEB2" : "#8E8E93" },
                          ]}
                        >
                          {pool.options.reduce(
                            (sum, option) => sum + option.voteCount,
                            0
                          )}{" "}
                          votos
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          );
        })}
      </>
    );
  };

  const renderContent = () => {
    // Get all loaded pools as an array
    const allLoadedPools = Object.values(loadedPools);

    // Use the extracted function instead of useMemo
    const calendarPools = getCalendarPools(allLoadedPools, activeTab);

    return (
      <ScrollView
        style={{ flex: 1, backgroundColor: themeColors.background }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={themeColors.tint}
            colors={[themeColors.tint]}
          />
        }
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Calendar container with subtle shadow */}
        <View
          style={[
            styles.calendarContainer,
            {
              backgroundColor: isDark
                ? "rgba(36, 38, 45, 0.95)"
                : "rgba(248, 249, 250, 0.9)",
              borderColor: isDark
                ? "rgba(255, 255, 255, 0.1)"
                : "rgba(0, 0, 0, 0.04)",
            },
          ]}
        >
          <PoolCalendar
            pools={calendarPools} // Use the filtered pools for the calendar view
            onDateSelect={handleDateSelect}
            selectedDate={selectedDate}
            disabled={loading && allPoolIds.length === 0}
          />

          {/* Additional note when "Todas" is selected and pools are limited */}
          {activeTab === "all" &&
            allLoadedPools.length > calendarPools.length && (
              <View style={styles.calendarNote}>
                <Text
                  style={{
                    color: themeColors.text,
                    fontSize: 12,
                    fontStyle: "italic",
                    opacity: 0.7,
                    textAlign: "center",
                  }}
                >
                  Mostrando votações prioritárias no calendário. Utilize os
                  filtros para ver mais detalhes.
                </Text>
              </View>
            )}

          {/* Category legend inside calendar container */}
          {!loading && allLoadedPools.length > 0 && (
            <View
              style={[
                styles.legendContainer,
                {
                  borderTopColor: isDark
                    ? "rgba(255, 255, 255, 0.1)"
                    : "rgba(0, 0, 0, 0.05)",
                },
              ]}
            >
              <Text style={[styles.legendTitle, { color: themeColors.text }]}>
                Categorias:
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.legendScroll}
              >
                {Object.entries(CATEGORY_COLORS)
                  .filter(
                    ([key]) =>
                      key !== "default" &&
                      allLoadedPools.some((pool) => pool.category === key)
                  )
                  .map(([category, color]) => (
                    <View key={category} style={styles.legendItem}>
                      <View
                        style={[
                          styles.legendColor,
                          {
                            backgroundColor: color,
                            borderWidth: isDark ? 1 : 0,
                            borderColor: "rgba(255, 255, 255, 0.2)",
                          },
                        ]}
                      />
                      <Text
                        style={[styles.legendText, { color: themeColors.text }]}
                      >
                        {category}
                      </Text>
                    </View>
                  ))}
              </ScrollView>
            </View>
          )}
        </View>

        {/* Tab filter with refined design */}
        <View
          style={[
            styles.tabsCard,
            { backgroundColor: isDark ? "#1C1C1E" : "#FFFFFF" },
          ]}
        >
          <View style={styles.tabContainer}>
            {renderTabButton("Todas", "all")}
            {renderTabButton("Ativas", "active")}
            {renderTabButton("Futuras", "upcoming")}
            {renderTabButton("Encerradas", "closed")}
          </View>
          <View style={styles.activeTabDetails}>
            {activeTab !== "all" && (
              <Text
                style={[
                  styles.activeTabDescription,
                  { color: themeColors.text },
                ]}
              >
                {activeTab === "active"
                  ? "Mostrando votações em andamento"
                  : activeTab === "upcoming"
                  ? "Mostrando votações agendadas para o futuro"
                  : "Mostrando votações já encerradas"}
              </Text>
            )}
          </View>
        </View>

        {/* Selected date indicator */}
        {selectedDate && (
          <View
            style={[
              styles.dateFilterIndicator,
              { backgroundColor: isDark ? "#1C1C1E" : "#FFFFFF" },
            ]}
          >
            <Text style={[styles.dateFilterText, { color: themeColors.text }]}>
              Mostrando votações para{" "}
              <Text style={{ fontWeight: "600", color: themeColors.tint }}>
                {format(selectedDate, "dd 'de' MMMM, yyyy", { locale: ptBR })}
              </Text>
            </Text>
            <TouchableOpacity
              style={styles.clearFilterButton}
              onPress={() => setSelectedDate(null)}
            >
              <Text style={{ color: themeColors.tint }}>Limpar</Text>
            </TouchableOpacity>
          </View>
        )}

        {loading && allPoolIds.length === 0 ? (
          <View
            style={[
              styles.listLoadingContainer,
              { backgroundColor: isDark ? "#1C1C1E" : "#FFFFFF" },
            ]}
          >
            <ActivityIndicator size="large" color={themeColors.tint} />
            <Text style={[styles.loadingText, { color: themeColors.text }]}>
              Carregando votações...
            </Text>
          </View>
        ) : (
          renderEmptyComponent() || renderPoolsList()
        )}

        <View style={{ height: 80 }} />
      </ScrollView>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: themeColors.background }}>
      <StatusBar style={isDark ? "light" : "dark"} />
      {renderContent()}

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
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 40,
    minHeight: 200,
  },
  tabContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 2,
  },
  tabButton: {
    paddingHorizontal: 4,
    paddingVertical: 10,
    alignItems: "center",
    position: "relative",
    flex: 1,
    borderRadius: 12,
    marginHorizontal: 2,
    flexDirection: "row",
    justifyContent: "center",
  },
  activeTabButton: {
    paddingVertical: 10,
  },
  tabIcon: {
    marginRight: 3,
  },
  tabButtonText: {
    fontSize: 12,
    fontWeight: "500",
  },
  tabButtonIndicator: {
    position: "absolute",
    bottom: 0,
    height: 3,
    width: "40%",
    borderRadius: 1.5,
  },
  activeTabDetails: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.05)",
  },
  activeTabDescription: {
    fontSize: 13,
    opacity: 0.7,
    textAlign: "center",
  },
  dateSection: {
    marginBottom: 24,
  },
  dateHeaderContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  headerLine: {
    height: 1,
    flex: 1,
    opacity: 0.3,
  },
  dateColumn: {
    flexDirection: "row",
    alignItems: "baseline",
    marginHorizontal: 12,
  },
  day: {
    fontSize: 22,
    fontWeight: "600",
    marginRight: 4,
  },
  month: {
    fontSize: 16,
    fontWeight: "400",
  },
  poolCard: {
    flexDirection: "row",
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 12,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  poolCategoryIndicator: {
    width: 8, // Wider indicator
    opacity: 1,
  },
  poolContent: {
    flex: 1,
    padding: 12,
  },
  poolHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  poolCategory: {
    fontSize: 12,
    fontWeight: "500",
    opacity: 0.7,
  },
  statusContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  poolStatus: {
    fontSize: 12,
    fontWeight: "500",
    marginLeft: 4,
  },
  poolTitle: {
    fontSize: 17, // Increased from 16
    fontWeight: "700", // Increased from 600
    marginBottom: 8, // Increased from 6
    lineHeight: 22, // Added line height
    letterSpacing: -0.2, // Slight tightening of letter spacing
  },
  poolDescription: {
    fontSize: 14,
    marginBottom: 12,
    lineHeight: 20,
  },
  poolFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  footerItem: {
    flexDirection: "row",
    alignItems: "center",
  },
  footerText: {
    fontSize: 12,
    marginLeft: 4,
  },
  listLoadingContainer: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 160,
    marginHorizontal: 16,
    borderRadius: 16,
    padding: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
  },
  scrollContent: {
    paddingVertical: 16,
  },
  calendarContainer: {
    marginHorizontal: 16,
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 4,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(0, 0, 0, 0.04)",
  },
  calendarNote: {
    paddingHorizontal: 16,
    paddingTop: 0,
    paddingBottom: 8,
  },
  legendContainer: {
    paddingHorizontal: 16,
    paddingTop: 0,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.05)",
    marginTop: 0,
  },
  legendTitle: {
    fontSize: 14,
    fontWeight: "500",
    marginBottom: 8,
    marginTop: 12,
  },
  tabsCard: {
    marginHorizontal: 16,
    borderRadius: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    marginBottom: 16,
    paddingTop: 4,
    overflow: "hidden",
  },
  dateFilterIndicator: {
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 16,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  dateFilterText: {
    fontSize: 14,
    flex: 1,
  },
  legendScroll: {
    flexDirection: "row",
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 16,
  },
  legendColor: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 4,
  },
  legendText: {
    fontSize: 12,
  },
  skeletonContainer: {
    flex: 1,
    marginBottom: 16,
  },
  clearFilterButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
});
