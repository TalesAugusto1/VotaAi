import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, Image } from "react-native";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Event } from "../types/event";
import { EventStatus } from "./EventStatus";
import { Ionicons } from "@expo/vector-icons";

interface EventCardProps {
  event: Event;
  onPress: () => void;
}

export function EventCard({ event, onPress }: EventCardProps) {
  const confirmedParticipants = event.participants.filter(
    (p) => p.status === "confirmed"
  ).length;

  return (
    <TouchableOpacity style={styles.container} onPress={onPress}>
      {event.image ? (
        <Image source={{ uri: event.image }} style={styles.image} />
      ) : (
        <View style={styles.imagePlaceholder}>
          <Ionicons name="calendar" size={32} color="#adb5bd" />
        </View>
      )}
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title} numberOfLines={1}>
            {event.title}
          </Text>
          <EventStatus status={event.status} />
        </View>

        <View style={styles.dateContainer}>
          <Ionicons name="time-outline" size={16} color="#6c757d" />
          <Text style={styles.date}>
            {format(new Date(event.eventDate), "EEEE, d 'de' MMMM 'às' HH:mm", {
              locale: ptBR,
            })}
          </Text>
        </View>

        <Text style={styles.description} numberOfLines={2}>
          {event.description}
        </Text>

        <View style={styles.footer}>
          <View style={styles.participants}>
            <Ionicons name="people-outline" size={16} color="#6c757d" />
            <Text style={styles.participantsText}>
              {confirmedParticipants}
              {event.maxPlayers ? `/${event.maxPlayers}` : ""} participants
            </Text>
          </View>

          <View style={styles.category}>
            <Ionicons
              name="game-controller-outline"
              size={16}
              color="#6c757d"
            />
            <Text style={styles.categoryText}>{event.category}</Text>
          </View>
        </View>

        {event.address && (
          <View style={styles.location}>
            <Ionicons name="location-outline" size={16} color="#6c757d" />
            <Text style={styles.locationText} numberOfLines={1}>
              {event.address}
            </Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#fff",
    borderRadius: 12,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  image: {
    width: "100%",
    height: 160,
    backgroundColor: "#f8f9fa",
  },
  imagePlaceholder: {
    width: "100%",
    height: 160,
    backgroundColor: "#f8f9fa",
    justifyContent: "center",
    alignItems: "center",
  },
  content: {
    padding: 16,
    gap: 12,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
    color: "#212529",
    flex: 1,
  },
  dateContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  date: {
    fontSize: 14,
    color: "#6c757d",
  },
  description: {
    fontSize: 14,
    color: "#495057",
    lineHeight: 20,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  participants: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  participantsText: {
    fontSize: 14,
    color: "#6c757d",
  },
  category: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  categoryText: {
    fontSize: 14,
    color: "#6c757d",
  },
  location: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  locationText: {
    fontSize: 14,
    color: "#6c757d",
    flex: 1,
  },
});
