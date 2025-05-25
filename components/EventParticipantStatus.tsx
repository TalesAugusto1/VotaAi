import React from "react";
import { View, Text, StyleSheet } from "react-native";

interface EventParticipantStatusProps {
  status: "confirmed" | "maybe" | "declined";
}

export function EventParticipantStatus({
  status,
}: EventParticipantStatusProps) {
  const getStatusColor = () => {
    switch (status) {
      case "confirmed":
        return "#4caf50";
      case "maybe":
        return "#ff9800";
      case "declined":
        return "#f44336";
      default:
        return "#757575";
    }
  };

  const getStatusText = () => {
    switch (status) {
      case "confirmed":
        return "Confirmado";
      case "maybe":
        return "Talvez";
      case "declined":
        return "Não vai";
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
