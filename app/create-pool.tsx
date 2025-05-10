import { Ionicons } from "@expo/vector-icons";
import {
  DateTimePickerAndroid,
  DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  TextInput,
  TouchableOpacity,
  View,
  useColorScheme,
} from "react-native";
import { ThemedText } from "../components/ThemedText";
import { ThemedView } from "../components/ThemedView";
import { Colors } from "../constants/Colors";
import { useAuth } from "../context/AuthContext";
import { votingPoolsApi } from "../services/apiClient";

// Define interfaces for type safety
interface OptionForm {
  text: string;
  description: string;
}

interface PoolFormData {
  title: string;
  description: string;
  category: string;
  startDate: Date;
  endDate: Date;
  anonymous: boolean;
  options: {
    text: string;
    description: string | undefined;
  }[];
  address?: string;
  latitude?: number;
  longitude?: number;
}

export default function CreatePoolScreen() {
  const { user } = useAuth();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(
    new Date(new Date().setDate(new Date().getDate() + 7))
  );
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [image, setImage] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [options, setOptions] = useState<OptionForm[]>([
    { text: "", description: "" },
    { text: "", description: "" },
  ]);
  const [optionImages, setOptionImages] = useState<
    (ImagePicker.ImagePickerAsset | null)[]
  >([null, null]);
  const [address, setAddress] = useState("");
  const [error, setError] = useState("");

  // Check admin status
  useEffect(() => {
    if (!user || user.role !== 2) {
      Alert.alert(
        "Acesso Restrito",
        "Apenas administradores podem criar novas votações.",
        [
          {
            text: "OK",
            onPress: () => router.back(),
          },
        ]
      );
    }
  }, [user]);

  const showStartDatePicker = () => {
    DateTimePickerAndroid.open({
      value: startDate,
      onChange: (event: DateTimePickerEvent, selectedDate?: Date) => {
        if (selectedDate) {
          setStartDate(selectedDate);

          // If end date is before start date, update it
          if (endDate < selectedDate) {
            const newEndDate = new Date(selectedDate);
            newEndDate.setDate(selectedDate.getDate() + 7);
            setEndDate(newEndDate);
          }
        }
      },
      mode: "date",
      is24Hour: true,
    });
  };

  const showEndDatePicker = () => {
    DateTimePickerAndroid.open({
      value: endDate,
      onChange: (event: DateTimePickerEvent, selectedDate?: Date) => {
        if (selectedDate) {
          setEndDate(selectedDate);
        }
      },
      mode: "date",
      is24Hour: true,
      minimumDate: startDate,
    });
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.8,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      setImage(result.assets[0]);
    }
  };

  const pickOptionImage = async (index: number) => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.7,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      const newOptionImages = [...optionImages];
      newOptionImages[index] = result.assets[0];
      setOptionImages(newOptionImages);
    }
  };

  const addOption = () => {
    if (options.length < 10) {
      setOptions([...options, { text: "", description: "" }]);
      setOptionImages([...optionImages, null]);
    } else {
      Alert.alert("Limite Atingido", "Máximo de 10 opções permitidas.");
    }
  };

  const removeOption = (index: number) => {
    if (options.length > 2) {
      const newOptions = [...options];
      newOptions.splice(index, 1);
      setOptions(newOptions);

      const newOptionImages = [...optionImages];
      newOptionImages.splice(index, 1);
      setOptionImages(newOptionImages);
    } else {
      Alert.alert(
        "Opções Mínimas",
        "Uma votação precisa ter pelo menos 2 opções."
      );
    }
  };

  const updateOption = (
    index: number,
    field: keyof OptionForm,
    value: string
  ) => {
    const newOptions = [...options];
    newOptions[index] = { ...newOptions[index], [field]: value };
    setOptions(newOptions);
  };

  const validateForm = () => {
    if (!title.trim()) {
      setError("Título é obrigatório");
      return false;
    }

    if (title.trim().length < 3) {
      setError("Título deve ter pelo menos 3 caracteres");
      return false;
    }

    if (title.trim().length > 100) {
      setError("Título deve ter no máximo 100 caracteres");
      return false;
    }

    if (!description.trim()) {
      setError("Descrição é obrigatória");
      return false;
    }

    if (description.trim().length < 10) {
      setError("Descrição deve ter pelo menos 10 caracteres");
      return false;
    }

    if (!category.trim()) {
      setError("Categoria é obrigatória");
      return false;
    }

    // Check if end date is after start date
    if (endDate <= startDate) {
      setError("Data de término deve ser posterior à data de início");
      return false;
    }

    // Validate options
    for (let i = 0; i < options.length; i++) {
      if (!options[i].text.trim()) {
        setError(`Opção ${i + 1} precisa ter um texto`);
        return false;
      }

      if (options[i].text.trim().length < 2) {
        setError(`Opção ${i + 1} deve ter pelo menos 2 caracteres`);
        return false;
      }

      if (options[i].text.trim().length > 50) {
        setError(`Opção ${i + 1} deve ter no máximo 50 caracteres`);
        return false;
      }
    }

    // Validate that at least 2 options exist
    if (options.length < 2) {
      setError("Votação precisa ter pelo menos 2 opções");
      return false;
    }

    return true;
  };

  const handleSubmit = async () => {
    setError("");

    if (!validateForm()) {
      return;
    }

    try {
      setIsSubmitting(true);

      // Prepare data for API
      const poolData: PoolFormData = {
        title,
        description,
        category,
        startDate,
        endDate,
        anonymous: isAnonymous,
        options: options.map(({ text, description }) => ({
          text,
          description: description || undefined,
        })),
      };

      // Add location if provided
      if (address.trim()) {
        poolData.address = address;
        // In a real app, you'd convert address to coordinates
        // poolData.latitude = latitude;
        // poolData.longitude = longitude;
      }

      console.log("Submitting pool data:", JSON.stringify(poolData));
      console.log(
        `Uploading ${optionImages.filter(Boolean).length} option images`
      );

      try {
        // Create voting pool
        const response = await votingPoolsApi.createVotingPool(
          poolData,
          image,
          optionImages.filter(Boolean)
        );

        console.log("Pool created successfully", response);
        Alert.alert("Sucesso", "Votação criada com sucesso!", [
          {
            text: "OK",
            onPress: () => router.back(),
          },
        ]);
      } catch (apiError) {
        console.error("API Error creating voting pool:", apiError);
        const message =
          apiError instanceof Error
            ? apiError.message
            : "Erro desconhecido ao criar votação";

        Alert.alert("Erro ao criar votação", message, [
          { text: "Tentar novamente", onPress: () => setIsSubmitting(false) },
        ]);
        setError(message);
      }
    } catch (error) {
      console.error("Error creating voting pool:", error);
      setError(
        error instanceof Error
          ? error.message
          : "Falha ao criar votação. Tente novamente."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString("pt-BR");
  };

  if (!user || user.role !== 2) {
    return null; // Will redirect via useEffect
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
    >
      <StatusBar style={isDark ? "light" : "dark"} />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Ionicons
              name="arrow-back"
              size={24}
              color={isDark ? "#FFFFFF" : "#000000"}
            />
          </TouchableOpacity>
          <ThemedText style={styles.title}>Nova Votação</ThemedText>
        </View>

        <ThemedView style={styles.formContainer}>
          <ThemedText style={styles.label}>Título</ThemedText>
          <TextInput
            style={[styles.input, { color: isDark ? "#FFFFFF" : "#000000" }]}
            placeholder="Título da votação"
            placeholderTextColor="#8E8E93"
            value={title}
            onChangeText={setTitle}
          />

          <ThemedText style={styles.label}>Descrição</ThemedText>
          <TextInput
            style={[styles.textArea, { color: isDark ? "#FFFFFF" : "#000000" }]}
            placeholder="Descreva a votação em detalhes..."
            placeholderTextColor="#8E8E93"
            multiline
            numberOfLines={4}
            value={description}
            onChangeText={setDescription}
          />

          <ThemedText style={styles.label}>Categoria</ThemedText>
          <TextInput
            style={[styles.input, { color: isDark ? "#FFFFFF" : "#000000" }]}
            placeholder="Ex: Infraestrutura, Educação, Saúde..."
            placeholderTextColor="#8E8E93"
            value={category}
            onChangeText={setCategory}
          />

          <View style={styles.dateContainer}>
            <View style={styles.dateField}>
              <ThemedText style={styles.label}>Data de Início</ThemedText>
              <TouchableOpacity
                style={styles.dateButton}
                onPress={showStartDatePicker}
              >
                <ThemedText style={styles.dateText}>
                  {formatDate(startDate)}
                </ThemedText>
                <Ionicons name="calendar" size={20} color={Colors.light.tint} />
              </TouchableOpacity>
            </View>

            <View style={styles.dateField}>
              <ThemedText style={styles.label}>Data de Término</ThemedText>
              <TouchableOpacity
                style={styles.dateButton}
                onPress={showEndDatePicker}
              >
                <ThemedText style={styles.dateText}>
                  {formatDate(endDate)}
                </ThemedText>
                <Ionicons name="calendar" size={20} color={Colors.light.tint} />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.switchContainer}>
            <ThemedText style={styles.label}>Votação Anônima</ThemedText>
            <Switch
              value={isAnonymous}
              onValueChange={setIsAnonymous}
              trackColor={{ false: "#767577", true: Colors.light.tint }}
              thumbColor={isAnonymous ? "#FFFFFF" : "#f4f3f4"}
            />
          </View>

          <ThemedText style={styles.label}>Imagem da Votação</ThemedText>
          <TouchableOpacity
            style={styles.imagePickerButton}
            onPress={pickImage}
          >
            {image ? (
              <Image
                source={{ uri: image.uri }}
                style={styles.previewImage}
                contentFit="cover"
              />
            ) : (
              <View style={styles.imagePlaceholder}>
                <Ionicons name="image" size={40} color="#8E8E93" />
                <ThemedText style={styles.imagePlaceholderText}>
                  Toque para selecionar
                </ThemedText>
              </View>
            )}
          </TouchableOpacity>

          <ThemedText style={styles.label}>Localização (opcional)</ThemedText>
          <TextInput
            style={[styles.input, { color: isDark ? "#FFFFFF" : "#000000" }]}
            placeholder="Endereço"
            placeholderTextColor="#8E8E93"
            value={address}
            onChangeText={setAddress}
          />

          <ThemedText style={styles.sectionTitle}>Opções de Votação</ThemedText>
          {options.map((option, index) => (
            <View key={index} style={styles.optionContainer}>
              <View style={styles.optionHeader}>
                <ThemedText style={styles.optionTitle}>
                  Opção {index + 1}
                </ThemedText>
                <TouchableOpacity
                  style={styles.removeOptionButton}
                  onPress={() => removeOption(index)}
                >
                  <Ionicons name="trash" size={20} color="#FF3B30" />
                </TouchableOpacity>
              </View>

              <TextInput
                style={[
                  styles.input,
                  { color: isDark ? "#FFFFFF" : "#000000" },
                ]}
                placeholder="Texto da opção"
                placeholderTextColor="#8E8E93"
                value={option.text}
                onChangeText={(value) => updateOption(index, "text", value)}
              />

              <TextInput
                style={[
                  styles.input,
                  { color: isDark ? "#FFFFFF" : "#000000" },
                ]}
                placeholder="Descrição (opcional)"
                placeholderTextColor="#8E8E93"
                value={option.description}
                onChangeText={(value) =>
                  updateOption(index, "description", value)
                }
              />

              <TouchableOpacity
                style={styles.optionImageButton}
                onPress={() => pickOptionImage(index)}
              >
                {optionImages[index] ? (
                  <Image
                    source={{ uri: optionImages[index]?.uri }}
                    style={styles.optionPreviewImage}
                    contentFit="cover"
                  />
                ) : (
                  <View style={styles.optionImagePlaceholder}>
                    <Ionicons name="image-outline" size={24} color="#8E8E93" />
                    <ThemedText style={styles.optionImageText}>
                      Imagem (opcional)
                    </ThemedText>
                  </View>
                )}
              </TouchableOpacity>
            </View>
          ))}

          <TouchableOpacity style={styles.addOptionButton} onPress={addOption}>
            <Ionicons name="add-circle" size={20} color={Colors.light.tint} />
            <ThemedText style={styles.addOptionText}>
              Adicionar Opção
            </ThemedText>
          </TouchableOpacity>

          {error ? (
            <ThemedText style={styles.errorText}>{error}</ThemedText>
          ) : null}

          <TouchableOpacity
            style={styles.submitButton}
            onPress={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <ThemedText style={styles.submitButtonText}>
                Criar Votação
              </ThemedText>
            )}
          </TouchableOpacity>
        </ThemedView>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    paddingTop: 50,
  },
  backButton: {
    padding: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginLeft: 16,
  },
  formContainer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: "500",
    marginBottom: 8,
    marginTop: 12,
  },
  input: {
    backgroundColor: "#1C1C1E",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    fontSize: 16,
  },
  textArea: {
    backgroundColor: "#1C1C1E",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    fontSize: 16,
    minHeight: 120,
    textAlignVertical: "top",
  },
  dateContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  dateField: {
    width: "47%",
  },
  dateButton: {
    backgroundColor: "#1C1C1E",
    borderRadius: 12,
    padding: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  dateText: {
    fontSize: 16,
  },
  switchContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  imagePickerButton: {
    backgroundColor: "#1C1C1E",
    borderRadius: 12,
    minHeight: 180,
    marginBottom: 16,
    overflow: "hidden",
  },
  previewImage: {
    width: "100%",
    height: 180,
  },
  imagePlaceholder: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    minHeight: 180,
  },
  imagePlaceholderText: {
    marginTop: 8,
    color: "#8E8E93",
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "700",
    marginTop: 24,
    marginBottom: 16,
  },
  optionContainer: {
    backgroundColor: "#2C2C2E",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  optionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  optionTitle: {
    fontSize: 18,
    fontWeight: "600",
  },
  removeOptionButton: {
    padding: 8,
  },
  optionImageButton: {
    backgroundColor: "#1C1C1E",
    borderRadius: 8,
    height: 120,
    marginTop: 8,
    overflow: "hidden",
  },
  optionPreviewImage: {
    width: "100%",
    height: 120,
  },
  optionImagePlaceholder: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  optionImageText: {
    marginTop: 8,
    color: "#8E8E93",
    fontSize: 14,
  },
  addOptionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    marginBottom: 24,
  },
  addOptionText: {
    color: Colors.light.tint,
    fontSize: 16,
    marginLeft: 8,
  },
  errorText: {
    color: "#FF453A",
    marginBottom: 16,
  },
  submitButton: {
    backgroundColor: Colors.light.tint,
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    marginTop: 16,
  },
  submitButtonText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "600",
  },
});
