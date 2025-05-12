import React, { useEffect, useState } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  useColorScheme,
  Dimensions,
  Text,
  TouchableOpacity,
} from "react-native";
import { Ionicons, MaterialIcons, FontAwesome5 } from "@expo/vector-icons";
import { VotingPool } from "../types";
import { Colors } from "../constants/Colors";
import {
  format,
  parseISO,
  differenceInDays,
  differenceInHours,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { votesApi } from "../services/apiClient";
import Svg, { G, Path, Circle, Text as SvgText } from "react-native-svg";

// Enhanced PieChart component using Svg
const PieChart = ({
  data,
  colors,
  size = 200,
  donut = false,
  showLabels = false,
  elegant = false,
}: {
  data: number[];
  colors: string[];
  size?: number;
  donut?: boolean;
  showLabels?: boolean;
  elegant?: boolean;
}) => {
  const total = data.reduce((sum, value) => sum + value, 0);
  if (total === 0) return null;

  const radius = size / 2;
  const innerRadius = donut ? radius * 0.4 : 0;

  // Calculate the arc segments
  let startAngle = 0;
  const segments = data.map((value, index) => {
    const percentage = value / total;
    const angle = percentage * 2 * Math.PI;
    const segment = {
      value,
      percentage,
      startAngle,
      endAngle: startAngle + angle,
      color: colors[index % colors.length],
    };
    startAngle += angle;
    return segment;
  });

  // Function to create SVG arc path
  const createArcPath = (
    segment: {
      startAngle: number;
      endAngle: number;
      percentage: number;
    },
    innerRadius: number,
    outerRadius: number
  ) => {
    const startX =
      radius + outerRadius * Math.cos(segment.startAngle - Math.PI / 2);
    const startY =
      radius + outerRadius * Math.sin(segment.startAngle - Math.PI / 2);
    const endX =
      radius + outerRadius * Math.cos(segment.endAngle - Math.PI / 2);
    const endY =
      radius + outerRadius * Math.sin(segment.endAngle - Math.PI / 2);

    const innerStartX =
      radius + innerRadius * Math.cos(segment.startAngle - Math.PI / 2);
    const innerStartY =
      radius + innerRadius * Math.sin(segment.startAngle - Math.PI / 2);
    const innerEndX =
      radius + innerRadius * Math.cos(segment.endAngle - Math.PI / 2);
    const innerEndY =
      radius + innerRadius * Math.sin(segment.endAngle - Math.PI / 2);

    const largeArcFlag = segment.percentage > 0.5 ? 1 : 0;

    // Move to start position, arc to end position, line to inner arc,
    // arc back to start position (in reverse), close path
    return `
      M ${startX} ${startY}
      A ${outerRadius} ${outerRadius} 0 ${largeArcFlag} 1 ${endX} ${endY}
      L ${innerEndX} ${innerEndY}
      A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} 0 ${innerStartX} ${innerStartY}
      Z
    `;
  };

  // Function to get label position
  const getLabelPosition = (segment: {
    startAngle: number;
    endAngle: number;
  }) => {
    const midAngle = (segment.startAngle + segment.endAngle) / 2 - Math.PI / 2;
    // Adjust labelRadius based on whether it's a donut chart or not
    const labelRadius = donut
      ? (radius + innerRadius) / 2 + (radius - innerRadius) * 0.3
      : radius * 0.65; // For regular pie chart, position labels at 65% of radius

    return {
      x: radius + labelRadius * Math.cos(midAngle),
      y: radius + labelRadius * Math.sin(midAngle),
    };
  };

  return (
    <View
      style={{ width: size, height: size, margin: 15, alignSelf: "center" }}
    >
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <G>
          {segments.map((segment, index) => (
            <React.Fragment key={index}>
              <Path
                d={createArcPath(segment, innerRadius, radius)}
                fill={segment.color}
                stroke="white"
                strokeWidth={elegant ? 2 : 1}
              />
              {showLabels && segment.percentage > 0.05 && (
                <SvgText
                  x={getLabelPosition(segment).x}
                  y={getLabelPosition(segment).y}
                  fill="white"
                  fontSize={elegant ? 16 : 14}
                  fontWeight="bold"
                  textAnchor="middle"
                  alignmentBaseline="central"
                  stroke="rgba(0,0,0,0.3)"
                  strokeWidth={0.7}
                >
                  {`${(segment.percentage * 100).toFixed(0)}%`}
                </SvgText>
              )}
            </React.Fragment>
          ))}
        </G>
      </Svg>

      {donut && (
        <View
          style={{
            position: "absolute",
            width: size * 0.4,
            height: size * 0.4,
            borderRadius: (size * 0.4) / 2,
            backgroundColor: "#FFFFFF",
            top: size / 2 - (size * 0.4) / 2,
            left: size / 2 - (size * 0.4) / 2,
            alignItems: "center",
            justifyContent: "center",
            elevation: 4,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 4,
          }}
        >
          <Text
            style={{
              fontSize: 18,
              fontWeight: "bold",
              color: Colors.light.tint,
            }}
          >
            {total}
          </Text>
          <Text style={{ fontSize: 12, color: "#666666" }}>votos</Text>
        </View>
      )}
    </View>
  );
};

// Create a simplified version for small data visualization
const MiniPieChart = ({
  data,
  colors,
  size = 60,
}: {
  data: number[];
  colors: string[];
  size?: number;
}) => {
  return (
    <PieChart
      data={data}
      colors={colors}
      size={size}
      donut={false}
      showLabels={false}
    />
  );
};

type VoteTimeline = {
  date: string;
  count: number;
};

type Analytics = {
  votesPerOption: {
    optionId: string;
    text: string;
    voteCount: number;
  }[];
  voteTimeline: VoteTimeline[];
  hourlyDistribution: number[];
  demographicData?: {
    type: string;
    count: number;
  }[];
};

export const PoolAnalytics = ({ pool }: { pool: VotingPool }) => {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [activeTab, setActiveTab] = useState<
    "overview" | "timeline" | "detailed"
  >("overview");

  // Enhanced chart colors - more vibrant and visually appealing
  const chartColors = [
    "#FF5252", // Red
    "#448AFF", // Blue
    "#66BB6A", // Green
    "#FFCA28", // Amber
    "#AB47BC", // Purple
    "#26C6DA", // Cyan
    "#FFA726", // Orange
    "#EC407A", // Pink
    "#7E57C2", // Deep Purple
    "#9CCC65", // Light Green
  ];

  const fetchAnalytics = async () => {
    try {
      setLoading(true);

      // In a real implementation, this would be fetched from the API
      // For now, we'll create mock data based on the pool

      // Votes per option - we have this from the pool data
      const votesPerOption = pool.options.map((option) => ({
        optionId: option.id,
        text: option.text,
        voteCount: option.voteCount,
      }));

      // Create mock vote timeline data
      const startDate = parseISO(pool.startDate);
      const endDate = parseISO(pool.endDate);
      const dayDiff = differenceInDays(endDate, startDate);

      // Create a realistic vote distribution - more votes in middle days
      const voteTimeline: VoteTimeline[] = [];
      const totalVotes = votesPerOption.reduce(
        (sum, opt) => sum + opt.voteCount,
        0
      );

      // Create hourly distribution - more votes during working hours
      const hourlyDistribution = Array(24)
        .fill(0)
        .map((_, hour) => {
          // Lower probability during night hours (0-6)
          if (hour >= 0 && hour < 6) return Math.floor(Math.random() * 10);

          // Medium probability during early morning and evening (6-9, 18-23)
          if ((hour >= 6 && hour < 9) || (hour >= 18 && hour < 24))
            return 10 + Math.floor(Math.random() * 20);

          // High probability during working hours (9-18)
          return 20 + Math.floor(Math.random() * 30);
        });

      // Normalize hourly distribution to match total votes
      const hourlyTotal = hourlyDistribution.reduce(
        (sum, count) => sum + count,
        0
      );
      const normalizedHourly = hourlyDistribution.map((count) =>
        Math.round((count / hourlyTotal) * totalVotes)
      );

      // Generate timeline data
      for (let i = 0; i <= dayDiff; i++) {
        const currentDate = new Date(startDate);
        currentDate.setDate(startDate.getDate() + i);

        // Create a realistic distribution - more votes in middle days
        let weight;
        if (dayDiff === 0) {
          weight = 1; // Single day
        } else if (i === 0 || i === dayDiff) {
          weight = 0.5; // First and last days get fewer votes
        } else {
          // Bell curve - more votes in the middle days
          const position = i / dayDiff;
          weight = 1 - 2 * Math.abs(position - 0.5);
        }

        const dailyVotes = Math.round((totalVotes * weight) / dayDiff);

        voteTimeline.push({
          date: format(currentDate, "yyyy-MM-dd"),
          count: dailyVotes,
        });
      }

      setAnalytics({
        votesPerOption,
        voteTimeline,
        hourlyDistribution: normalizedHourly,
      });
    } catch (error) {
      console.error("Error fetching analytics data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [pool.id]);

  if (loading) {
    return (
      <View
        style={[
          styles.loadingContainer,
          { backgroundColor: isDark ? "#1A1A1A" : "#F8F9FA" },
        ]}
      >
        <ActivityIndicator size="large" color={Colors.light.tint} />
        <Text
          style={[
            styles.loadingText,
            { color: isDark ? "#FFFFFF" : "#333333" },
          ]}
        >
          Carregando análises...
        </Text>
      </View>
    );
  }

  if (!analytics) {
    return (
      <View
        style={[
          styles.errorContainer,
          { backgroundColor: isDark ? "#1A1A1A" : "#F8F9FA" },
        ]}
      >
        <Ionicons
          name="alert-circle-outline"
          size={48}
          color={isDark ? "#FFFFFF" : "#666666"}
        />
        <Text
          style={[styles.errorText, { color: isDark ? "#FFFFFF" : "#333333" }]}
        >
          Não foi possível carregar as análises.
        </Text>
      </View>
    );
  }

  const renderOverviewTab = () => {
    const totalVotes = analytics.votesPerOption.reduce(
      (sum, opt) => sum + opt.voteCount,
      0
    );
    const voteData = analytics.votesPerOption.map((opt) => opt.voteCount);

    return (
      <View style={styles.tabContentContainer}>
        <View
          style={[
            styles.statsCard,
            { backgroundColor: isDark ? "#2A2A2A" : "#FFFFFF" },
          ]}
        >
          <View style={styles.statHeader}>
            <FontAwesome5
              name="chart-pie"
              size={20}
              color={Colors.light.tint}
            />
            <Text
              style={[
                styles.statHeaderText,
                { color: isDark ? "#FFFFFF" : "#333333" },
              ]}
            >
              Resumo de Votos
            </Text>
          </View>

          <View style={styles.statRow}>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: Colors.light.tint }]}>
                {totalVotes}
              </Text>
              <Text
                style={[
                  styles.statLabel,
                  { color: isDark ? "#BBBBBB" : "#666666" },
                ]}
              >
                Total de Votos
              </Text>
            </View>

            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: Colors.light.tint }]}>
                {analytics.votesPerOption.length}
              </Text>
              <Text
                style={[
                  styles.statLabel,
                  { color: isDark ? "#BBBBBB" : "#666666" },
                ]}
              >
                Opções
              </Text>
            </View>

            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: Colors.light.tint }]}>
                {differenceInDays(
                  parseISO(pool.endDate),
                  parseISO(pool.startDate)
                )}
              </Text>
              <Text
                style={[
                  styles.statLabel,
                  { color: isDark ? "#BBBBBB" : "#666666" },
                ]}
              >
                Dias Ativos
              </Text>
            </View>
          </View>
        </View>

        <View
          style={[
            styles.chartCard,
            { backgroundColor: isDark ? "#2A2A2A" : "#FFFFFF" },
          ]}
        >
          <Text
            style={[
              styles.chartTitle,
              { color: isDark ? "#FFFFFF" : "#333333" },
            ]}
          >
            Distribuição de Votos
          </Text>

          {voteData.length > 0 && (
            <>
              <PieChart
                data={voteData}
                colors={chartColors}
                size={280}
                donut={true}
                showLabels={true}
                elegant={true}
              />

              <View style={styles.elegantLegendContainer}>
                {analytics.votesPerOption.map((option, index) => {
                  const percentage =
                    totalVotes > 0
                      ? ((option.voteCount / totalVotes) * 100).toFixed(1)
                      : "0.0";

                  return (
                    <View
                      key={option.optionId}
                      style={styles.elegantLegendItem}
                    >
                      <View
                        style={[
                          styles.elegantLegendColor,
                          {
                            backgroundColor:
                              chartColors[index % chartColors.length],
                          },
                        ]}
                      />
                      <View style={styles.elegantLegendTextContainer}>
                        <Text
                          style={[
                            styles.elegantLegendText,
                            { color: isDark ? "#FFFFFF" : "#333333" },
                          ]}
                          numberOfLines={1}
                          ellipsizeMode="tail"
                        >
                          {option.text}
                        </Text>
                        <Text style={styles.elegantLegendDetails}>
                          <Text
                            style={{
                              fontWeight: "bold",
                              color: chartColors[index % chartColors.length],
                            }}
                          >
                            {option.voteCount} votos
                          </Text>{" "}
                          ({percentage}%)
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            </>
          )}
        </View>
      </View>
    );
  };

  const renderTimelineTab = () => {
    // Group timeline data by days
    const groupedTimeline: { [key: string]: number } = {};
    analytics.voteTimeline.forEach((day) => {
      const monthDay = format(parseISO(day.date), "dd/MM");
      if (groupedTimeline[monthDay]) {
        groupedTimeline[monthDay] += day.count;
      } else {
        groupedTimeline[monthDay] = day.count;
      }
    });

    // Convert grouped data to arrays and sort chronologically
    const timelinePairs = Object.entries(groupedTimeline)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => {
        // Convert dates like "dd/MM" to a comparable format
        const [dayA, monthA] = a.date.split("/").map(Number);
        const [dayB, monthB] = b.date.split("/").map(Number);
        return monthA * 31 + dayA - (monthB * 31 + dayB);
      });

    // Create arrays for chart
    const timelineLabels = timelinePairs.map((item) => item.date);
    const timelineData = timelinePairs.map((item) => item.count);

    // Calculate total votes and peak day
    const totalVotes = timelineData.reduce((sum, v) => sum + v, 0);
    const peakDay =
      timelinePairs.length > 0
        ? timelinePairs.reduce(
            (max, curr) => (curr.count > max.count ? curr : max),
            timelinePairs[0]
          )
        : null;

    // Calculate average votes per day
    const averageVotes =
      timelineData.length > 0
        ? Math.round(totalVotes / timelineData.length)
        : 0;

    const greenColor = "#4CAF50"; // Green color for peak day

    return (
      <View style={styles.tabContent}>
        <View
          style={[
            styles.statsCard,
            { backgroundColor: isDark ? "#2A2A2A" : "#FFFFFF" },
          ]}
        >
          <View style={styles.statHeader}>
            <Ionicons
              name="calendar-outline"
              size={20}
              color={Colors.light.tint}
            />
            <Text
              style={[
                styles.statHeaderText,
                { color: isDark ? "#FFFFFF" : "#333333" },
              ]}
            >
              Cronologia de Votos
            </Text>
          </View>

          {/* Summary section */}
          <View style={styles.timelineSummaryContainer}>
            <View
              style={[
                styles.timelineSummaryBox,
                {
                  backgroundColor: isDark
                    ? "rgba(255,255,255,0.05)"
                    : "rgba(0,0,0,0.02)",
                },
              ]}
            >
              <View style={styles.timelineSummaryContent}>
                <Text style={styles.timelineSummaryTitle}>Total</Text>
                <Text
                  style={[
                    styles.timelineSummaryValue,
                    { color: Colors.light.tint },
                  ]}
                >
                  {totalVotes}
                </Text>
                <Text style={styles.timelineSummarySubtext}>votos</Text>
              </View>
            </View>

            <View
              style={[
                styles.timelineSummaryBox,
                {
                  backgroundColor: isDark
                    ? "rgba(255,255,255,0.05)"
                    : "rgba(0,0,0,0.02)",
                },
              ]}
            >
              <View style={styles.timelineSummaryContent}>
                <Text style={styles.timelineSummaryTitle}>Dia Pico</Text>
                <Text
                  style={[styles.timelineSummaryValue, { color: greenColor }]}
                >
                  {peakDay ? peakDay.count : 0}
                </Text>
                <Text style={styles.timelineSummarySubtext}>
                  {peakDay ? peakDay.date : "--"}
                </Text>
              </View>
            </View>

            <View
              style={[
                styles.timelineSummaryBox,
                {
                  backgroundColor: isDark
                    ? "rgba(255,255,255,0.05)"
                    : "rgba(0,0,0,0.02)",
                },
              ]}
            >
              <View style={styles.timelineSummaryContent}>
                <Text style={styles.timelineSummaryTitle}>Média</Text>
                <Text
                  style={[
                    styles.timelineSummaryValue,
                    { color: isDark ? "#BBBBBB" : "#666666" },
                  ]}
                >
                  {averageVotes}
                </Text>
                <Text style={styles.timelineSummarySubtext}>por dia</Text>
              </View>
            </View>
          </View>

          <Text style={styles.timelineSubheader}>
            Distribuição de votos ao longo do tempo
          </Text>

          <View style={styles.timelineList}>
            {timelinePairs.map((item, index) => {
              const isHighestDay = peakDay && peakDay.date === item.date;
              // Calculate percentage relative to total votes instead of maximum
              const percentageOfTotal =
                totalVotes > 0 ? (item.count / totalVotes) * 100 : 0;
              const percentOfTotalFormatted = percentageOfTotal.toFixed(1);
              const barColor = isHighestDay ? greenColor : Colors.light.tint;

              return (
                <TouchableOpacity
                  key={item.date}
                  activeOpacity={0.7}
                  style={[
                    styles.dayDistributionItem,
                    isHighestDay && {
                      backgroundColor: isDark
                        ? "rgba(76,175,80,0.1)"
                        : "rgba(76,175,80,0.05)",
                      borderLeftWidth: 3,
                      borderLeftColor: greenColor,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.dayLabel,
                      {
                        color: isDark ? "#FFFFFF" : "#333333",
                        fontWeight: isHighestDay ? "bold" : "normal",
                      },
                    ]}
                  >
                    {item.date}
                  </Text>
                  <View style={styles.dayBarWrapper}>
                    <View
                      style={[
                        styles.dayBarContainer,
                        {
                          backgroundColor: isDark
                            ? "rgba(255,255,255,0.1)"
                            : "#EEEEEE",
                          borderRadius: 10,
                        },
                      ]}
                    >
                      <View
                        style={[
                          styles.dayBar,
                          {
                            width: `${percentageOfTotal}%`,
                            backgroundColor: barColor,
                            height: "100%",
                            borderRadius: 10,
                            alignItems: "center", // Center text horizontally
                            justifyContent: "center", // Center text vertically
                          },
                        ]}
                      >
                        {percentageOfTotal > 20 && (
                          <Text style={styles.barInnerText}>
                            {item.count} ({percentOfTotalFormatted}%)
                          </Text>
                        )}
                      </View>
                      {percentageOfTotal <= 20 && (
                        <Text
                          style={[
                            styles.barOuterText,
                            { color: isDark ? "#BBBBBB" : "#666666" },
                          ]}
                        >
                          {item.count} ({percentOfTotalFormatted}%)
                        </Text>
                      )}
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}

            {/* Add horizontal grid lines for better readability */}
            <View style={styles.horizontalGridLines}>
              <View
                style={[
                  styles.gridLine,
                  {
                    backgroundColor: isDark
                      ? "rgba(255,255,255,0.1)"
                      : "#DDDDDD",
                  },
                ]}
              />
              <View
                style={[
                  styles.gridLine,
                  {
                    backgroundColor: isDark
                      ? "rgba(255,255,255,0.1)"
                      : "#DDDDDD",
                  },
                ]}
              />
              <View
                style={[
                  styles.gridLine,
                  {
                    backgroundColor: isDark
                      ? "rgba(255,255,255,0.1)"
                      : "#DDDDDD",
                  },
                ]}
              />
            </View>
          </View>

          {timelineLabels.length === 0 && (
            <View style={styles.noDataContainer}>
              <Ionicons
                name="calendar-outline"
                size={40}
                color={isDark ? "#555555" : "#CCCCCC"}
              />
              <Text
                style={[
                  styles.noDataText,
                  { color: isDark ? "#BBBBBB" : "#666666" },
                ]}
              >
                Não há dados temporais disponíveis
              </Text>
            </View>
          )}
        </View>
      </View>
    );
  };

  const renderDetailedTab = () => {
    const totalVotes = analytics.votesPerOption.reduce(
      (sum, opt) => sum + opt.voteCount,
      0
    );
    const voteData = analytics.votesPerOption.map((opt) => opt.voteCount);

    return (
      <View style={styles.tabContentContainer}>
        {/* Improved header section with better styling */}
        <View style={{ height: 30 }} />
        <View
          style={[
            styles.detailedHeader,
            { backgroundColor: isDark ? "#333333" : "#F0F0F0" },
          ]}
        >
          <View style={styles.detailedHeaderIconContainer}>
            <Ionicons
              name="document-text-outline"
              size={24}
              color={Colors.light.tint}
            />
          </View>
          <Text
            style={[
              styles.detailedHeaderTitle,
              { color: isDark ? "#FFFFFF" : "#333333" },
            ]}
          >
            Análise Detalhada
          </Text>
        </View>

        <View
          style={[
            styles.statsCard,
            { backgroundColor: isDark ? "#2A2A2A" : "#FFFFFF" },
            { borderTopLeftRadius: 0, borderTopRightRadius: 0 },
          ]}
        >
          <View style={styles.detailedStats}>
            <View style={styles.detailedStatRow}>
              <Text
                style={[
                  styles.detailedStatLabel,
                  { color: isDark ? "#BBBBBB" : "#666666" },
                ]}
              >
                Título da Votação:
              </Text>
              <Text
                style={[
                  styles.detailedStatValue,
                  { color: isDark ? "#FFFFFF" : "#333333" },
                ]}
              >
                {pool.title}
              </Text>
            </View>

            <View style={styles.detailedStatRow}>
              <Text
                style={[
                  styles.detailedStatLabel,
                  { color: isDark ? "#BBBBBB" : "#666666" },
                ]}
              >
                Categoria:
              </Text>
              <Text
                style={[
                  styles.detailedStatValue,
                  { color: isDark ? "#FFFFFF" : "#333333" },
                ]}
              >
                {pool.category}
              </Text>
            </View>

            <View style={styles.detailedStatRow}>
              <Text
                style={[
                  styles.detailedStatLabel,
                  { color: isDark ? "#BBBBBB" : "#666666" },
                ]}
              >
                Data de Início:
              </Text>
              <Text
                style={[
                  styles.detailedStatValue,
                  { color: isDark ? "#FFFFFF" : "#333333" },
                ]}
              >
                {format(parseISO(pool.startDate), "dd 'de' MMMM, yyyy", {
                  locale: ptBR,
                })}
              </Text>
            </View>

            <View style={styles.detailedStatRow}>
              <Text
                style={[
                  styles.detailedStatLabel,
                  { color: isDark ? "#BBBBBB" : "#666666" },
                ]}
              >
                Data de Término:
              </Text>
              <Text
                style={[
                  styles.detailedStatValue,
                  { color: isDark ? "#FFFFFF" : "#333333" },
                ]}
              >
                {format(parseISO(pool.endDate), "dd 'de' MMMM, yyyy", {
                  locale: ptBR,
                })}
              </Text>
            </View>

            <View style={styles.detailedStatRow}>
              <Text
                style={[
                  styles.detailedStatLabel,
                  { color: isDark ? "#BBBBBB" : "#666666" },
                ]}
              >
                Duração:
              </Text>
              <Text
                style={[
                  styles.detailedStatValue,
                  { color: isDark ? "#FFFFFF" : "#333333" },
                ]}
              >
                {differenceInDays(
                  parseISO(pool.endDate),
                  parseISO(pool.startDate)
                )}{" "}
                dias
              </Text>
            </View>

            <View style={styles.detailedStatRow}>
              <Text
                style={[
                  styles.detailedStatLabel,
                  { color: isDark ? "#BBBBBB" : "#666666" },
                ]}
              >
                Status:
              </Text>
              <Text
                style={[
                  styles.detailedStatValue,
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
                  ? "Em Breve"
                  : "Encerrada"}
              </Text>
            </View>

            <View style={styles.detailedStatRow}>
              <Text
                style={[
                  styles.detailedStatLabel,
                  { color: isDark ? "#BBBBBB" : "#666666" },
                ]}
              >
                Votação Anônima:
              </Text>
              <Text
                style={[
                  styles.detailedStatValue,
                  { color: isDark ? "#FFFFFF" : "#333333" },
                ]}
              >
                {pool.anonymous ? "Sim" : "Não"}
              </Text>
            </View>
          </View>
        </View>

        <View
          style={[
            styles.chartCard,
            { backgroundColor: isDark ? "#2A2A2A" : "#FFFFFF" },
          ]}
        >
          <Text
            style={[
              styles.chartTitle,
              { color: isDark ? "#FFFFFF" : "#333333" },
            ]}
          >
            Opções e Distribuição
          </Text>

          <PieChart
            data={voteData}
            colors={chartColors}
            size={240}
            donut={true}
            showLabels={true}
            elegant={true}
          />

          <View style={{ marginTop: 20 }}>
            {analytics.votesPerOption.map((option, index) => {
              const percentage =
                totalVotes > 0 ? (option.voteCount / totalVotes) * 100 : 0;

              return (
                <View key={option.optionId} style={styles.detailedResultRow}>
                  <View style={styles.detailedResultHeader}>
                    <View style={styles.optionNameRow}>
                      <View
                        style={[
                          styles.optionColorIndicator,
                          {
                            backgroundColor:
                              chartColors[index % chartColors.length],
                          },
                        ]}
                      />
                      <Text
                        style={[
                          styles.optionName,
                          { color: isDark ? "#FFFFFF" : "#333333" },
                        ]}
                      >
                        {option.text}
                      </Text>
                    </View>
                    <Text
                      style={[
                        styles.optionVoteCount,
                        { color: isDark ? "#BBBBBB" : "#666666" },
                      ]}
                    >
                      {option.voteCount} votos ({percentage.toFixed(1)}%)
                    </Text>
                  </View>

                  <View style={styles.progressBarContainer}>
                    <View
                      style={[
                        styles.progressBar,
                        {
                          width: `${percentage}%`,
                          backgroundColor:
                            chartColors[index % chartColors.length],
                        },
                      ]}
                    />
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      </View>
    );
  };

  const bgColor = isDark ? "#121212" : "#F5F5F5";

  // Function to get appropriate icon for each tab
  const getTabIcon = (
    tabName: "overview" | "timeline" | "detailed",
    isActive: boolean
  ) => {
    const color = isActive ? Colors.light.tint : isDark ? "#BBBBBB" : "#666666";

    switch (tabName) {
      case "overview":
        return <FontAwesome5 name="chart-pie" size={18} color={color} />;
      case "timeline":
        return <Ionicons name="time-outline" size={20} color={color} />;
      case "detailed":
        return <Ionicons name="list-outline" size={20} color={color} />;
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: bgColor }]}>
      <View
        style={[
          styles.tabBar,
          { backgroundColor: isDark ? "#2A2A2A" : "#FFFFFF" },
        ]}
      >
        {["overview", "timeline", "detailed"].map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[
              styles.tabButton,
              activeTab === tab && [
                styles.activeTabButton,
                {
                  backgroundColor: isDark
                    ? "rgba(255,255,255,0.05)"
                    : "rgba(0,0,0,0.03)",
                },
              ],
            ]}
            onPress={() =>
              setActiveTab(tab as "overview" | "timeline" | "detailed")
            }
            activeOpacity={0.7}
          >
            <View style={styles.tabContent}>
              {getTabIcon(
                tab as "overview" | "timeline" | "detailed",
                activeTab === tab
              )}
              <Text
                style={[
                  styles.tabButtonText,
                  {
                    color:
                      activeTab === tab
                        ? Colors.light.tint
                        : isDark
                        ? "#BBBBBB"
                        : "#666666",
                  },
                  activeTab === tab && styles.activeTabButtonText,
                ]}
              >
                {tab === "overview"
                  ? "Visão Geral"
                  : tab === "timeline"
                  ? "Cronologia"
                  : "Detalhado"}
              </Text>
            </View>
            {activeTab === tab && (
              <View
                style={[
                  styles.activeIndicator,
                  { backgroundColor: Colors.light.tint },
                ]}
              />
            )}
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        style={[styles.scrollContainer, { backgroundColor: bgColor }]}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 20 }}
      >
        {activeTab === "overview" && renderOverviewTab()}
        {activeTab === "timeline" && renderTimelineTab()}
        {activeTab === "detailed" && renderDetailedTab()}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F5F5",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    fontWeight: "500",
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  errorText: {
    marginTop: 12,
    fontSize: 16,
    textAlign: "center",
  },
  scrollContainer: {
    flex: 1,
    padding: 16,
  },
  tabBar: {
    flexDirection: "row",
    justifyContent: "space-around",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    margin: 16,
    marginTop: 0,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    zIndex: 1,
    padding: 4,
  },
  tabButton: {
    flex: 1,
    borderRadius: 12,
    marginHorizontal: 4,
    paddingVertical: 12,
    position: "relative",
    overflow: "hidden",
  },
  tabContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  activeTabButton: {
    // Empty base style - actual background is applied conditionally in component
  },
  tabButtonText: {
    fontSize: 14,
    marginLeft: 6,
    fontWeight: "500",
  },
  activeTabButtonText: {
    fontWeight: "bold",
  },
  activeIndicator: {
    position: "absolute",
    bottom: 0,
    left: "25%",
    right: "25%",
    height: 3,
    borderRadius: 1.5,
  },
  statsCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  statHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
  },
  statHeaderText: {
    fontSize: 18,
    fontWeight: "bold",
    marginLeft: 10,
  },
  statRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  statItem: {
    alignItems: "center",
    flex: 1,
  },
  statValue: {
    fontSize: 26,
    fontWeight: "bold",
  },
  statLabel: {
    fontSize: 13,
    marginTop: 6,
  },
  chartCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  chartTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 20,
    textAlign: "center",
  },
  legendContainer: {
    marginTop: 16,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
    paddingHorizontal: 5,
  },
  legendColor: {
    width: 16,
    height: 16,
    borderRadius: 8,
    marginRight: 10,
  },
  legendText: {
    fontSize: 14,
    flex: 1,
  },
  timelineLegendContainer: {
    marginTop: 20,
    paddingHorizontal: 10,
  },
  legendRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  legendItemRow: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    paddingHorizontal: 5,
  },
  chartDescription: {
    fontSize: 12,
    color: "#666666",
    textAlign: "center",
    marginTop: 10,
    fontStyle: "italic",
  },
  dayDistributionContainer: {
    marginTop: 5,
    marginBottom: 5,
    borderLeftWidth: 1,
    borderLeftColor: "#DDDDDD",
    borderBottomWidth: 1,
    borderBottomColor: "#DDDDDD",
    paddingLeft: 5,
    paddingBottom: 5,
  },
  dayDistributionItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    paddingHorizontal: 16,
    marginBottom: 5,
    borderRadius: 10,
  },
  dayLabel: {
    fontSize: 14,
    width: 48,
    fontWeight: "500",
  },
  dayBarWrapper: {
    flex: 1,
  },
  dayBarContainer: {
    height: 26,
    backgroundColor: "#EEEEEE",
    borderRadius: 10,
    marginHorizontal: 10,
    overflow: "hidden",
    position: "relative",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  dayBar: {
    height: "100%",
    borderRadius: 10,
    justifyContent: "center",
  },
  barInnerText: {
    color: "white",
    fontSize: 13,
    textAlign: "center",
    fontWeight: "bold",
    textShadowColor: "rgba(0, 0, 0, 0.5)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  barOuterText: {
    position: "absolute",
    fontSize: 13,
    fontWeight: "bold",
    right: 10,
    top: "50%",
    transform: [{ translateY: -8 }],
  },
  horizontalGridLines: {
    position: "absolute",
    width: "100%",
    height: "100%",
    paddingLeft: 70,
    paddingRight: 10,
    justifyContent: "space-evenly",
    zIndex: -1,
  },
  gridLine: {
    width: "100%",
    height: 1,
    backgroundColor: "#DDDDDD",
    opacity: 0.5,
  },
  detailedStats: {
    marginTop: 12,
  },
  detailedStatRow: {
    flexDirection: "row",
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#EFEFEF",
    paddingBottom: 12,
  },
  detailedStatLabel: {
    flex: 1,
    fontSize: 14,
  },
  detailedStatValue: {
    flex: 2,
    fontSize: 14,
    fontWeight: "500",
  },
  detailedResultRow: {
    marginBottom: 16,
  },
  detailedResultHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  optionNameRow: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  optionColorIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 10,
  },
  optionName: {
    fontSize: 14,
    fontWeight: "500",
    flex: 1,
  },
  optionVoteCount: {
    fontSize: 12,
  },
  progressBarContainer: {
    height: 10,
    backgroundColor: "#F0F0F0",
    borderRadius: 5,
    overflow: "hidden",
    marginTop: 4,
  },
  progressBar: {
    height: "100%",
    borderRadius: 5,
  },
  elegantLegendContainer: {
    marginTop: 20,
    paddingHorizontal: 10,
    backgroundColor: "rgba(0,0,0,0.02)",
    borderRadius: 12,
    paddingVertical: 10,
    marginHorizontal: 5,
  },
  elegantLegendItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  elegantLegendColor: {
    width: 14,
    height: 14,
    borderRadius: 7,
    marginRight: 12,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.5)",
  },
  elegantLegendTextContainer: {
    flex: 1,
  },
  elegantLegendText: {
    fontSize: 14,
    fontWeight: "500",
  },
  elegantLegendDetails: {
    fontSize: 12,
    marginTop: 2,
    color: "#888888",
  },
  timelineSummaryContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginVertical: 15,
    marginHorizontal: 5,
  },
  timelineSummaryBox: {
    flex: 1,
    margin: 5,
    padding: 15,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  timelineSummaryContent: {
    alignItems: "center",
    justifyContent: "center",
  },
  timelineSummaryTitle: {
    fontSize: 12,
    color: "#888888",
    marginBottom: 6,
    fontWeight: "500",
  },
  timelineSummaryValue: {
    fontSize: 22,
    fontWeight: "bold",
  },
  timelineSummarySubtext: {
    fontSize: 11,
    color: "#888888",
    marginTop: 4,
  },
  timelineSubheader: {
    fontSize: 15,
    fontWeight: "500",
    color: "#888888",
    marginTop: 10,
    marginBottom: 15,
    marginLeft: 15,
  },
  timelineList: {
    marginTop: 15,
    position: "relative",
    marginBottom: 10,
  },
  timelineListHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#EEEEEE",
    marginBottom: 5,
  },
  timelineListHeaderText: {
    fontWeight: "bold",
    fontSize: 14,
    color: "#666666",
  },
  timelineListDate: {
    flex: 1,
    fontSize: 14,
  },
  timelineListCount: {
    flex: 1,
    fontSize: 14,
    textAlign: "center",
  },
  timelineListPercentage: {
    flex: 1,
    fontSize: 14,
    textAlign: "right",
  },
  noDataContainer: {
    padding: 30,
    justifyContent: "center",
    alignItems: "center",
  },
  noDataText: {
    marginTop: 10,
    fontSize: 14,
    textAlign: "center",
  },
  timelineSummary: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 10,
  },
  timelineSummaryItem: {
    alignItems: "center",
  },
  timelineSummaryLabel: {
    fontSize: 12,
    marginTop: 2,
  },
  tabContentContainer: {
    marginBottom: 20,
    width: "100%",
  },
  detailedHeader: {
    paddingVertical: 20,
    paddingHorizontal: 16,
    marginTop: 16,
    marginBottom: 0,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  detailedHeaderIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.1)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  detailedHeaderTitle: {
    fontSize: 20,
    fontWeight: "bold",
  },
});
