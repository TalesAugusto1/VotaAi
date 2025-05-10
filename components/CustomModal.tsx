import React from "react";
import {
  Modal,
  StyleSheet,
  TouchableOpacity,
  View,
  useColorScheme,
  TouchableWithoutFeedback,
} from "react-native";
import { MaterialIcons, Ionicons } from "@expo/vector-icons";
import { ThemedText } from "./ThemedText";
import { Colors } from "../constants/Colors";

interface CustomModalProps {
  visible: boolean;
  title: string;
  message: string;
  type?: "success" | "error" | "info" | "warning";
  onClose: () => void;
  actions?: {
    text: string;
    onPress: () => void;
    style?: "default" | "cancel" | "destructive";
  }[];
}

export function CustomModal({
  visible,
  title,
  message,
  type = "info",
  onClose,
  actions = [{ text: "OK", onPress: () => onClose(), style: "default" }],
}: CustomModalProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";

  const getTypeInfo = () => {
    switch (type) {
      case "success":
        return {
          icon: "checkmark-circle",
          color: "#4CAF50",
        };
      case "error":
        return {
          icon: "close-circle",
          color: "#F44336",
        };
      case "warning":
        return {
          icon: "warning",
          color: "#FFC107",
        };
      case "info":
      default:
        return {
          icon: "information-circle",
          color: Colors.light.tint,
        };
    }
  };

  const typeInfo = getTypeInfo();

  return (
    <Modal
      animationType="fade"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.centeredView}>
          <TouchableWithoutFeedback>
            <View
              style={[
                styles.modalView,
                {
                  backgroundColor: isDark ? "#1C1C1E" : "#FFFFFF",
                  shadowColor: isDark ? "#000" : "#000",
                },
              ]}
            >
              <View style={styles.modalIcon}>
                <View
                  style={[
                    styles.iconBackground,
                    { backgroundColor: `${typeInfo.color}20` },
                  ]}
                >
                  <Ionicons
                    name={typeInfo.icon as any}
                    size={40}
                    color={typeInfo.color}
                  />
                </View>
              </View>

              <ThemedText style={styles.modalTitle}>{title}</ThemedText>
              <ThemedText style={styles.modalText}>{message}</ThemedText>

              <View
                style={[
                  styles.actionsContainer,
                  actions.length > 1 && styles.multipleActions,
                ]}
              >
                {actions.map((action, index) => {
                  const buttonStyles = [styles.button];
                  const textStyles = [styles.buttonText];

                  if (action.style === "cancel") {
                    buttonStyles.push(styles.cancelButton);
                    textStyles.push({
                      color: isDark ? "#FFFFFF" : "#000000",
                      opacity: 0.8,
                    });
                  } else if (action.style === "destructive") {
                    buttonStyles.push(styles.destructiveButton);
                    textStyles.push({ color: "#F44336" });
                  } else {
                    buttonStyles.push(styles.defaultButton);
                    textStyles.push({ color: Colors.light.tint });
                  }

                  return (
                    <TouchableOpacity
                      key={index}
                      style={[
                        ...buttonStyles,
                        actions.length > 1 && styles.flexButton,
                      ]}
                      onPress={action.onPress}
                    >
                      <ThemedText style={textStyles}>{action.text}</ThemedText>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                <MaterialIcons
                  name="close"
                  size={24}
                  color={isDark ? "#AEAEB2" : "#8E8E93"}
                />
              </TouchableOpacity>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  centeredView: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  modalView: {
    width: "85%",
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  modalIcon: {
    marginBottom: 16,
  },
  iconBackground: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  modalTitle: {
    marginBottom: 12,
    textAlign: "center",
    fontSize: 20,
    fontWeight: "bold",
  },
  modalText: {
    marginBottom: 20,
    textAlign: "center",
    fontSize: 16,
    lineHeight: 24,
  },
  actionsContainer: {
    width: "100%",
    marginTop: 8,
  },
  multipleActions: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  button: {
    borderRadius: 12,
    padding: 14,
    marginVertical: 5,
    alignItems: "center",
    justifyContent: "center",
  },
  flexButton: {
    flex: 1,
    marginHorizontal: 5,
  },
  defaultButton: {
    backgroundColor: "transparent",
  },
  cancelButton: {
    backgroundColor: "transparent",
  },
  destructiveButton: {
    backgroundColor: "transparent",
  },
  buttonText: {
    fontWeight: "600",
    fontSize: 16,
  },
  closeButton: {
    position: "absolute",
    top: 12,
    right: 12,
    width: 30,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 15,
  },
});
