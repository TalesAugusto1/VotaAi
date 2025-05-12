import React, { useState, useEffect, ReactNode } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  useColorScheme,
} from "react-native";
import {
  format,
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  getDay,
  isToday,
  isSameDay,
  parseISO,
  startOfDay,
  isWithinInterval,
  compareAsc,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { Ionicons } from "@expo/vector-icons";
import { VotingPool } from "../types";

// Update the CATEGORY_COLORS to use more user-friendly colors
export const CATEGORY_COLORS: Record<string, string> = {
  Associação: "#F087B3", // Softer pink
  Comunidade: "#75D085", // Softer green
  Municipal: "#FFD966", // Softer yellow
  Estadual: "#64B5F6", // Softer blue
  Federal: "#B39DDB", // Softer purple
  Educação: "#FFAB91", // Softer orange
  Saúde: "#80DEEA", // Softer cyan
  Esporte: "#EF9A9A", // Softer red
  Cultura: "#9FA8DA", // Softer indigo
  default: "#E0E0E0", // Light gray
};

// Helper function to get a pastel color based on pool category or id
export const getPoolColor = (pool: VotingPool): string => {
  // Check if pool is valid
  if (!pool) {
    return CATEGORY_COLORS.default;
  }

  // Return the color for the category if it exists - this is the priority
  if (pool.category && CATEGORY_COLORS[pool.category]) {
    return CATEGORY_COLORS[pool.category];
  }

  // If the pool has a category but it's not in our predefined colors,
  // we'll still derive a consistent color for that category
  if (pool.category) {
    // Generate a hash from the category name for consistent color
    let hash = 0;
    for (let i = 0; i < pool.category.length; i++) {
      hash = pool.category.charCodeAt(i) + ((hash << 5) - hash);
    }

    // Get the predefined colors (excluding default)
    const colorValues = Object.values(CATEGORY_COLORS).filter(
      (color) => color !== CATEGORY_COLORS.default
    );

    // Use the hash to pick a consistent color
    const colorIndex = Math.abs(hash) % colorValues.length;
    return colorValues[colorIndex];
  }

  // Last resort: generate a color based on the pool ID
  const poolId = pool.id;
  if (!poolId) {
    return CATEGORY_COLORS.default;
  }

  const categories = Object.keys(CATEGORY_COLORS).filter(
    (c) => c !== "default"
  );
  const index = parseInt(poolId.substring(0, 8), 16) % categories.length;
  return CATEGORY_COLORS[categories[index]] || CATEGORY_COLORS.default;
};

interface PoolCalendarProps {
  pools: VotingPool[];
  onDateSelect: (date: Date | null) => void;
  selectedDate: Date | null;
  disabled?: boolean;
}

interface DayInfo {
  date: Date;
  isCurrentDay: boolean;
  hasPool: boolean;
  poolColors: string[];
}

const PoolCalendar: React.FC<PoolCalendarProps> = ({
  pools,
  onDateSelect,
  selectedDate,
  disabled,
}) => {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const themeColors = {
    card: isDark ? "#1C1C1E" : "#FFFFFF",
    text: isDark ? "#FFFFFF" : "#11181C",
    shadow: "#000000",
  };

  const [currentMonth, setCurrentMonth] = useState(() => {
    // Find the month of the most recent active pool
    const now = new Date();
    if (pools.length === 0) return now;

    const activePools = pools.filter((p) => p.status === "active");
    if (activePools.length === 0) return now;

    const poolDates = activePools.map((pool) => parseISO(pool.startDate));
    const latestPool = new Date(
      Math.max(...poolDates.map((date) => date.getTime()))
    );

    // If the latest pool is in the future, use it
    if (latestPool > now) {
      return latestPool;
    }

    // Otherwise, use the current month
    return now;
  });

  // Get all dates in each pool's interval
  const getPoolDatesInfo = () => {
    // Map of date strings to their pool colors
    const dateColorMap: Record<string, string[]> = {};

    pools.forEach((pool) => {
      try {
        // Get start and end dates for the pool
        const startDate = parseISO(pool.startDate);
        const endDate = parseISO(pool.endDate);

        // Skip if invalid dates
        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
          return;
        }

        // Get color for this pool
        const poolColor = getPoolColor(pool);

        // Add color to all dates in the pool's interval
        const datesInInterval = eachDayOfInterval({
          start: startDate,
          end: endDate,
        });
        datesInInterval.forEach((date) => {
          const dateStr = format(date, "yyyy-MM-dd");
          if (!dateColorMap[dateStr]) {
            dateColorMap[dateStr] = [];
          }
          if (!dateColorMap[dateStr].includes(poolColor)) {
            dateColorMap[dateStr].push(poolColor);
          }
        });
      } catch (error) {
        console.error("Error processing pool dates:", error, pool);
      }
    });

    return dateColorMap;
  };

  // Get dates info for the current month
  const poolDatesInfo = getPoolDatesInfo();

  const hasPoolOnDay = (day: Date) => {
    const dayStr = format(day, "yyyy-MM-dd");
    return !!poolDatesInfo[dayStr] && poolDatesInfo[dayStr].length > 0;
  };

  const getPoolColorsForDay = (day: Date): string[] => {
    const dayStr = format(day, "yyyy-MM-dd");
    return poolDatesInfo[dayStr] || [];
  };

  const onPrevMonth = () => {
    setCurrentMonth(subMonths(currentMonth, 1));
  };

  const onNextMonth = () => {
    setCurrentMonth(addMonths(currentMonth, 1));
  };

  const onDayPress = (day: Date) => {
    if (hasPoolOnDay(day)) {
      if (selectedDate && isSameDay(selectedDate, day)) {
        // If already selected, deselect it
        onDateSelect(null);
      } else {
        onDateSelect(day);
      }
    }
  };

  const renderCalendar = () => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(monthStart);
    const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

    // Find the first day of the month (0 = Sunday, 6 = Saturday)
    const startDay = getDay(monthStart);

    // Create calendar rows
    const rows: ReactNode[] = [];
    let days: ReactNode[] = [];

    // Add empty cells for days before the start of the month
    for (let i = 0; i < startDay; i++) {
      days.push(<View key={`empty-${i}`} style={styles.day} />);
    }

    // Add days of the month
    daysInMonth.forEach((day) => {
      const isCurrentDay = isToday(day);
      const isSelected = selectedDate ? isSameDay(selectedDate, day) : false;
      const hasPool = hasPoolOnDay(day);
      const poolColors = getPoolColorsForDay(day);
      const isHighlighted = isSelected || isCurrentDay;

      const colorScheme = "light"; // Replace with your actual theme logic
      const themeColors = {
        secondary: "#0a7ea4", // tintColorLight from your Colors
        text: "#11181C",
        white: "#FFF",
      };

      days.push(
        <TouchableOpacity
          key={day.toString()}
          style={styles.dayContainer}
          onPress={() => hasPool && onDayPress(day)}
          disabled={!hasPool}
        >
          {/* Day circle with number */}
          <View
            style={[
              styles.dayCircle,
              isHighlighted && {
                backgroundColor: themeColors.secondary,
                borderColor: isDark ? "rgba(255,255,255,0.3)" : "transparent",
                borderWidth: isDark ? 1 : 0,
              },
              hasPool && poolColors.length > 3 && styles.manyPoolsDay,
              isDark &&
                !isHighlighted &&
                hasPool && {
                  backgroundColor: "rgba(255,255,255,0.15)",
                  shadowColor: "rgba(255,255,255,0.3)",
                  shadowOffset: { width: 0, height: 0 },
                  shadowOpacity: 0.3,
                  shadowRadius: 4,
                  elevation: 2,
                },
              isDark &&
                !isHighlighted &&
                !hasPool && { backgroundColor: "rgba(255,255,255,0.08)" },
            ]}
          >
            <Text
              style={[
                styles.dayText,
                {
                  color: isHighlighted
                    ? themeColors.white
                    : isDark
                    ? "rgba(255,255,255,0.9)"
                    : themeColors.text,
                },
              ]}
            >
              {format(day, "dd")}
            </Text>
          </View>

          {/* Pool indicator stripes below the day - limit to max 3 for better readability */}
          {poolColors.length > 0 && (
            <View style={styles.indicatorsContainer}>
              {/* Always show max 3 colors, regardless of how many pools */}
              {poolColors.slice(0, 3).map((color, index) => (
                <View
                  key={`stripe-${index}`}
                  style={[
                    styles.colorStripe,
                    {
                      backgroundColor: color,
                      width:
                        poolColors.length === 1
                          ? "100%"
                          : poolColors.length === 2
                          ? "45%"
                          : "30%",
                      marginLeft: index > 0 ? 1 : 0,
                      opacity: isDark ? 1 : 0.95,
                      height: isDark ? 6 : 5,
                      borderRadius: 3,
                      shadowColor: "#000",
                      shadowOffset: { width: 0, height: 1 },
                      shadowOpacity: 0.2,
                      shadowRadius: 1,
                      elevation: 2,
                    },
                  ]}
                />
              ))}
            </View>
          )}
        </TouchableOpacity>
      );

      // If we've reached the end of a week, start a new row
      if (days.length === 7) {
        rows.push(
          <View key={`row-${rows.length}`} style={styles.weekRow}>
            {days}
          </View>
        );
        days = [];
      }
    });

    // Add remaining empty cells
    if (days.length > 0) {
      while (days.length < 7) {
        days.push(<View key={`empty-end-${days.length}`} style={styles.day} />);
      }
      rows.push(
        <View key={`row-${rows.length}`} style={styles.weekRow}>
          {days}
        </View>
      );
    }

    return rows;
  };

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: isDark
            ? "rgba(36, 36, 40, 0.85)"
            : "rgba(248, 249, 250, 0.9)",
          shadowColor: themeColors.shadow,
          borderColor: isDark
            ? "rgba(255, 255, 255, 0.1)"
            : "rgba(0, 0, 0, 0.05)",
        },
      ]}
      pointerEvents={disabled ? "none" : "auto"}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={onPrevMonth} style={styles.navButton}>
          <Ionicons
            name="chevron-back"
            size={24}
            color={isDark ? "#FFFFFF" : themeColors.text}
          />
        </TouchableOpacity>

        <Text
          style={[
            styles.headerText,
            {
              color: themeColors.text,
              fontWeight: isDark ? "700" : "600", // Bolder in dark mode for readability
            },
          ]}
        >
          {format(currentMonth, "MMMM", { locale: ptBR })
            .charAt(0)
            .toUpperCase() +
            format(currentMonth, "MMMM", { locale: ptBR }).slice(1)}
        </Text>

        <TouchableOpacity onPress={onNextMonth} style={styles.navButton}>
          <Ionicons
            name="chevron-forward"
            size={24}
            color={isDark ? "#FFFFFF" : themeColors.text}
          />
        </TouchableOpacity>
      </View>

      <View style={styles.weekHeader}>
        {["D", "S", "T", "Q", "Q", "S", "S"].map((day, index) => (
          <Text
            key={index}
            style={[
              styles.weekDayText,
              {
                color: isDark ? "rgba(255, 255, 255, 0.85)" : themeColors.text,
                fontWeight: isDark ? "700" : "600", // Bolder in dark mode
              },
            ]}
          >
            {day}
          </Text>
        ))}
      </View>

      <View style={styles.calendar}>{renderCalendar()}</View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 24,
    margin: 16,
    padding: 16,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 6,
    borderWidth: 1,
    borderColor: "rgba(0, 0, 0, 0.05)",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  headerText: {
    fontSize: 20,
    fontWeight: "600",
  },
  navButton: {
    padding: 4,
  },
  weekHeader: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 8,
  },
  weekDayText: {
    fontSize: 14,
    fontWeight: "600",
    width: 24,
    textAlign: "center",
  },
  calendar: {
    marginTop: 8,
  },
  weekRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 12,
  },
  dayContainer: {
    alignItems: "center",
    justifyContent: "center",
    width: 30,
    height: 36,
    position: "relative",
  },
  day: {
    width: 30,
    height: 36,
  },
  dayCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
  },
  dayText: {
    fontSize: 13,
    fontWeight: "400",
  },
  manyPoolsDay: {
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.1)",
  },
  indicatorsContainer: {
    flexDirection: "row",
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    justifyContent: "center",
    height: 4,
    zIndex: 2,
  },
  colorStripe: {
    height: 4,
    borderRadius: 2,
    shadowColor: "rgba(0,0,0,0.2)",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 1,
  },
});

export default PoolCalendar;
