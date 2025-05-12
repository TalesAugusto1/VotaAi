import React, {
  useEffect,
  useState,
  useCallback,
  useMemo,
  useRef,
} from "react";
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
  Modal,
  TextInput,
  Animated,
  Easing,
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
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [categorySearchText, setCategorySearchText] = useState("");
  const { visible, options, showModal, hideModal } = useModal();
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  const [dynamicCategoryColors, setDynamicCategoryColors] = useState<
    Record<string, string>
  >({});

  // Animation for category filter expansion
  const expandAnim = useRef(
    new Animated.Value(selectedCategory ? 1 : 0)
  ).current;

  // Add animation values for tab description and calendar note
  const tabDescriptionAnim = useRef(new Animated.Value(0)).current;
  const calendarNoteAnim = useRef(new Animated.Value(0)).current;

  // Update animation when selected category changes
  useEffect(() => {
    // Different configurations for opening and closing animations
    if (selectedCategory) {
      // Opening animation - quick start, then slow ease-out
      Animated.timing(expandAnim, {
        toValue: 1,
        duration: 300,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start();
    } else {
      // Closing animation - start slow, then accelerate
      Animated.timing(expandAnim, {
        toValue: 0,
        duration: 250, // Slightly faster collapse for better UX
        easing: Easing.bezier(0.4, 0.0, 0.2, 1), // Material Design standard easing
        useNativeDriver: false,
      }).start();
    }
  }, [selectedCategory, expandAnim]);

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

  // Handle tab change - now with animation
  const handleTabChange = useCallback(
    (tab: TabType) => {
      if (tab !== activeTab) {
        setActiveTab(tab);
        // Reset date filter when changing tabs
        setSelectedDate(null);

        // Animate tab description visibility
        if (tab === "all") {
          // Hide the description for "Todas" tab
          Animated.timing(tabDescriptionAnim, {
            toValue: 0,
            duration: 200,
            useNativeDriver: false,
          }).start();
        } else {
          // Show description for other tabs
          Animated.timing(tabDescriptionAnim, {
            toValue: 1,
            duration: 250,
            useNativeDriver: false,
          }).start();
        }
      }
    },
    [activeTab, tabDescriptionAnim]
  );

  // Add function to handle category selection
  const handleCategorySelect = useCallback((category: string) => {
    setSelectedCategory((prev) => (prev === category ? null : category));
    setShowCategoryModal(false); // Close modal after selection
  }, []);

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

  // Update calendar note animation when tab changes or pools are filtered
  useEffect(() => {
    // Show note when "Todas" is selected and there are more pools than shown in calendar
    if (activeTab === "all" && allPoolsData.length > calendarPools.length) {
      Animated.timing(calendarNoteAnim, {
        toValue: 1,
        duration: 300,
        delay: 100, // Slight delay for better UX
        useNativeDriver: false,
      }).start();
    } else {
      // Hide note otherwise
      Animated.timing(calendarNoteAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: false,
      }).start();
    }
  }, [activeTab, allPoolsData.length, calendarPools.length, calendarNoteAnim]);

  // Function to navigate to the pool details screen
  const handleOpenPool = useCallback(
    (poolId: string) => {
      router.push(`/pool/${poolId}`);
    },
    [router]
  );

  // Memoize grouped pools to avoid recalculation
  const { groupedPools, dateKeys } = useMemo(() => {
    const grouped = groupPoolsByDate(getFilteredPools);
    const sortedKeys = Object.keys(grouped).sort((a, b) => {
      return new Date(a).getTime() - new Date(b).getTime();
    });
    return { groupedPools: grouped, dateKeys: sortedKeys };
  }, [getFilteredPools]);

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

  // Replace the current renderCategoryFilter function
  const renderCategoryFilter = () => {
    if (loading || allPoolsData.length === 0) return null;

    // Get all categories for filtering
    const categories = getCategoriesWithColors(filteredPoolsByTab);

    // If no categories found, don't show the filter
    if (Object.keys(categories).length === 0) return null;

    // Interpolate height and opacity for animation
    const contentHeight = expandAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [0, 40],
    });

    const contentOpacity = expandAnim.interpolate({
      inputRange: [0, 0.3, 1],
      outputRange: [0, 0, 1],
    });

    const scale = expandAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [0.95, 1],
    });

    // Interpolate bottom padding for the container to remove space when collapsed
    const paddingBottom = expandAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [0, 16],
    });

    return (
      <Animated.View
        style={[
          styles.categoryFilterCard,
          {
            backgroundColor: isDark ? "#1C1C1E" : "#FFFFFF",
            paddingBottom: paddingBottom,
            justifyContent: "center", // Center content vertically
            minHeight: 60, // Ensure consistent minimum height
          },
        ]}
      >
        <TouchableOpacity
          style={[
            styles.categoryFilterHeader,
            { paddingVertical: 10 }, // Add padding for better touch target
          ]}
          onPress={() => setShowCategoryModal(true)}
          activeOpacity={0.7}
        >
          <Text
            style={[styles.categoryFilterTitle, { color: themeColors.text }]}
          >
            Filtrar por categoria
          </Text>

          {selectedCategory ? (
            <TouchableOpacity
              style={[
                styles.clearCategoryButton,
                {
                  backgroundColor: isDark
                    ? "rgba(255, 255, 255, 0.08)"
                    : "rgba(0, 0, 0, 0.04)",
                },
              ]}
              onPress={(e) => {
                e.stopPropagation(); // Prevent triggering the parent TouchableOpacity
                setSelectedCategory(null);
              }}
            >
              <Text style={{ color: themeColors.tint, fontSize: 12 }}>
                Limpar
              </Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.chevronContainer}>
              <Ionicons
                name="chevron-down"
                size={16}
                color={
                  isDark ? "rgba(255, 255, 255, 0.5)" : "rgba(0, 0, 0, 0.3)"
                }
              />
            </View>
          )}
        </TouchableOpacity>

        <Animated.View
          style={[
            styles.selectedCategoryContainer,
            {
              height: contentHeight,
              opacity: contentOpacity,
              overflow: "hidden",
              transform: [{ scale }],
              marginTop: expandAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 12],
              }),
            },
          ]}
        >
          <View style={styles.categoryBadgeRow}>
            {selectedCategory && (
              <>
                <View
                  style={[
                    styles.categoryColorDot,
                    {
                      backgroundColor: getPoolColor({
                        category: selectedCategory,
                      } as VotingPool),
                    },
                  ]}
                />
                <Text
                  style={[
                    styles.selectedCategoryText,
                    { color: themeColors.text },
                  ]}
                >
                  {selectedCategory}
                </Text>
              </>
            )}
          </View>
        </Animated.View>
      </Animated.View>
    );
  };

  // Create the category selector modal component
  const CategorySelectorModal = () => {
    // Get all categories for filtering
    const categories = getCategoriesWithColors(filteredPoolsByTab);
    const categoryEntries = Object.entries(categories);

    // Group categories by type for better organization
    const categoryGroups: Record<string, string[]> = {
      Governamentais: [
        "Governo Federal",
        "Governo Estadual",
        "Prefeitura",
        "Congresso Nacional",
        "Assembleia Legislativa",
        "Câmara Municipal",
        "Políticas Públicas",
      ],
      Comunitárias: [
        "Associação de Moradores",
        "Conselho Comunitário",
        "Bairro",
        "Condomínio",
        "Grêmio Estudantil",
        "Diretório Acadêmico",
      ],
      Setoriais: [
        "Educação",
        "Saúde",
        "Meio Ambiente",
        "Transporte",
        "Segurança",
        "Cultura",
        "Esporte",
        "Lazer",
        "Tecnologia",
        "Economia",
        "Agricultura",
        "Indústria",
        "Comércio",
        "Serviços",
      ],
      Outras: [], // Will hold any categories not in defined groups
    };

    // Filter categories based on search
    const filteredCategories = categoryEntries.filter(
      ([category]) =>
        !categorySearchText ||
        category.toLowerCase().includes(categorySearchText.toLowerCase())
    );

    // Sort categories into groups
    const organizedCategories: Record<string, [string, string][]> = {
      Governamentais: [],
      Comunitárias: [],
      Setoriais: [],
      Outras: [],
    };

    filteredCategories.forEach(([category, color]) => {
      let placed = false;

      // Check each predefined group
      Object.keys(categoryGroups).forEach((groupName) => {
        if (categoryGroups[groupName].includes(category)) {
          organizedCategories[groupName].push([category, color]);
          placed = true;
        }
      });

      // If not in any predefined group, put in "Outras"
      if (!placed) {
        organizedCategories["Outras"].push([category, color]);
      }
    });

    // Count total categories in each group
    const groupCounts: Record<string, number> = {};
    Object.keys(organizedCategories).forEach((group) => {
      groupCounts[group] = organizedCategories[group].length;
    });

    // Track if search is active to skip empty group headers
    const isSearchActive = categorySearchText.length > 0;

    return (
      <Modal
        animationType="slide"
        transparent={true}
        visible={showCategoryModal}
        onRequestClose={() => setShowCategoryModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalContent,
              { backgroundColor: isDark ? "#1C1C1E" : "#FFFFFF" },
            ]}
          >
            <View style={styles.modalHeader}>
              <TouchableOpacity
                style={styles.closeButtonTop}
                onPress={() => setShowCategoryModal(false)}
              >
                <Ionicons
                  name="chevron-down"
                  size={26}
                  color={themeColors.text}
                />
              </TouchableOpacity>
              <Text style={[styles.modalTitle, { color: themeColors.text }]}>
                Selecionar Categoria
              </Text>
              <TouchableOpacity
                onPress={() => setShowCategoryModal(false)}
                style={styles.closeButton}
              >
                <Text style={{ color: themeColors.tint, fontWeight: "500" }}>
                  Concluído
                </Text>
              </TouchableOpacity>
            </View>

            <View
              style={[
                styles.searchContainer,
                {
                  backgroundColor: isDark
                    ? "rgba(255, 255, 255, 0.1)"
                    : "rgba(0, 0, 0, 0.05)",
                  borderColor: isDark
                    ? "rgba(255, 255, 255, 0.1)"
                    : "rgba(0, 0, 0, 0.05)",
                },
              ]}
            >
              <Ionicons
                name="search"
                size={18}
                color={
                  isDark ? "rgba(255, 255, 255, 0.6)" : "rgba(0, 0, 0, 0.4)"
                }
                style={{ marginRight: 8 }}
              />
              <TextInput
                style={[styles.searchInput, { color: themeColors.text }]}
                placeholder="Buscar categoria..."
                placeholderTextColor={
                  isDark ? "rgba(255, 255, 255, 0.4)" : "rgba(0, 0, 0, 0.4)"
                }
                value={categorySearchText}
                onChangeText={setCategorySearchText}
                autoCapitalize="none"
                autoCorrect={false}
              />
              {categorySearchText.length > 0 && (
                <TouchableOpacity onPress={() => setCategorySearchText("")}>
                  <Ionicons
                    name="close-circle"
                    size={18}
                    color={
                      isDark ? "rgba(255, 255, 255, 0.6)" : "rgba(0, 0, 0, 0.4)"
                    }
                  />
                </TouchableOpacity>
              )}
            </View>

            {selectedCategory && (
              <View style={styles.selectedCategoryContainer}>
                <Text
                  style={[
                    styles.selectedCategoryLabel,
                    { color: themeColors.text },
                  ]}
                >
                  Categoria selecionada:
                </Text>
                <View
                  style={[
                    styles.selectedCategoryBadge,
                    {
                      backgroundColor: getPoolColor({
                        category: selectedCategory,
                      } as VotingPool),
                    },
                  ]}
                >
                  <Text style={styles.selectedCategoryText}>
                    {selectedCategory}
                  </Text>
                  <TouchableOpacity
                    onPress={() => setSelectedCategory(null)}
                    style={styles.clearSelectedCategory}
                  >
                    <Ionicons
                      name="close-circle"
                      size={18}
                      color="rgba(255,255,255,0.9)"
                    />
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {filteredCategories.length === 0 ? (
              <View style={styles.noResultsContainer}>
                <Ionicons
                  name="search-outline"
                  size={48}
                  color={isDark ? "rgba(255,255,255,0.3)" : "rgba(0,0,0,0.2)"}
                />
                <Text
                  style={[styles.noResultsText, { color: themeColors.text }]}
                >
                  Nenhuma categoria encontrada
                </Text>
                <TouchableOpacity
                  style={[
                    styles.resetSearchButton,
                    { backgroundColor: themeColors.tint },
                  ]}
                  onPress={() => setCategorySearchText("")}
                >
                  <Text style={{ color: "white", fontWeight: "500" }}>
                    Limpar busca
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              <ScrollView
                style={styles.categoriesList}
                showsVerticalScrollIndicator={false}
              >
                {Object.keys(organizedCategories).map((groupName) => {
                  // Skip empty groups
                  if (organizedCategories[groupName].length === 0) return null;

                  return (
                    <View key={groupName} style={styles.categoryGroup}>
                      {/* Only show group header if not searching or if group has items */}
                      {(!isSearchActive ||
                        organizedCategories[groupName].length > 0) && (
                        <View style={styles.categoryGroupHeader}>
                          <Text
                            style={[
                              styles.categoryGroupTitle,
                              { color: themeColors.text },
                            ]}
                          >
                            {groupName}
                            <Text style={styles.categoryGroupCount}>
                              {" "}
                              ({organizedCategories[groupName].length})
                            </Text>
                          </Text>
                        </View>
                      )}

                      {organizedCategories[groupName].map(
                        ([category, color]) => (
                          <TouchableOpacity
                            key={category}
                            style={[
                              styles.categoryListItem,
                              selectedCategory === category && {
                                backgroundColor: isDark
                                  ? "rgba(255, 255, 255, 0.1)"
                                  : "rgba(0, 0, 0, 0.05)",
                                borderColor: themeColors.tint,
                                borderWidth: 1,
                              },
                            ]}
                            onPress={() => handleCategorySelect(category)}
                            activeOpacity={0.7}
                          >
                            <View style={styles.categoryColorRow}>
                              <View
                                style={[
                                  styles.categoryColorIndicator,
                                  { backgroundColor: color },
                                ]}
                              />
                              <Text
                                style={[
                                  styles.categoryListItemText,
                                  { color: themeColors.text },
                                  selectedCategory === category && {
                                    fontWeight: "600",
                                  },
                                ]}
                              >
                                {category}
                              </Text>
                            </View>

                            {selectedCategory === category ? (
                              <View style={styles.selectedIndicator}>
                                <Ionicons
                                  name="checkmark-circle"
                                  size={22}
                                  color={themeColors.tint}
                                />
                              </View>
                            ) : (
                              <View
                                style={[
                                  styles.selectCircle,
                                  {
                                    borderColor: isDark
                                      ? "rgba(255, 255, 255, 0.3)"
                                      : "rgba(0, 0, 0, 0.2)",
                                  },
                                ]}
                              />
                            )}
                          </TouchableOpacity>
                        )
                      )}
                    </View>
                  );
                })}
                <View style={{ height: 30 }} />
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
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

        <PoolCalendar
          pools={calendarPools} // Use the memoized pools
          onDateSelect={handleDateSelect}
          selectedDate={selectedDate}
          disabled={loading && allPoolIds.length === 0}
        />

        {/* Animated calendar note */}
        <Animated.View
          style={[
            styles.calendarNote,
            {
              opacity: calendarNoteAnim,
              maxHeight: calendarNoteAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 40],
              }),
              transform: [
                {
                  translateY: calendarNoteAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-5, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <Text
            style={{
              color: themeColors.text,
              fontSize: 12,
              fontStyle: "italic",
              opacity: 0.7,
              textAlign: "center",
            }}
          >
            Mostrando votações prioritárias no calendário. Utilize os filtros
            para ver mais detalhes.
          </Text>
        </Animated.View>

        {/* Category filter - moved above tab filters */}
        {renderCategoryFilter()}

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
          <Animated.View
            style={[
              styles.activeTabDetails,
              {
                maxHeight: tabDescriptionAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 40],
                }),
                opacity: tabDescriptionAnim,
                overflow: "hidden",
                borderTopWidth: tabDescriptionAnim.interpolate({
                  inputRange: [0, 0.5, 1],
                  outputRange: [0, 0, 1],
                }),
                borderTopColor: "rgba(0,0,0,0.05)",
              },
            ]}
          >
            <Text
              style={[styles.activeTabDescription, { color: themeColors.text }]}
            >
              {activeTab === "active"
                ? "Mostrando votações em andamento"
                : activeTab === "upcoming"
                ? "Mostrando votações agendadas para o futuro"
                : "Mostrando votações já encerradas"}
            </Text>
          </Animated.View>
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
      <CategorySelectorModal />

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
  categoryFilterCard: {
    marginHorizontal: 16,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingTop: 0, // Remove top padding
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
    marginBottom: 16,
    overflow: "hidden",
  },
  categoryFilterHeaderContainer: {
    flex: 1,
    justifyContent: "center",
    minHeight: 60, // Ensure minimum height for vertical centering
  },
  categoryFilterHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  categoryFilterTitle: {
    fontSize: 16,
    fontWeight: "600",
  },
  clearCategoryButton: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  selectCategoryButton: {
    paddingVertical: 10,
    paddingHorizontal: 2,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  selectedCategoryContainer: {
    justifyContent: "center",
  },
  categoryBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  categoryColorDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  selectedCategoryText: {
    fontWeight: "500",
    fontSize: 15,
  },
  selectedCategoryLabel: {
    fontSize: 14,
    marginBottom: 8,
  },
  clearSelectedCategory: {
    padding: 4,
  },
  selectedCategoryBadge: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end", // Modal slides up from bottom
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 24,
    maxHeight: "90%", // Increased max height
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0, 0, 0, 0.05)",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "600",
    textAlign: "center",
  },
  closeButtonTop: {
    padding: 4,
  },
  closeButton: {
    padding: 4,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 16,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 4,
  },
  categoriesList: {
    paddingHorizontal: 16,
  },
  categoryGroup: {
    marginBottom: 16,
  },
  categoryGroupHeader: {
    marginBottom: 8,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0, 0, 0, 0.05)",
  },
  categoryGroupTitle: {
    fontSize: 15,
    fontWeight: "700",
  },
  categoryGroupCount: {
    fontWeight: "400",
    opacity: 0.6,
  },
  categoryListItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "transparent",
  },
  categoryColorRow: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  categoryColorIndicator: {
    width: 20,
    height: 20,
    borderRadius: 10,
    marginRight: 12,
  },
  categoryListItemText: {
    fontSize: 16,
  },
  noResultsContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 40,
    paddingBottom: 40,
  },
  noResultsText: {
    textAlign: "center",
    fontSize: 16,
    opacity: 0.7,
    marginVertical: 16,
  },
  resetSearchButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    marginTop: 16,
  },
  selectedIndicator: {
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: "center",
    alignItems: "center",
  },
  selectCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1,
  },
  chevronContainer: {
    padding: 4,
  },
});
