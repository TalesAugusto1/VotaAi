import React from "react";
import { View, Text, StyleSheet } from "react-native";

interface EventStatusProps {
  status: "scheduled" | "completed" | "cancelled";
}

export function EventStatus({ status }: EventStatusProps) {
  const getStatusColor = () => {
    switch (status) {
      case "scheduled":
        return "#4caf50";
      case "completed":
        return "#2196f3";
      case "cancelled":
        return "#f44336";
      default:
        return "#757575";
    }
  };

  const getStatusText = () => {
    switch (status) {
      case "scheduled":
        return "Agendado";
      case "completed":
        return "Concluído";
      case "cancelled":
        return "Cancelado";
      default:
        return status;
    }
  };

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: getStatusColor() + "20", // Add 20% opacity
          borderColor: getStatusColor(),
        },
      ]}
    >
      <Text
        style={[
          styles.text,
          {
            color: getStatusColor(),
          },
        ]}
      >
        {getStatusText()}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    borderWidth: 1,
  },
  text: {
    fontSize: 12,
    fontWeight: "600",
  },
});
