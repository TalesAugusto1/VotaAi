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
import {
  Ionicons,
  MaterialIcons,
  FontAwesome5,
  AntDesign,
} from "@expo/vector-icons";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import { ThemedText } from "../components/ThemedText";
import { Colors } from "../constants/Colors";
import { votingPoolsApi } from "../services/apiClient";
import { VotingPool } from "../types";
import ViewShot from "react-native-view-shot";

export default function ExportResultsScreen() {
  const [pool, setPool] = useState<VotingPool | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [isPoolActive, setIsPoolActive] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);

  // Reference for capturing the image view
  const imageViewRef = useRef<ViewShot>(null);

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

  // Function to export as simple text
  const handleExportAsText = async () => {
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

  // Function to export as JPEG image
  const handleExportAsImage = async () => {
    if (!pool || isPoolActive) return;

    try {
      setExporting(true);
      console.log("Starting image export process...");

      if (!imageViewRef.current) {
        throw new Error("Image view reference not available");
      }

      // Make the ViewShot component visible before capturing
      setIsCapturing(true);

      // Wait for the component to render fully
      console.log("Waiting for component to render...");
      await new Promise((resolve) => setTimeout(resolve, 1000));

      console.log("Attempting to capture view...");
      // Capture options explicitly defined
      const captureOptions = {
        format: "jpg",
        quality: 0.9,
        result: "file",
      };

      // Explicitly type-cast the ref to avoid TypeScript errors
      const viewShot = imageViewRef.current as any;

      // Generate a unique file path
      const fileName = `votaai-${pool.id}-${Date.now()}.jpg`;
      const filePath = `${FileSystem.cacheDirectory}${fileName}`;
      console.log("Target file path:", filePath);

      try {
        // Directly capture to a file
        const result = await viewShot.capture(captureOptions);
        console.log("Capture result:", result);

        // Hide the ViewShot component again
        setIsCapturing(false);

        if (!result) {
          throw new Error("Failed to capture image - empty result");
        }

        // Check if the capture resulted in a file
        const fileInfo = await FileSystem.getInfoAsync(result);
        console.log("File info after capture:", fileInfo);

        if (!fileInfo.exists) {
          console.error("Captured file does not exist at path:", result);
          throw new Error("Captured file doesn't exist");
        }

        // Move the file to our target path
        await FileSystem.moveAsync({
          from: result,
          to: filePath,
        });

        // Verify the final file
        const finalFileInfo = await FileSystem.getInfoAsync(filePath);
        console.log("Final file info:", finalFileInfo);

        if (!finalFileInfo.exists) {
          throw new Error("Failed to save final image file");
        }

        // Share the file
        console.log("Attempting to share file:", filePath);

        // Check if sharing is available (always true for Android/iOS)
        const canShare = await Sharing.isAvailableAsync();

        if (canShare) {
          // Use expo-sharing which handles content URIs properly
          console.log("Using Expo Sharing to share file");
          await Sharing.shareAsync(filePath, {
            mimeType: "image/jpeg",
            dialogTitle: "Compartilhar resultados da votação",
            UTI: "public.jpeg", // For iOS
          });
          console.log("Expo Sharing completed successfully");
        } else {
          // Fallback to regular share (should not happen on mobile)
          console.log("Falling back to regular Share API");

          // Use the appropriate sharing method based on platform
          if (Platform.OS === "ios") {
            await Share.share(
              {
                url: filePath,
                message: `Resultados da votação: ${pool.title}`,
                title: "Resultados da Votação",
              },
              {
                subject: "Resultados da Votação",
                dialogTitle: "Compartilhar resultados",
              }
            );
          } else {
            // On Android with explicit mime type
            await Share.share(
              {
                title: "Resultados da Votação",
                message: `Resultados da votação: ${pool.title}`,
                url: `file://${filePath}`,
              },
              {
                dialogTitle: "Compartilhar resultados da votação",
              }
            );
          }
          console.log("Regular Share completed successfully");
        }
      } catch (innerError: any) {
        console.error("Inner error during capture/share:", innerError);

        // Fallback: try to capture as base64 and save manually if direct file capture failed
        try {
          console.log("Attempting fallback capture method...");

          // Try to capture as base64
          const base64Image = await viewShot.capture({
            format: "jpg",
            quality: 0.9,
            result: "base64",
          });

          // Hide the ViewShot component
          setIsCapturing(false);

          if (!base64Image) {
            throw new Error("Fallback capture failed - empty result");
          }

          console.log("Base64 image captured, length:", base64Image.length);

          // Write the base64 data to a file
          await FileSystem.writeAsStringAsync(filePath, base64Image, {
            encoding: FileSystem.EncodingType.Base64,
          });

          // Verify the file
          const fileInfo = await FileSystem.getInfoAsync(filePath);
          console.log("Fallback file info:", fileInfo);

          if (!fileInfo.exists || fileInfo.size === 0) {
            throw new Error("Failed to write image file (fallback method)");
          }

          // Share the file using Expo Sharing
          if (await Sharing.isAvailableAsync()) {
            await Sharing.shareAsync(filePath, {
              mimeType: "image/jpeg",
              dialogTitle: "Compartilhar resultados da votação",
            });
          } else {
            // Fallback to regular Share API
            if (Platform.OS === "ios") {
              await Share.share({
                url: filePath,
                message: `Resultados da votação: ${pool.title}`,
              });
            } else {
              await Share.share(
                {
                  message: `Resultados da votação: ${pool.title}`,
                  url: `file://${filePath}`,
                },
                {
                  dialogTitle: "Compartilhar resultados da votação",
                }
              );
            }
          }

          console.log("Fallback share completed");
        } catch (fallbackError: any) {
          console.error("Fallback method failed:", fallbackError);
          throw new Error(
            `Fallback capture/save failed: ${
              fallbackError?.message || "unknown error"
            }`
          );
        }
      }
    } catch (error: any) {
      console.error("Error in image export process:", error);
      // Hide the ViewShot component if still visible due to error
      setIsCapturing(false);
      Alert.alert(
        "Erro ao Exportar",
        `Não foi possível exportar a imagem: ${
          error?.message || "Erro desconhecido"
        }`
      );
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

      // Generate CSV content as text
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

      // Share directly as text instead of saving a file
      await Share.share({
        message: csvContent,
        title: "VotaAí - Resultados em CSV",
      });
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

      {/* ViewShot component for capturing */}
      {pool && (
        <ViewShot
          ref={imageViewRef}
          options={{
            fileName: `votaai-resultado-${pool.id}`,
            format: "jpg",
            quality: 0.9,
          }}
          style={[
            styles.imageContainer,
            {
              backgroundColor: isDark ? "#1C1C1E" : "#FFFFFF",
              // Only position for capture when actively capturing
              position: isCapturing ? "absolute" : "absolute",
              top: isCapturing ? 0 : -5000,
              left: isCapturing ? 0 : -5000,
              width: 390, // iPhone 12/13 width for better quality
              height: 844, // iPhone 12/13 height
              padding: 20,
              zIndex: isCapturing ? 100 : -1,
            },
          ]}
        >
          {/* Image content */}
          <View style={styles.imageHeader}>
            <Image
              source={require("../assets/images/logo.png")}
              style={styles.imageLogo}
              resizeMode="contain"
            />
            <Text
              style={[
                styles.imageTitle,
                { color: isDark ? "#FFFFFF" : "#000000" },
              ]}
            >
              {pool.title}
            </Text>
          </View>

          {/* Only show pool image if it exists in the pool data */}
          {pool.hasImage && pool.imageData && (
            <Image
              source={{ uri: `data:image/jpeg;base64,${pool.imageData}` }}
              style={styles.poolImage}
              resizeMode="cover"
            />
          )}

          <View style={styles.imageInfoContainer}>
            <Text
              style={[
                styles.imageInfoText,
                { color: isDark ? "#AEAEB2" : "#666666" },
              ]}
            >
              <Text style={{ fontWeight: "bold" }}>Categoria:</Text>{" "}
              {pool.category}
            </Text>
            <Text
              style={[
                styles.imageInfoText,
                { color: isDark ? "#AEAEB2" : "#666666" },
              ]}
            >
              <Text style={{ fontWeight: "bold" }}>Total de votos:</Text>{" "}
              {totalVotes}
            </Text>
          </View>

          <View style={styles.imageResultsContainer}>
            {pool.options
              .sort((a, b) => (b.voteCount || 0) - (a.voteCount || 0))
              .map((option, index) => {
                const percentage =
                  totalVotes > 0
                    ? Math.round((option.voteCount / totalVotes) * 100)
                    : 0;

                return (
                  <View key={index} style={styles.imageOptionItem}>
                    <View style={styles.imageOptionHeader}>
                      <Text
                        style={[
                          styles.imageOptionText,
                          {
                            color: isDark ? "#FFFFFF" : "#000000",
                            fontWeight: index === 0 ? "700" : "500",
                          },
                        ]}
                      >
                        {index === 0 ? "🏆 " : ""}
                        {option.text}
                      </Text>
                      <Text
                        style={[
                          styles.imageOptionVotes,
                          { color: isDark ? "#FFFFFF" : "#000000" },
                        ]}
                      >
                        {option.voteCount || 0}
                      </Text>
                    </View>

                    <View style={styles.imageProgressContainer}>
                      <View
                        style={[
                          styles.imageProgressBar,
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
                          styles.imageProgressText,
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

          <View style={styles.imageFooter}>
            <Text
              style={[
                styles.imageFooterText,
                { color: isDark ? "#AEAEB2" : "#666666" },
              ]}
            >
              Gerado por VotaAí em {new Date().toLocaleString()}
            </Text>
          </View>
        </ViewShot>
      )}

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

          {/* New image export button */}
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
                  { backgroundColor: "#E91E63" },
                ]}
              >
                <AntDesign name="picture" size={24} color="#FFFFFF" />
              </View>
              <View style={styles.exportTextContainer}>
                <Text
                  style={[
                    styles.exportButtonTitle,
                    { color: isDark ? "#FFFFFF" : "#000000" },
                  ]}
                >
                  Exportar como Imagem
                </Text>
                <Text
                  style={[
                    styles.exportButtonDescription,
                    { color: isDark ? "#AEAEB2" : "#666666" },
                  ]}
                >
                  Gera uma imagem com os resultados para compartilhar facilmente
                </Text>
              </View>
            </View>
            <Ionicons
              name="chevron-forward"
              size={20}
              color={isDark ? "#AEAEB2" : "#666666"}
            />
          </TouchableOpacity>

          {/* Text export button */}
          <TouchableOpacity
            style={[
              styles.exportButton,
              { backgroundColor: isDark ? "#333333" : "#F5F5F5" },
            ]}
            onPress={handleExportAsText}
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
                  Compartilhe os resultados em formato de texto simples
                </Text>
              </View>
            </View>
            <Ionicons
              name="chevron-forward"
              size={20}
              color={isDark ? "#AEAEB2" : "#666666"}
            />
          </TouchableOpacity>

          {/* Markdown export button */}
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

          {/* CSV export button */}
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
  // Styles for the image capture view
  imageContainer: {
    position: "absolute",
    width: 375, // More standard mobile width
    height: 812, // More standard mobile height
    padding: 20,
    borderRadius: 0,
  },
  imageLogo: {
    width: 100,
    height: 40,
    marginBottom: 10,
  },
  imageHeader: {
    alignItems: "center",
    marginBottom: 20,
  },
  imageTitle: {
    fontSize: 32,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 10,
  },
  poolImage: {
    width: "100%",
    height: 300,
    borderRadius: 16,
    marginBottom: 20,
  },
  imageInfoContainer: {
    marginBottom: 30,
    padding: 16,
    backgroundColor: "rgba(0,0,0,0.05)",
    borderRadius: 12,
  },
  imageInfoText: {
    fontSize: 18,
    marginBottom: 8,
  },
  imageResultsContainer: {
    marginBottom: 30,
  },
  imageOptionItem: {
    marginBottom: 20,
  },
  imageOptionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  imageOptionText: {
    fontSize: 22,
    fontWeight: "500",
    flex: 1,
  },
  imageOptionVotes: {
    fontSize: 22,
    fontWeight: "600",
    marginLeft: 8,
  },
  imageProgressContainer: {
    height: 20,
    backgroundColor: "rgba(0, 0, 0, 0.05)",
    borderRadius: 10,
    overflow: "hidden",
    position: "relative",
  },
  imageProgressBar: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: 10,
  },
  imageProgressText: {
    position: "absolute",
    right: 10,
    top: 0,
    fontSize: 16,
    fontWeight: "bold",
    lineHeight: 20,
  },
  imageFooter: {
    marginTop: 30,
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.1)",
    paddingTop: 20,
  },
  imageFooterText: {
    fontSize: 16,
  },
});
