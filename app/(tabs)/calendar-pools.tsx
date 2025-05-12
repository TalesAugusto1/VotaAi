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
import { useRouter } from "expo-router";

function groupPoolsByDate(pools: VotingPool[]) {
  const grouped: { [key: string]: VotingPool[] } = {};
  pools.forEach((pool) => {
    try {
      // Use start date for upcoming and active, end date for closed
      // Add null checks to prevent accessing properties of undefined
      const startDate = pool.startDate ? parseISO(pool.startDate) : new Date();
      const endDate = pool.endDate ? parseISO(pool.endDate) : new Date();

      const dateToUse = pool.status === "closed" ? endDate : startDate;

      const key = format(dateToUse, "yyyy-MM-dd");
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(pool);
    } catch (error) {
      console.error("Error grouping pool by date:", error, pool);
      // Skip this pool if there's an error
    }
  });
  return grouped;
}

function getDateParts(dateString: string) {
  try {
    if (!dateString) {
      // Return default values if dateString is undefined or empty
      return { day: "--", month: "----" };
    }
    const date = parseISO(dateString);
    const day = format(date, "d", { locale: ptBR });
    const month = format(date, "MMMM", { locale: ptBR });
    return { day, month };
  } catch (error) {
    console.error("Error parsing date:", error, dateString);
    return { day: "--", month: "----" };
  }
}

type TabType = "all" | "active" | "upcoming" | "closed";

