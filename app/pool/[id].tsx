import { FontAwesome5, Ionicons, MaterialIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  useColorScheme,
  View,
} from "react-native";
import { ThemedText } from "../../components/ThemedText";
import { VotingOptionCard } from "../../components/VotingOptionCard";
import { Colors } from "../../constants/Colors";
import { useAuth } from "../../context/AuthContext";
import { votesApi, votingPoolsApi } from "../../services/apiClient";
import { VotingPool } from "../../types";
import { formatDate, isVotingPoolActive } from "../../utils/helpers";
import { CustomModal } from "../../components/CustomModal";
import { useModal } from "../../hooks/useModal";

export default function VotingPoolDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { user } = useAuth();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const { visible, options, showModal, hideModal } = useModal();
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeletable, setIsDeletable] = useState(false);

  const [votingPool, setVotingPool] = useState<VotingPool | null>(null);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasVoted, setHasVoted] = useState(false);
  const [userVoteOptionId, setUserVoteOptionId] = useState<string | null>(null);

  // Check if the current user is an admin
  const isAdmin = user?.role === 2;

  // Calculate total votes
  const totalVotes =
    votingPool?.options.reduce((sum, option) => sum + option.voteCount, 0) || 0;

  useEffect(() => {
    const fetchVotingPool = async () => {
      if (!id || typeof id !== "string") return;

      try {
        setIsLoading(true);

        // Fetch voting pool details
        const pool = await votingPoolsApi.getVotingPoolById(id);

        if (!pool) {
          showModal({
            title: "Erro",
            message: "Votação não encontrada",
            type: "error",
            actions: [
              {
                text: "Voltar",
                onPress: () => {
                  hideModal();
                  router.back();
                },
              },
            ],
          });
          return;
        }

        setVotingPool(pool);

        // Check if pool is within first 24 hours of starting
        const startDate = new Date(pool.startDate);
        const now = new Date();
        const hoursElapsed =
          (now.getTime() - startDate.getTime()) / (1000 * 60 * 60);

        // Pool can be deleted if it's not yet started or if less than 24 hours have passed since starting
        const canDelete =
          pool.status === "upcoming" ||
          (pool.status === "active" && hoursElapsed <= 24);

        setIsDeletable(canDelete);

        if (user) {
          // Check if user has already voted in this pool
          const { hasVoted, optionId } = await votesApi.hasUserVoted(pool.id);
          setHasVoted(hasVoted);

          if (hasVoted && optionId) {
            setUserVoteOptionId(optionId);
          }
        }
      } catch (error) {
        console.error("Error fetching voting pool:", error);
        showModal({
          title: "Erro",
          message: "Falha ao carregar a votação",
          type: "error",
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchVotingPool();
  }, [id, user]);

  const handleSelectOption = (optionId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedOption(optionId);
  };

  const handleSubmitVote = async () => {
    if (!selectedOption || !votingPool || !user) {
      showModal({
        title: "Erro",
        message: "Você precisa estar logado para votar",
        type: "error",
      });
      return;
    }

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setIsSubmitting(true);

      // Submit vote
      await votesApi.submitVote(votingPool.id, selectedOption);

      // Show success message first
      showModal({
        title: "Sucesso",
        message: "Seu voto foi registrado com sucesso!",
        type: "success",
      });

      // Update UI
      setHasVoted(true);
      setUserVoteOptionId(selectedOption);

      // Try to refresh voting pool data to get updated vote counts,
      // but don't worry if it fails - the user can refresh manually
      try {
        const updatedPool = await votingPoolsApi.getVotingPoolById(
          votingPool.id,
          true
        );
        if (updatedPool) {
          setVotingPool(updatedPool);
        }
      } catch (refreshError) {
        console.error("Non-critical error refreshing pool data:", refreshError);
        // Don't show an error here as the vote still succeeded
      }
    } catch (error) {
      console.error("Error submitting vote:", error);
      showModal({
        title: "Erro",
        message: "Falha ao registrar seu voto. Tente novamente.",
        type: "error",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeletePool = () => {
    if (!isDeletable) {
      showModal({
        title: "Não Permitido",
        message:
          "Esta votação não pode mais ser excluída. Apenas votações dentro das primeiras 24 horas após o início podem ser excluídas.",
        type: "warning",
      });
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    showModal({
      title: "Excluir Votação",
      message:
        "Tem certeza que deseja excluir esta votação? Esta ação não pode ser desfeita.",
      type: "warning",
      actions: [
        {
          text: "Cancelar",
          onPress: () => hideModal(),
          style: "cancel",
        },
        {
          text: "Excluir",
          onPress: confirmDeletePool,
          style: "destructive",
        },
      ],
    });
  };

  const confirmDeletePool = async () => {
    if (!votingPool || !isAdmin) return;

    try {
      setIsDeleting(true);

      const success = await votingPoolsApi.deleteVotingPool(votingPool.id);

      if (success) {
        hideModal();

        // Show success message before navigating back
        showModal({
          title: "Sucesso",
          message: "A votação foi excluída com sucesso!",
          type: "success",
          actions: [
            {
              text: "OK",
              onPress: () => {
                hideModal();
                router.replace("/");
              },
            },
          ],
        });
      }
    } catch (error) {
      console.error("Error deleting voting pool:", error);

      showModal({
        title: "Erro",
        message: "Falha ao excluir a votação. Tente novamente.",
        type: "error",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  if (isLoading || !votingPool) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color={Colors.light.tint} />
        <ThemedText style={styles.loadingText}>
          Carregando votação...
        </ThemedText>
      </View>
    );
  }

  const isActive = isVotingPoolActive(votingPool.startDate, votingPool.endDate);
  const canVote = isActive && !hasVoted;
  const showResults = hasVoted || votingPool.status === "closed";

  // Get status text and color
  const getStatusInfo = () => {
    switch (votingPool.status) {
      case "active":
        return {
          text: "Ativa",
          color: "#4CAF50",
          icon: "check-circle" as const,
        };
      case "upcoming":
        return {
          text: "Em breve",
          color: "#FFC107",
          icon: "schedule" as const,
        };
      case "closed":
        return {
          text: "Encerrada",
          color: "#F44336",
          icon: "cancel" as const,
        };
      default:
        return {
          text: "Desconhecido",
          color: "#9E9E9E",
          icon: "help" as const,
        };
    }
  };

  const status = getStatusInfo();

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

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header Image */}
        <View style={styles.headerContainer}>
          {votingPool.imageData ? (
            <Image
              source={{ uri: votingPool.imageData }}
              style={styles.headerImage}
              contentFit="cover"
            />
          ) : (
            <View
              style={[
                styles.placeholderImage,
                { backgroundColor: isDark ? "#2C2C2E" : "#F2F2F7" },
              ]}
            >
              <FontAwesome5
                name="vote-yea"
                size={60}
                color={isDark ? "#4A4A4A" : "#C7C7CC"}
              />
            </View>
          )}

          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={24} color="white" />
          </TouchableOpacity>

          <View style={styles.headerInfo}>
            <View style={styles.categoryContainer}>
              <ThemedText style={styles.category}>
                {votingPool.category}
              </ThemedText>
            </View>

            <View
              style={[
                styles.statusBadge,
                { backgroundColor: status.color + "20" },
              ]}
            >
              <MaterialIcons
                name={status.icon}
                size={16}
                color={status.color}
              />
              <ThemedText style={[styles.statusText, { color: status.color }]}>
                {status.text}
              </ThemedText>
            </View>

            {/* Admin Delete Button - Moved inside headerInfo for better positioning */}
            {isAdmin && (
              <TouchableOpacity
                style={[
                  styles.deleteButton,
                  !isDeletable && styles.disabledButton,
                ]}
                onPress={handleDeletePool}
                disabled={isDeleting || !isDeletable}
              >
                {isDeleting ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <>
                    <Ionicons name="trash" size={16} color="white" />
                    <ThemedText style={styles.deleteButtonText}>
                      Excluir
                    </ThemedText>
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Content */}
        <View style={styles.contentContainer}>
          <ThemedText style={styles.title}>{votingPool.title}</ThemedText>

          <ThemedText style={styles.description}>
            {votingPool.description}
          </ThemedText>

          <View style={styles.metaContainer}>
            <View style={styles.metaItem}>
              <MaterialIcons
                name="event"
                size={18}
                color={isDark ? "#AEAEB2" : "#8E8E93"}
              />
              <ThemedText style={styles.metaText}>
                {votingPool.status === "upcoming"
                  ? `Inicia em ${formatDate(votingPool.startDate)}`
                  : votingPool.status === "closed"
                  ? `Encerrada em ${formatDate(votingPool.endDate)}`
                  : `Termina em ${formatDate(votingPool.endDate)}`}
              </ThemedText>
            </View>

            {votingPool.anonymous && (
              <View style={styles.metaItem}>
                <MaterialIcons
                  name="visibility-off"
                  size={18}
                  color={isDark ? "#AEAEB2" : "#8E8E93"}
                />
                <ThemedText style={styles.metaText}>Votação anônima</ThemedText>
              </View>
            )}

            <View style={styles.metaItem}>
              <FontAwesome5
                name="vote-yea"
                size={18}
                color={isDark ? "#AEAEB2" : "#8E8E93"}
              />
              <ThemedText style={styles.metaText}>
                {totalVotes} votos
              </ThemedText>
            </View>
          </View>

          {votingPool.location && (
            <View style={styles.locationContainer}>
              <MaterialIcons
                name="location-on"
                size={18}
                color={Colors.light.tint}
              />
              <ThemedText style={styles.locationText}>
                {votingPool.location.address}
              </ThemedText>
            </View>
          )}

          <View style={styles.optionsSection}>
            <ThemedText style={styles.sectionTitle}>
              {showResults ? "Resultados" : "Opções de Votação"}
            </ThemedText>

            {/* Message explaining that results will be visible after voting */}
            {!showResults && votingPool.status === "active" && (
              <View
                style={[
                  styles.voteToSeeContainer,
                  {
                    backgroundColor: isDark
                      ? "rgba(142, 142, 147, 0.2)"
                      : "rgba(142, 142, 147, 0.1)",
                  },
                ]}
              >
                <MaterialIcons
                  name="how-to-vote"
                  size={16}
                  color={isDark ? "#AEAEB2" : "#8E8E93"}
                />
                <ThemedText style={styles.voteToSeeText}>
                  Vote para ver os resultados parciais
                </ThemedText>
              </View>
            )}

            {(showResults
              ? [...votingPool.options].sort(
                  (a, b) => b.voteCount - a.voteCount
                )
              : votingPool.options
            ).map((option) => (
              <VotingOptionCard
                key={option.id}
                option={option}
                isSelected={selectedOption === option.id}
                isVoted={hasVoted}
                totalVotes={totalVotes}
                onSelect={() => handleSelectOption(option.id)}
                showResults={showResults}
              />
            ))}
          </View>
        </View>
      </ScrollView>

      {/* Vote Button */}
      {canVote && (
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[styles.voteButton, { opacity: selectedOption ? 1 : 0.6 }]}
            onPress={handleSubmitVote}
            disabled={!selectedOption || isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator color="white" />
            ) : (
              <>
                <FontAwesome5
                  name="vote-yea"
                  size={18}
                  color="white"
                  style={styles.buttonIcon}
                />
                <ThemedText style={styles.buttonText}>
                  Confirmar Voto
                </ThemedText>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* Already Voted Banner */}
      {hasVoted && votingPool.status === "active" && (
        <View style={styles.votedBanner}>
          <MaterialIcons name="check-circle" size={20} color="white" />
          <ThemedText style={styles.votedText}>
            Você já votou nesta votação
          </ThemedText>
        </View>
      )}

      {/* Upcoming or Closed Banner */}
      {(votingPool.status === "upcoming" || votingPool.status === "closed") && (
        <View
          style={[
            styles.votedBanner,
            {
              backgroundColor:
                votingPool.status === "upcoming" ? "#FFC107" : "#F44336",
            },
          ]}
        >
          <MaterialIcons
            name={votingPool.status === "upcoming" ? "schedule" : "cancel"}
            size={20}
            color="white"
          />
          <ThemedText style={styles.votedText}>
            {votingPool.status === "upcoming"
              ? `Votação começa em ${formatDate(votingPool.startDate)}`
              : "Votação encerrada"}
          </ThemedText>
        </View>
      )}

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
  loadingContainer: {
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  headerContainer: {
    position: "relative",
  },
  headerImage: {
    height: 250,
    width: "100%",
  },
  placeholderImage: {
    height: 250,
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  backButton: {
    position: "absolute",
    top: 40,
    left: 16,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    borderRadius: 20,
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  headerInfo: {
    position: "absolute",
    top: 40,
    right: 16,
    flexDirection: "column",
    alignItems: "flex-end",
    gap: 8,
  },
  categoryContainer: {
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  category: {
    color: "white",
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "600",
    marginLeft: 4,
  },
  contentContainer: {
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 12,
  },
  description: {
    fontSize: 16,
    marginBottom: 24,
    lineHeight: 24,
  },
  metaContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 16,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 16,
    marginBottom: 8,
  },
  metaText: {
    fontSize: 14,
    marginLeft: 6,
    opacity: 0.7,
  },
  locationContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 24,
    backgroundColor: Colors.light.tint + "10",
    padding: 12,
    borderRadius: 8,
  },
  locationText: {
    fontSize: 14,
    marginLeft: 8,
    flex: 1,
  },
  optionsSection: {
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "600",
    marginBottom: 16,
  },
  buttonContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    borderTopWidth: 1,
    borderTopColor: "rgba(0, 0, 0, 0.1)",
  },
  voteButton: {
    backgroundColor: Colors.light.tint,
    borderRadius: 12,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  buttonIcon: {
    marginRight: 8,
  },
  buttonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  votedBanner: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#4CAF50",
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  votedText: {
    color: "white",
    fontSize: 16,
    fontWeight: "500",
    marginLeft: 8,
  },
  deleteButton: {
    marginTop: 8,
    backgroundColor: "rgba(244, 67, 54, 0.9)",
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  disabledButton: {
    backgroundColor: "rgba(120, 120, 120, 0.6)",
  },
  deleteButtonText: {
    color: "white",
    fontSize: 12,
    fontWeight: "600",
    marginLeft: 4,
  },
  voteToSeeContainer: {
    padding: 12,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  voteToSeeText: {
    fontSize: 14,
    fontWeight: "600",
    marginLeft: 8,
  },
});
