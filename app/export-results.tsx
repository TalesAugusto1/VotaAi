import React, { useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  useColorScheme,
  ActivityIndicator,
  Image,
  Share,
  Platform,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons, MaterialIcons, FontAwesome5 } from "@expo/vector-icons";
import * as FileSystem from "expo-file-system";
import { ThemedText } from "../components/ThemedText";
import { Colors } from "../constants/Colors";
import { votingPoolsApi } from "../services/apiClient";
import { VotingPool } from "../types";

export default function ExportResultsScreen() {
  const [pool, setPool] = useState<VotingPool | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [isPoolActive, setIsPoolActive] = useState(false);

  const params = useLocalSearchParams();
  const poolId = typeof params.id === "string" ? params.id : "";
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";

  useEffect(() => {
    if (!poolId) {
      setErrorMessage("ID da votação não fornecido");
      setIsLoading(false);
      return;
    }

    loadPoolData();
  }, [poolId]);

  const loadPoolData = async () => {
    try {
      setIsLoading(true);
      // Use one of the existing API methods to get a single voting pool
      const poolsData = await votingPoolsApi.getBatchVotingPools([poolId]);

      if (poolsData && poolsData[poolId]) {
        const loadedPool = poolsData[poolId];
        setPool(loadedPool);

        // Check if the pool is active
        if (loadedPool.status === "active") {
          setIsPoolActive(true);
          setErrorMessage(
            "Exportação disponível apenas para votações encerradas"
          );
        }
      } else {
        setErrorMessage("Votação não encontrada");
      }
    } catch (error) {
      console.error("Error loading pool data:", error);
      setErrorMessage("Falha ao carregar dados da votação");
    } finally {
      setIsLoading(false);
    }
  };

  // For now, we'll focus on text-based exports since we're having issues with image capture
  const handleExportAsImage = async () => {
    if (!pool || isPoolActive) return;

    try {
      setExporting(true);

      // Generate a text message that can be shared
      const totalVotes = pool.options.reduce(
        (sum, option) => sum + (option.voteCount || 0),
        0
      );

      let message = `📊 Resultados: ${pool.title}\n\n`;
      message += `Categoria: ${pool.category}\n`;
      message += `Status: ${
        pool.status === "active" ? "Em andamento" : "Encerrada"
      }\n`;
      message += `Total de votos: ${totalVotes}\n\n`;

      // Add options and percentages
      const sortedOptions = [...pool.options].sort(
        (a, b) => (b.voteCount || 0) - (a.voteCount || 0)
      );

      sortedOptions.forEach((option, index) => {
        const percentage =
          totalVotes > 0
            ? Math.round((option.voteCount / totalVotes) * 100)
            : 0;
        message += `${index + 1}. ${option.text}: ${
          option.voteCount || 0
        } votos (${percentage}%)\n`;
      });

      message += `\nCompartilhado via VotaAí`;

      // Share as text
      await Share.share({
        message: message,
        title: "VotaAí - Resultados",
      });
    } catch (error) {
      console.error("Error sharing results:", error);
      Alert.alert("Erro", "Falha ao compartilhar resultados");
    } finally {
      setExporting(false);
    }
  };

  const handleExportAsMarkdown = async () => {
    if (!pool || isPoolActive) return;

    try {
      setExporting(true);

      // Generate content optimized for WhatsApp's text formatting
      const totalVotes = pool.options.reduce(
        (sum, option) => sum + (option.voteCount || 0),
        0
      );

      // Title with bold formatting
      let markdownContent = `*${pool.title}*\n\n`;

      // Basic info using bullet points
      markdownContent += `* *Categoria:* ${pool.category}\n`;
      markdownContent += `* *Status:* ${
        pool.status === "active" ? "Em andamento" : "Encerrada"
      }\n`;
      markdownContent += `* *Total de votos:* ${totalVotes}\n\n`;

      // Description in quote block if present
      if (pool.description && pool.description.trim() !== "") {
        // Split description by lines and add > to each line
        const descriptionLines = pool.description.split("\n");
        descriptionLines.forEach((line) => {
          markdownContent += `> _${line}_\n`;
        });
        markdownContent += "\n";
      }

      // Results header with code formatting
      markdownContent += `\`RESULTADOS\`\n\n`;

      // Sort options by vote count
      const sortedOptions = [...pool.options].sort(
        (a, b) => (b.voteCount || 0) - (a.voteCount || 0)
      );

      // Display each option with optimal WhatsApp formatting
      sortedOptions.forEach((option, index) => {
        const percentage =
          totalVotes > 0
            ? Math.round((option.voteCount / totalVotes) * 100)
            : 0;

        if (index === 0) {
          // First place gets special formatting
          markdownContent += `🏆 *1. ${option.text.toUpperCase()}* 🏆\n`;

          // Vote counts for first place with special formatting
          markdownContent += `   \`\`\`${
            option.voteCount || 0
          } votos (${percentage}%)\`\`\`\n`;

          // Special progress bar for first place
          const barLength = 15;
          const filledChars = Math.round((percentage / 100) * barLength);
          const bar =
            "★".repeat(filledChars) + "☆".repeat(barLength - filledChars);
          markdownContent += `   ${bar}\n\n`;

          // Add separator after first place
          markdownContent += `   ――――――――――――――\n\n`;
        } else {
          // Regular formatting for other places
          markdownContent += `${index + 1}. *${option.text}*\n`;

          // Vote counts in inline code format
          markdownContent += `   \`${
            option.voteCount || 0
          } votos (${percentage}%)\`\n`;

          // Progress bar with reduced length (15 characters)
          const barLength = 15;
          const filledChars = Math.round((percentage / 100) * barLength);
          const bar =
            "■".repeat(filledChars) + "□".repeat(barLength - filledChars);
          markdownContent += `   ${bar}\n\n`;
        }
      });

      // Simple footer with italics
      markdownContent += `_Gerado por VotaAí em ${new Date().toLocaleString()}_`;

      // Share directly as text message
      await Share.share({
        message: markdownContent,
        title: "VotaAí - Resultados",
      });
    } catch (error) {
      console.error("Error exporting as markdown:", error);
      Alert.alert("Erro", "Falha ao exportar como markdown");
    } finally {
      setExporting(false);
    }
  };

  const handleExportAsCSV = async () => {
    if (!pool || isPoolActive) return;

    try {
      setExporting(true);

      // Generate CSV content
      let csvContent = "Opção,Votos,Porcentagem\n";

      const totalVotes = pool.options.reduce(
        (sum, option) => sum + (option.voteCount || 0),
        0
      );

      // Sort options by vote count
      const sortedOptions = [...pool.options].sort(
        (a, b) => (b.voteCount || 0) - (a.voteCount || 0)
      );

      sortedOptions.forEach((option) => {
        const percentage =
          totalVotes > 0
            ? Math.round((option.voteCount / totalVotes) * 100)
            : 0;
        csvContent += `"${option.text}",${
          option.voteCount || 0
        },${percentage}%\n`;
      });

      // Add summary info
      csvContent += "\n";
      csvContent += `"Título","${pool.title}"\n`;
      csvContent += `"Categoria","${pool.category}"\n`;
      csvContent += `"Status","${
        pool.status === "active" ? "Em andamento" : "Encerrada"
      }"\n`;
      csvContent += `"Total de votos",${totalVotes}\n`;
      csvContent += `"Data de exportação","${new Date().toLocaleString()}"\n`;

      // Save the CSV file
      const fileName = `votaai-resultado-${pool.id}.csv`;
      const filePath = `${FileSystem.documentDirectory}${fileName}`;

      await FileSystem.writeAsStringAsync(filePath, csvContent, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      // Share the file
      await shareContent(
        filePath,
        "text/csv",
        "Resultados da votação em formato CSV"
      );
    } catch (error) {
      console.error("Error exporting as CSV:", error);
      Alert.alert("Erro", "Falha ao exportar como CSV");
    } finally {
      setExporting(false);
    }
  };

  // Simplified sharing function using React Native Share API
  const shareContent = async (
    uri: string,
    mimeType: string,
    message: string
  ) => {
    try {
      // If it's a file URI, format it for sharing
      let shareUri = uri;
      if (uri.startsWith(FileSystem.documentDirectory || "")) {
        // On iOS, we need to format the file URL differently
        if (Platform.OS === "ios") {
          shareUri = uri.replace("file://", "");
        }
      }

      // Use the React Native Share API
      await Share.share({
        url: shareUri,
        message: message,
        title: "VotaAí - Resultados",
      });
    } catch (error) {
      console.error("Error sharing:", error);
      Alert.alert("Erro", "Falha ao compartilhar");
    }
  };

  if (isLoading) {
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
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.light.tint} />
          <ThemedText style={styles.loadingText}>
            Carregando dados da votação...
          </ThemedText>
        </View>
      </View>
    );
  }

  if (errorMessage || !pool) {
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
        <View style={styles.errorContainer}>
          <ThemedText style={styles.errorText}>
            {errorMessage || "Erro ao carregar a votação"}
          </ThemedText>
          <TouchableOpacity
            style={[styles.button, { backgroundColor: Colors.light.tint }]}
            onPress={() => router.back()}
          >
            <ThemedText style={styles.buttonText}>Voltar</ThemedText>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Calculate total votes
  const totalVotes = pool.options.reduce(
    (sum, option) => sum + (option.voteCount || 0),
    0
  );

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

      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons
            name="arrow-back"
            size={24}
            color={isDark ? Colors.dark.text : Colors.light.text}
          />
        </TouchableOpacity>
        <ThemedText style={styles.headerTitle}>Exportar Resultados</ThemedText>
      </View>

      <ScrollView style={styles.scrollContainer}>
        <View style={styles.resultContainer}>
          <View
            style={[
              styles.poolCard,
              { backgroundColor: isDark ? "#1C1C1E" : "#FFFFFF" },
            ]}
          >
            <View style={styles.poolHeader}>
              <Text
                style={[
                  styles.poolCategory,
                  { color: isDark ? "#AEAEB2" : "#666666" },
                ]}
              >
                {pool.category}
              </Text>
              <Text
                style={[
                  styles.poolTitle,
                  { color: isDark ? "#FFFFFF" : "#000000" },
                ]}
              >
                {pool.title}
              </Text>
              <Text
                style={[
                  styles.poolStatus,
                  {
                    color: pool.status === "active" ? "#4CAF50" : "#F44336",
                  },
                ]}
              >
                {pool.status === "active" ? "Em andamento" : "Encerrada"}
              </Text>
            </View>

            <Text
              style={[
                styles.poolDescription,
                { color: isDark ? "#AEAEB2" : "#666666" },
              ]}
            >
              {pool.description}
            </Text>

            <View style={styles.totalVotesContainer}>
              <Ionicons
                name="people"
                size={18}
                color={isDark ? "#AEAEB2" : "#666666"}
              />
              <Text
                style={[
                  styles.totalVotesText,
                  { color: isDark ? "#AEAEB2" : "#666666" },
                ]}
              >
                Total de votos: {totalVotes}
              </Text>
            </View>

            <View style={styles.resultsContainer}>
              {pool.options
                .sort((a, b) => (b.voteCount || 0) - (a.voteCount || 0))
                .map((option, index) => {
                  const percentage =
                    totalVotes > 0
                      ? Math.round((option.voteCount / totalVotes) * 100)
                      : 0;

                  return (
                    <View key={index} style={styles.optionItem}>
                      <View style={styles.optionHeader}>
                        <Text
                          style={[
                            styles.optionText,
                            { color: isDark ? "#FFFFFF" : "#000000" },
                          ]}
                        >
                          {option.text}
                        </Text>
                        <Text
                          style={[
                            styles.optionVotes,
                            { color: isDark ? "#FFFFFF" : "#000000" },
                          ]}
                        >
                          {option.voteCount || 0}
                        </Text>
                      </View>

                      <View style={styles.progressContainer}>
                        <View
                          style={[
                            styles.progressBar,
                            {
                              width: `${percentage}%`,
                              backgroundColor:
                                index === 0
                                  ? "#4CAF50"
                                  : index === 1
                                  ? "#FF9800"
                                  : "#2196F3",
                            },
                          ]}
                        />
                        <Text
                          style={[
                            styles.progressText,
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

            <View style={styles.watermark}>
              <Text
                style={[
                  styles.watermarkText,
                  { color: isDark ? "#AEAEB2" : "#666666" },
                ]}
              >
                Exportado de VotaAí em {new Date().toLocaleString()}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.exportOptionsContainer}>
          <ThemedText style={styles.sectionTitle}>
            Opções de Exportação
          </ThemedText>

          <TouchableOpacity
            style={[
              styles.exportButton,
              { backgroundColor: isDark ? "#333333" : "#F5F5F5" },
            ]}
            onPress={handleExportAsImage}
            disabled={exporting}
          >
            <View style={styles.exportButtonContent}>
              <View
                style={[
                  styles.exportIconContainer,
                  { backgroundColor: "#FF9800" },
                ]}
              >
                <Ionicons name="text" size={24} color="#FFFFFF" />
              </View>
              <View style={styles.exportTextContainer}>
                <Text
                  style={[
                    styles.exportButtonTitle,
                    { color: isDark ? "#FFFFFF" : "#000000" },
                  ]}
                >
                  Compartilhar como Texto
                </Text>
                <Text
                  style={[
                    styles.exportButtonDescription,
                    { color: isDark ? "#AEAEB2" : "#666666" },
                  ]}
                >
                  Compartilhe os resultados em formato de texto
                </Text>
              </View>
            </View>
            <Ionicons
              name="chevron-forward"
              size={20}
              color={isDark ? "#AEAEB2" : "#666666"}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.exportButton,
              { backgroundColor: isDark ? "#333333" : "#F5F5F5" },
            ]}
            onPress={handleExportAsMarkdown}
            disabled={exporting}
          >
            <View style={styles.exportButtonContent}>
              <View
                style={[
                  styles.exportIconContainer,
                  { backgroundColor: "#2196F3" },
                ]}
              >
                <FontAwesome5 name="markdown" size={24} color="#FFFFFF" />
              </View>
              <View style={styles.exportTextContainer}>
                <Text
                  style={[
                    styles.exportButtonTitle,
                    { color: isDark ? "#FFFFFF" : "#000000" },
                  ]}
                >
                  Exportar como Markdown (.md)
                </Text>
                <Text
                  style={[
                    styles.exportButtonDescription,
                    { color: isDark ? "#AEAEB2" : "#666666" },
                  ]}
                >
                  Texto formatado ideal para documentação e relatórios
                </Text>
              </View>
            </View>
            <Ionicons
              name="chevron-forward"
              size={20}
              color={isDark ? "#AEAEB2" : "#666666"}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.exportButton,
              { backgroundColor: isDark ? "#333333" : "#F5F5F5" },
            ]}
            onPress={handleExportAsCSV}
            disabled={exporting}
          >
            <View style={styles.exportButtonContent}>
              <View
                style={[
                  styles.exportIconContainer,
                  { backgroundColor: "#4CAF50" },
                ]}
              >
                <MaterialIcons name="insert-chart" size={24} color="#FFFFFF" />
              </View>
              <View style={styles.exportTextContainer}>
                <Text
                  style={[
                    styles.exportButtonTitle,
                    { color: isDark ? "#FFFFFF" : "#000000" },
                  ]}
                >
                  Exportar como CSV
                </Text>
                <Text
                  style={[
                    styles.exportButtonDescription,
                    { color: isDark ? "#AEAEB2" : "#666666" },
                  ]}
                >
                  Dados em formato de planilha para análises detalhadas
                </Text>
              </View>
            </View>
            <Ionicons
              name="chevron-forward"
              size={20}
              color={isDark ? "#AEAEB2" : "#666666"}
            />
          </TouchableOpacity>
        </View>
      </ScrollView>

      {exporting && (
        <View style={styles.exportingOverlay}>
          <View
            style={[
              styles.exportingContainer,
              { backgroundColor: isDark ? "#1C1C1E" : "#FFFFFF" },
            ]}
          >
            <ActivityIndicator size="large" color={Colors.light.tint} />
            <Text
              style={[
                styles.exportingText,
                { color: isDark ? "#FFFFFF" : "#000000" },
              ]}
            >
              Exportando...
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 16,
    marginTop: 32,
    paddingBottom: 12,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginLeft: 12,
  },
  scrollContainer: {
    flex: 1,
  },
  resultContainer: {
    padding: 16,
  },
  poolCard: {
    borderRadius: 12,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  poolHeader: {
    marginBottom: 16,
  },
  poolCategory: {
    fontSize: 12,
    marginBottom: 4,
  },
  poolTitle: {
    fontSize: 22,
    fontWeight: "600",
    marginBottom: 8,
  },
  poolStatus: {
    fontSize: 14,
    fontWeight: "500",
  },
  poolDescription: {
    fontSize: 14,
    marginBottom: 16,
    lineHeight: 20,
  },
  totalVotesContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  totalVotesText: {
    fontSize: 14,
    marginLeft: 8,
  },
  resultsContainer: {
    marginBottom: 16,
  },
  optionItem: {
    marginBottom: 12,
  },
  optionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  optionText: {
    fontSize: 14,
    fontWeight: "500",
    flex: 1,
  },
  optionVotes: {
    fontSize: 14,
    fontWeight: "600",
    marginLeft: 8,
  },
  progressContainer: {
    height: 8,
    backgroundColor: "rgba(0, 0, 0, 0.05)",
    borderRadius: 4,
    overflow: "hidden",
    position: "relative",
  },
  progressBar: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: 4,
  },
  progressText: {
    position: "absolute",
    right: 0,
    top: 10,
    fontSize: 12,
  },
  watermark: {
    marginTop: 8,
    alignItems: "center",
  },
  watermarkText: {
    fontSize: 12,
  },
  exportOptionsContainer: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 16,
  },
  exportButton: {
    flexDirection: "row",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    alignItems: "center",
    justifyContent: "space-between",
  },
  exportButtonContent: {
    flexDirection: "row",
    flex: 1,
  },
  exportIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 16,
  },
  exportTextContainer: {
    flex: 1,
    justifyContent: "center",
  },
  exportButtonTitle: {
    fontSize: 16,
    fontWeight: "500",
    marginBottom: 4,
  },
  exportButtonDescription: {
    fontSize: 13,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  errorText: {
    fontSize: 16,
    textAlign: "center",
    marginBottom: 24,
    color: "#E53935",
  },
  button: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  buttonText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  exportingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  exportingContainer: {
    padding: 24,
    borderRadius: 12,
    alignItems: "center",
  },
  exportingText: {
    marginTop: 16,
    fontSize: 16,
    fontWeight: "500",
  },
});