// Filter pools to show in calendar based on active tab
// This helps prevent information overload when "Todas" is selected
const getCalendarPools = (allLoadedPools: VotingPool[], activeTab: TabType) => {
  // For non-"all" tabs, just show the filtered pools as before
  if (activeTab !== "all") {
    return allLoadedPools.filter((pool) => pool.status === activeTab);
  }

  // For "all" tab, prioritize showing the most recent and upcoming pools
  // Filter to active and soon-to-start pools to avoid overcrowding the calendar
  return allLoadedPools.filter((pool) => {
    // Always include active pools
    if (pool.status === "active") return true;

    // Include upcoming pools starting in the next 7 days
    if (pool.status === "upcoming") {
      const startDate = parseISO(pool.startDate);
      const now = new Date();
      const diffInDays = Math.floor(
        (startDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );
      return diffInDays <= 7;
    }

    // Include closed pools from the last 3 days
    if (pool.status === "closed") {
      const endDate = parseISO(pool.endDate);
      const now = new Date();
      const diffInDays = Math.floor(
        (now.getTime() - endDate.getTime()) / (1000 * 60 * 60 * 24)
      );
      return diffInDays <= 3;
    }

    return false;
  });
};

// We'll use a more focused approach to get colors for categories
const getCategoriesWithColors = (pools: VotingPool[]) => {
  const categories: Record<string, string> = {};

  // Get unique categories from pools
  const uniqueCategories = Array.from(
    new Set(pools.map((pool) => pool.category))
  ).filter(Boolean);

  // Get color for each category using the same function that colors the pools
  uniqueCategories.forEach((category) => {
    // Create a dummy pool with just this category
    const dummyPool = { category } as VotingPool;
    // Use the same getPoolColor function that's used in the calendar and pool cards
    categories[category] = getPoolColor(dummyPool);
  });

  return categories;
};

export default function CalendarPoolsScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const themeColors = Colors[isDark ? "dark" : "light"];
  const router = useRouter();

  const [allPoolsData, setAllPoolsData] = useState<VotingPool[]>([]); // Store all pools in one array
  const [allPoolIds, setAllPoolIds] = useState<string[]>([]);
  const [loadedPools, setLoadedPools] = useState<Record<string, VotingPool>>(
    {}
  );
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>("all");
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const { visible, options, showModal, hideModal } = useModal();
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  const [dynamicCategoryColors, setDynamicCategoryColors] = useState<
    Record<string, string>
  >({});

  // Fetch pools from API - optimized to load all data at once
  const fetchPools = async (forceRefresh = false, page = 1) => {
    try {
      if (
        (Object.keys(loadedPools).length === 0 || forceRefresh) &&
        page === 1
      ) {
        setLoading(true);
      }

      if (forceRefresh && page === 1) {
        setLoadedPools({});
        setAllPoolsData([]);
      }

      // Fetch active, upcoming, and closed pools in parallel
      const [activePools, upcomingPools, closedPools] = await Promise.all([
        votingPoolsApi.getActiveVotingPools(forceRefresh, page),
        votingPoolsApi.getUpcomingVotingPools(forceRefresh, page),
        votingPoolsApi.getClosedVotingPools(forceRefresh, page),
      ]);

      // Combine all the data
      const allPools = [
        ...activePools.data,
        ...upcomingPools.data,
        ...closedPools.data,
      ];

      // Save all the IDs
      const poolIds = allPools.map((pool) => pool.id);

      // Set total pages to the maximum of the three pool types
      const maxTotalPages = Math.max(
        activePools.pagination.totalPages,
        upcomingPools.pagination.totalPages,
        closedPools.pagination.totalPages
      );

      setTotalPages(maxTotalPages);

      // Update all pool IDs
      if (page === 1) {
        setAllPoolIds(poolIds);
      } else {
        setAllPoolIds((prev) => [
          ...prev,
          ...poolIds.filter((id) => !prev.includes(id)),
        ]);
      }

      if (poolIds.length === 0) {
        setLoading(false);
        setIsLoadingMore(false);
        setInitialLoadComplete(true);
        return;
      }

      // Convert array to record for faster lookup
      const poolsRecord: Record<string, VotingPool> = {};
      allPools.forEach((pool) => {
        poolsRecord[pool.id] = pool;
      });

      // Update state
      if (page === 1) {
        setLoadedPools(poolsRecord);
        setAllPoolsData(allPools);
      } else {
        setLoadedPools((prev) => ({ ...prev, ...poolsRecord }));
        setAllPoolsData((prev) => [
          ...prev,
          ...allPools.filter((pool) => !prev.some((p) => p.id === pool.id)),
        ]);
      }

      setError(null);
      setLoading(false);
      setIsLoadingMore(false);
      setInitialLoadComplete(true);
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
      setAllPoolsData([]);
      setLoading(false);
      setIsLoadingMore(false);
      setInitialLoadComplete(true);
    }
  };

  // Filter pools by tab type - now computed with useMemo to avoid recalculations
  const filteredPoolsByTab = useMemo(() => {
    if (activeTab === "all") {
      return allPoolsData;
    }
    return allPoolsData.filter((pool) => pool.status === activeTab);
  }, [allPoolsData, activeTab]);

  // Filter pools by date - also using useMemo
  const filterPoolsByDate = useCallback(
    (date: Date | null, pools: VotingPool[]) => {
      // When no date is selected, we don't need to filter
      if (!date) return pools;

      // Filter pools that are active on the selected date
      return pools.filter((pool) => {
        try {
          // Add null checks to prevent errors
          if (!pool.startDate || !pool.endDate) return false;

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
    },
    []
  );

  // Replace the updateDynamicCategoryColors function with a version that directly uses getPoolColor
  const updateDynamicCategoryColors = useCallback((pools: VotingPool[]) => {
    // Extract unique categories from the current pools
    const uniqueCategories = Array.from(
      new Set(pools.map((pool) => pool.category))
    ).filter(Boolean);

    // Create a map of categories to colors using the same getPoolColor function
    // that's used to color the pools in the calendar
    const categoryColorMap: Record<string, string> = {};

    uniqueCategories.forEach((category) => {
      // Create a dummy pool with just the category to get its color
      const dummyPool = { category } as VotingPool;
      categoryColorMap[category] = getPoolColor(dummyPool);
    });

    setDynamicCategoryColors(categoryColorMap);
  }, []);

  // Update dynamic categories when allPoolsData changes
  useEffect(() => {
    if (allPoolsData.length > 0) {
      updateDynamicCategoryColors(allPoolsData);
    }
  }, [allPoolsData, updateDynamicCategoryColors]);

  // Add a filter function for categories
  const filterPoolsByCategory = useCallback(
    (pools: VotingPool[]) => {
      if (!selectedCategory) return pools;
      return pools.filter((pool) => pool.category === selectedCategory);
    },
    [selectedCategory]
  );

  // Modify getFilteredPools to include category filtering
  const getFilteredPools = useMemo(() => {
    try {
      // First filter by date
      const dateFilteredPools = filterPoolsByDate(
        selectedDate,
        filteredPoolsByTab
      );

      // Then filter by category if one is selected
      const categoryFilteredPools = filterPoolsByCategory(dateFilteredPools);

      // When pools change, update the dynamic categories
      if (categoryFilteredPools.length > 0) {
        updateDynamicCategoryColors(categoryFilteredPools);
      }

      // Sort pools by date
      return categoryFilteredPools.sort((a, b) => {
        try {
          // For upcoming and active pools, sort by start date
          // For closed pools, sort by end date
          const dateA =
            a.status === "closed" && a.endDate
              ? parseISO(a.endDate).getTime()
              : a.startDate
              ? parseISO(a.startDate).getTime()
              : 0;

          const dateB =
            b.status === "closed" && b.endDate
              ? parseISO(b.endDate).getTime()
              : b.startDate
              ? parseISO(b.startDate).getTime()
              : 0;

          return dateA - dateB;
        } catch (error) {
          console.error("Error sorting pools by date:", error, { a, b });
          return 0;
        }
      });
    } catch (error) {
      console.error("Error in getFilteredPools:", error);
      return [];
    }
  }, [
    filteredPoolsByTab,
    selectedDate,
    filterPoolsByDate,
    updateDynamicCategoryColors,
    selectedCategory,
    filterPoolsByCategory,
  ]);

  const handleDateSelect = useCallback((date: Date | null) => {
    setSelectedDate(date);
  }, []);

  // Load more function for pagination
  const handleLoadMore = useCallback(() => {
    if (currentPage < totalPages && !isLoadingMore) {
      setIsLoadingMore(true);
      setCurrentPage((prev) => prev + 1);
      fetchPools(false, currentPage + 1);
    }
  }, [currentPage, totalPages, isLoadingMore]);

  // Load data only once when component mounts
  useEffect(() => {
    fetchPools(false, 1);
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setCurrentPage(1);
    await fetchPools(true, 1);
    setRefreshing(false);
  }, []);

  // Handle tab change - now just sets state without triggering API calls
  const handleTabChange = useCallback(
    (tab: TabType) => {
      if (tab !== activeTab) {
        setActiveTab(tab);
        // Reset date filter when changing tabs
        setSelectedDate(null);
      }
    },
    [activeTab]
  );

  // Function to handle category selection
  const handleCategorySelect = useCallback((category: string) => {
    setSelectedCategory((prev) => (prev === category ? null : category));
  }, []);

  // Memoize grouped pools to avoid recalculation
  const { groupedPools, dateKeys } = useMemo(() => {
    const grouped = groupPoolsByDate(getFilteredPools);
    const sortedKeys = Object.keys(grouped).sort((a, b) => {
      return new Date(a).getTime() - new Date(b).getTime();
    });
    return { groupedPools: grouped, dateKeys: sortedKeys };
  }, [getFilteredPools]);

  // Memoize calendar pools to use the filtered pools instead of all pools
  const calendarPools = useMemo(() => {
    // If a date or category is selected, use the filtered pools to show only those in the calendar
    if (selectedDate || selectedCategory) {
      return getFilteredPools;
    }

    // Otherwise use the getCalendarPools with filtering logic
    return getCalendarPools(
      activeTab === "all" ? allPoolsData : filteredPoolsByTab,
      activeTab
    );
  }, [
    allPoolsData,
    activeTab,
    filteredPoolsByTab,
    selectedDate,
    selectedCategory,
    getFilteredPools,
  ]);

  // Function to navigate to the pool details screen
  const handleOpenPool = useCallback(
    (poolId: string) => {
      router.push(`/pool/${poolId}`);
    },
    [router]
  );

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
    if (Object.keys(loadedPools).length > 0 && getFilteredPools.length === 0) {
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
                <TouchableOpacity
                  key={pool.id}
                  style={[
                    styles.poolCard,
                    {
                      backgroundColor: isDark ? "#1C1C1E" : "#FFFFFF",
                      shadowOpacity: isDark ? 0.3 : 0.1,
                    },
                  ]}
                  activeOpacity={0.7}
                  onPress={() => handleOpenPool(pool.id)}
                >
                  {/* Category color indicator */}
                  <View
                    style={[
                      styles.poolCategoryIndicator,
                      {
                        backgroundColor: getPoolColor(pool),
                        opacity: isDark ? 0.9 : 1,
                        shadowColor: "#000",
                        shadowOffset: { width: 0, height: 1 },
                        shadowOpacity: 0.2,
                        shadowRadius: 1,
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
                          {(() => {
                            try {
                              if (
                                pool.status === "upcoming" &&
                                pool.startDate
                              ) {
                                return `Inicia em ${format(
                                  parseISO(pool.startDate),
                                  "dd/MM/yyyy"
                                )}`;
                              } else if (
                                pool.status === "closed" &&
                                pool.endDate
                              ) {
                                return `Encerrada em ${format(
                                  parseISO(pool.endDate),
                                  "dd/MM/yyyy"
                                )}`;
                              } else if (pool.endDate) {
                                return `Termina em ${format(
                                  parseISO(pool.endDate),
                                  "dd/MM/yyyy"
                                )}`;
                              } else {
                                return "Data indisponível";
                              }
                            } catch (error) {
                              console.error("Error formatting date:", error);
                              return "Data indisponível";
                            }
                          })()}
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
                          {(() => {
                            const voteCount = pool.options.reduce(
                              (sum, option) => sum + (option.voteCount || 0),
                              0
                            );
                            return isNaN(voteCount) ? "" : `${voteCount} votos`;
                          })()}
                        </Text>
                      </View>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          );
        })}
      </>
    );
  };

  const renderCategoryLegend = () => {
    if (loading || allPoolsData.length === 0) return null;

    // Use the filtered pools to get categories - this ensures we only show categories that are present in the current view
    const categories = getCategoriesWithColors(
      // Use filteredPoolsByTab instead of getFilteredPools to show all available categories
      // even when a category filter is applied
      selectedCategory ? filteredPoolsByTab : getFilteredPools
    );

    // If no categories found in the filtered pools, don't show the legend
    if (Object.keys(categories).length === 0) return null;

    return (
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
        <View style={styles.legendHeader}>
          <Text style={[styles.legendTitle, { color: themeColors.text }]}>
            {selectedDate
              ? "Categorias nesta data:"
              : activeTab === "all"
              ? "Filtrar por categoria:"
              : `Categorias ${
                  activeTab === "active"
                    ? "ativas"
                    : activeTab === "upcoming"
                    ? "futuras"
                    : "encerradas"
                }:`}
          </Text>
          {selectedCategory && (
            <TouchableOpacity
              style={[
                styles.clearCategoryButton,
                {
                  backgroundColor: isDark
                    ? "rgba(255, 255, 255, 0.1)"
                    : "rgba(0, 0, 0, 0.05)",
                },
              ]}
              onPress={() => setSelectedCategory(null)}
            >
              <Text style={{ color: themeColors.tint, fontSize: 12 }}>
                Limpar filtro
              </Text>
            </TouchableOpacity>
          )}
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.legendScroll}
        >
          {Object.entries(categories).map(([category, color]) => (
            <TouchableOpacity
              key={category}
              style={[
                styles.legendItem,
                selectedCategory === category && {
                  backgroundColor: isDark
                    ? "rgba(255, 255, 255, 0.1)"
                    : "rgba(0, 0, 0, 0.05)",
                  borderRadius: 16,
                  padding: 4,
                  paddingHorizontal: 8,
                },
              ]}
              onPress={() => handleCategorySelect(category)}
              activeOpacity={0.7}
            >
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
                style={[
                  styles.legendText,
                  {
                    color: themeColors.text,
                    fontWeight: selectedCategory === category ? "600" : "400",
                  },
                ]}
              >
                {category}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    );
  };

  const renderContent = () => {
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
        onScroll={({ nativeEvent }) => {
          // Auto load more when reaching the bottom of the scroll
          const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
          const paddingToBottom = 20;
          const isCloseToBottom =
            layoutMeasurement.height + contentOffset.y >=
            contentSize.height - paddingToBottom;

          if (isCloseToBottom && !isLoadingMore && currentPage < totalPages) {
            handleLoadMore();
          }
        }}
        scrollEventThrottle={400}
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
            pools={calendarPools} // Use the memoized pools
            onDateSelect={handleDateSelect}
            selectedDate={selectedDate}
            disabled={loading && allPoolIds.length === 0}
          />

          {/* Additional note when "Todas" is selected and pools are limited */}
          {activeTab === "all" &&
            allPoolsData.length > calendarPools.length && (
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

          {/* Render the category legend using our new function */}
          {renderCategoryLegend()}
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

        {/* Category filter indicator */}
        {selectedCategory && !selectedDate && (
          <View
            style={[
              styles.dateFilterIndicator,
              { backgroundColor: isDark ? "#1C1C1E" : "#FFFFFF" },
            ]}
          >
            <Text style={[styles.dateFilterText, { color: themeColors.text }]}>
              Filtrando por categoria{" "}
              <Text
                style={{
                  fontWeight: "600",
                  color: getPoolColor({
                    category: selectedCategory,
                  } as VotingPool),
                }}
              >
                {selectedCategory}
              </Text>
            </Text>
            <TouchableOpacity
              style={styles.clearFilterButton}
              onPress={() => setSelectedCategory(null)}
            >
              <Text style={{ color: themeColors.tint }}>Limpar</Text>
            </TouchableOpacity>
          </View>
        )}

        {loading && !initialLoadComplete ? (
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

        {/* Add "Load More" button at the end */}
        {renderLoadMoreButton()}

        <View style={{ height: 80 }} />
      </ScrollView>
    );
  };

  // Add "Load More" button at the bottom of the pools list
  const renderLoadMoreButton = () => {
    if (currentPage < totalPages) {
      return (
        <TouchableOpacity
          style={[
            styles.loadMoreButton,
            { backgroundColor: isDark ? "#1C1C1E" : "#FFFFFF" },
          ]}
          onPress={handleLoadMore}
          disabled={isLoadingMore}
        >
          {isLoadingMore ? (
            <ActivityIndicator size="small" color={themeColors.tint} />
          ) : (
            <Text style={{ color: themeColors.tint }}>Carregar mais</Text>
          )}
        </TouchableOpacity>
      );
    }
    return null;
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
    width: 12, // Increased width for better visibility
    opacity: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1,
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
    width: 16,
    height: 16,
    borderRadius: 8,
    marginRight: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1,
    elevation: 2,
  },
  legendText: {
    fontSize: 13,
    fontWeight: "500",
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
  loadMoreButton: {
    padding: 16,
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  legendHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  clearCategoryButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
});
