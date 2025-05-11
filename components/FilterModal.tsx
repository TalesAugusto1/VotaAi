import React, { useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  TouchableWithoutFeedback,
  useColorScheme,
} from "react-native";
import { ThemedText } from "./ThemedText";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../constants/Colors";

// Filter options for voting pools
export interface FilterOptions {
  category: string | null;
  status: "all" | "active" | "upcoming" | "closed";
  sortBy: "newest" | "oldest" | "mostVotes" | "endingSoon";
  onlyLocation: boolean;
}

interface FilterModalProps {
  visible: boolean;
  onClose: () => void;
  onApplyFilters: (filters: FilterOptions) => void;
  initialFilters: FilterOptions;
  categories: string[];
}

export function FilterModal({
  visible,
  onClose,
  onApplyFilters,
  initialFilters,
  categories,
}: FilterModalProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";

  // Local state for filter options
  const [filters, setFilters] = useState<FilterOptions>(initialFilters);

  // Reset to initial filters when modal opens
  useEffect(() => {
    if (visible) {
      setFilters(initialFilters);
    }
  }, [visible, initialFilters]);

  const handleApply = () => {
    onApplyFilters(filters);
    onClose();
  };

  const handleReset = () => {
    const resetFilters: FilterOptions = {
      category: null,
      status: "all",
      sortBy: "newest",
      onlyLocation: false,
    };
    setFilters(resetFilters);
    onApplyFilters(resetFilters);
    onClose();
  };

  // Status button component
  const StatusButton = ({
    status,
    label,
  }: {
    status: "all" | "active" | "upcoming" | "closed";
    label: string;
  }) => (
    <TouchableOpacity
      style={[
        styles.statusButton,
        { backgroundColor: isDark ? "#2C2C2E" : "#F2F2F7" },
        filters.status === status && {
          backgroundColor: Colors.light.tint + "20",
          borderColor: Colors.light.tint,
          borderWidth: 1,
        },
      ]}
      onPress={() => setFilters({ ...filters, status })}
    >
      <ThemedText
        style={[
          styles.statusText,
          filters.status === status && {
            color: Colors.light.tint,
            fontWeight: "600",
          },
        ]}
      >
        {label}
      </ThemedText>
    </TouchableOpacity>
  );

  // Sort option component
  const SortOption = ({
    value,
    label,
  }: {
    value: FilterOptions["sortBy"];
    label: string;
  }) => (
    <TouchableOpacity
      style={[
        styles.sortOption,
        filters.sortBy === value && {
          backgroundColor: isDark ? "#2C2C2E" : "#F2F2F7",
        },
      ]}
      onPress={() => setFilters({ ...filters, sortBy: value })}
    >
      <ThemedText style={styles.sortOptionText}>{label}</ThemedText>
      {filters.sortBy === value && (
        <Ionicons name="checkmark-circle" size={22} color={Colors.light.tint} />
      )}
    </TouchableOpacity>
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
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
              <View style={styles.header}>
                <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                  <Ionicons
                    name="close"
                    size={24}
                    color={isDark ? "#FFFFFF" : "#000000"}
                  />
                </TouchableOpacity>
                <ThemedText style={styles.title}>Filtrar Votações</ThemedText>
                <TouchableOpacity onPress={handleReset}>
                  <ThemedText style={styles.resetText}>Limpar</ThemedText>
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.content}>
                {/* Categories */}
                <View style={styles.section}>
                  <ThemedText style={styles.sectionTitle}>
                    Categorias
                  </ThemedText>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.categoriesContainer}
                  >
                    <TouchableOpacity
                      style={[
                        styles.categoryChip,
                        { backgroundColor: isDark ? "#2C2C2E" : "#F2F2F7" },
                        filters.category === null && {
                          backgroundColor: Colors.light.tint + "20",
                          borderColor: Colors.light.tint,
                          borderWidth: 1,
                        },
                      ]}
                      onPress={() => setFilters({ ...filters, category: null })}
                    >
                      <ThemedText
                        style={[
                          styles.categoryText,
                          filters.category === null && {
                            color: Colors.light.tint,
                          },
                        ]}
                      >
                        Todas
                      </ThemedText>
                    </TouchableOpacity>

                    {categories.map((category) => (
                      <TouchableOpacity
                        key={category}
                        style={[
                          styles.categoryChip,
                          { backgroundColor: isDark ? "#2C2C2E" : "#F2F2F7" },
                          filters.category === category && {
                            backgroundColor: Colors.light.tint + "20",
                            borderColor: Colors.light.tint,
                            borderWidth: 1,
                          },
                        ]}
                        onPress={() => setFilters({ ...filters, category })}
                      >
                        <ThemedText
                          style={[
                            styles.categoryText,
                            filters.category === category && {
                              color: Colors.light.tint,
                            },
                          ]}
                        >
                          {category}
                        </ThemedText>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>

                {/* Status */}
                <View style={styles.section}>
                  <ThemedText style={styles.sectionTitle}>Status</ThemedText>
                  <View style={styles.statusContainer}>
                    <StatusButton status="all" label="Todas" />
                    <StatusButton status="active" label="Ativas" />
                    <StatusButton status="upcoming" label="Em Breve" />
                    <StatusButton status="closed" label="Encerradas" />
                  </View>
                </View>

                {/* Location filter */}
                <View style={styles.section}>
                  <View style={styles.switchRow}>
                    <ThemedText style={styles.switchLabel}>
                      Apenas votações com localização
                    </ThemedText>
                    <TouchableOpacity
                      style={[
                        styles.switchButton,
                        {
                          backgroundColor: filters.onlyLocation
                            ? Colors.light.tint
                            : isDark
                            ? "#2C2C2E"
                            : "#F2F2F7",
                        },
                      ]}
                      onPress={() =>
                        setFilters({
                          ...filters,
                          onlyLocation: !filters.onlyLocation,
                        })
                      }
                    >
                      <View
                        style={[
                          styles.switchThumb,
                          {
                            backgroundColor: "#FFFFFF",
                            transform: [
                              { translateX: filters.onlyLocation ? 18 : 2 },
                            ],
                          },
                        ]}
                      />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Sort by */}
                <View style={styles.section}>
                  <ThemedText style={styles.sectionTitle}>
                    Ordenar por
                  </ThemedText>
                  <View style={styles.sortContainer}>
                    <SortOption value="newest" label="Mais recentes" />
                    <SortOption value="oldest" label="Mais antigas" />
                    <SortOption value="mostVotes" label="Mais votadas" />
                    <SortOption
                      value="endingSoon"
                      label="Terminando em breve"
                    />
                  </View>
                </View>
              </ScrollView>

              <View style={styles.footer}>
                <TouchableOpacity
                  style={[
                    styles.applyButton,
                    { backgroundColor: Colors.light.tint },
                  ]}
                  onPress={handleApply}
                >
                  <ThemedText style={styles.applyButtonText}>
                    Aplicar Filtros
                  </ThemedText>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  container: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "80%",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: "rgba(150, 150, 150, 0.2)",
  },
  closeButton: {
    padding: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
  },
  resetText: {
    color: Colors.light.tint,
    fontSize: 14,
  },
  content: {
    paddingHorizontal: 16,
  },
  section: {
    marginVertical: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 12,
  },
  categoriesContainer: {
    paddingVertical: 4,
    gap: 8,
  },
  categoryChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
  },
  categoryText: {
    fontSize: 14,
  },
  statusContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  statusButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    minWidth: "22%",
    alignItems: "center",
  },
  statusText: {
    fontSize: 14,
  },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  switchLabel: {
    fontSize: 16,
  },
  switchButton: {
    width: 46,
    height: 28,
    borderRadius: 14,
    padding: 2,
  },
  switchThumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  sortContainer: {
    gap: 2,
  },
  sortOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  sortOptionText: {
    fontSize: 16,
  },
  footer: {
    padding: 16,
    borderTopWidth: 0.5,
    borderTopColor: "rgba(150, 150, 150, 0.2)",
  },
  applyButton: {
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  applyButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
});
