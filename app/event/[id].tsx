import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../services/api";
import { Event } from "../../types/event";
import { Loading } from "../../components/Loading";
import { ErrorMessage } from "../../components/ErrorMessage";
import { EventStatus } from "../../components/EventStatus";
import { EventParticipantStatus } from "../../components/EventParticipantStatus";

export default function EventDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { user } = useAuth();
  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userParticipation, setUserParticipation] = useState<{
    status: "confirmed" | "maybe" | "declined";
  } | null>(null);

  const fetchEvent = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get(`/api/events/${id}`);
      setEvent(response.data);
      // Find user's participation status
      const participation = response.data.participants.find(
        (p: any) => p.user.id === user?.id
      );
      setUserParticipation(participation || null);
    } catch (err) {
      setError("Failed to load event details");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvent();
  }, [id]);

  const handleUpdateParticipation = async (
    status: "confirmed" | "maybe" | "declined"
  ) => {
    try {
      if (userParticipation) {
        // Update existing participation
        await api.put(`/api/events/${id}/participants/${user?.id}`, { status });
      } else {
        // Create new participation
        await api.post(`/api/events/${id}/participants`, { status });
      }
      await fetchEvent(); // Refresh event data
    } catch (err) {
      Alert.alert("Error", "Failed to update participation status");
      console.error(err);
    }
  };

  const handleDeleteEvent = async () => {
    Alert.alert("Delete Event", "Are you sure you want to delete this event?", [
      {
        text: "Cancel",
        style: "cancel",
      },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await api.delete(`/api/events/${id}`);
            router.back();
          } catch (err) {
            Alert.alert("Error", "Failed to delete event");
            console.error(err);
          }
        },
      },
    ]);
  };

  if (loading) {
    return <Loading />;
  }

  if (error || !event) {
    return (
      <ErrorMessage message={error || "Event not found"} onRetry={fetchEvent} />
    );
  }

  const confirmedParticipants = event.participants.filter(
    (p) => p.status === "confirmed"
  ).length;

  return (
    <ScrollView style={styles.container}>
      {event.image && (
        <Image source={{ uri: event.image }} style={styles.image} />
      )}

      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>{event.title}</Text>
          <EventStatus status={event.status} />
        </View>

        <Text style={styles.date}>
          {format(new Date(event.eventDate), "EEEE, d 'de' MMMM 'às' HH:mm", {
            locale: ptBR,
          })}
        </Text>

        <Text style={styles.description}>{event.description}</Text>

        <View style={styles.infoSection}>
          <Text style={styles.sectionTitle}>Event Details</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Category:</Text>
            <Text style={styles.infoValue}>{event.category}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Participants:</Text>
            <Text style={styles.infoValue}>
              {confirmedParticipants}
              {event.maxPlayers ? `/${event.maxPlayers}` : ""}
            </Text>
          </View>
          {event.address && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Location:</Text>
              <Text style={styles.infoValue}>{event.address}</Text>
            </View>
          )}
        </View>

        <View style={styles.participantsSection}>
          <Text style={styles.sectionTitle}>Participants</Text>
          {event.participants.map((participant) => (
            <View key={participant.id} style={styles.participantRow}>
              <View style={styles.participantInfo}>
                {participant.user.avatarImage ? (
                  <Image
                    source={{ uri: participant.user.avatarImage }}
                    style={styles.avatar}
                  />
                ) : (
                  <View style={[styles.avatar, styles.avatarPlaceholder]}>
                    <Text style={styles.avatarText}>
                      {participant.user.name.charAt(0)}
                    </Text>
                  </View>
                )}
                <Text style={styles.participantName}>
                  {participant.user.name}
                </Text>
              </View>
              <EventParticipantStatus status={participant.status} />
            </View>
          ))}
        </View>

        {user && (
          <View style={styles.participationSection}>
            <Text style={styles.sectionTitle}>Your Participation</Text>
            <View style={styles.participationButtons}>
              <TouchableOpacity
                style={[
                  styles.participationButton,
                  userParticipation?.status === "confirmed" &&
                    styles.activeButton,
                ]}
                onPress={() => handleUpdateParticipation("confirmed")}
              >
                <Text
                  style={[
                    styles.participationButtonText,
                    userParticipation?.status === "confirmed" &&
                      styles.activeButtonText,
                  ]}
                >
                  I'm Going
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.participationButton,
                  userParticipation?.status === "maybe" && styles.activeButton,
                ]}
                onPress={() => handleUpdateParticipation("maybe")}
              >
                <Text
                  style={[
                    styles.participationButtonText,
                    userParticipation?.status === "maybe" &&
                      styles.activeButtonText,
                  ]}
                >
                  Maybe
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.participationButton,
                  userParticipation?.status === "declined" &&
                    styles.activeButton,
                ]}
                onPress={() => handleUpdateParticipation("declined")}
              >
                <Text
                  style={[
                    styles.participationButtonText,
                    userParticipation?.status === "declined" &&
                      styles.activeButtonText,
                  ]}
                >
                  Can't Go
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {user?.role === 2 && event.status === "scheduled" && (
          <View style={styles.adminSection}>
            <TouchableOpacity
              style={styles.editButton}
              onPress={() => router.push(`/edit-event/${id}`)}
            >
              <Text style={styles.editButtonText}>Edit Event</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.deleteButton}
              onPress={handleDeleteEvent}
            >
              <Text style={styles.deleteButtonText}>Delete Event</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  image: {
    width: "100%",
    height: 200,
  },
  content: {
    padding: 16,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#333",
    flex: 1,
    marginRight: 8,
  },
  date: {
    fontSize: 16,
    color: "#666",
    marginBottom: 16,
  },
  description: {
    fontSize: 16,
    color: "#333",
    marginBottom: 24,
    lineHeight: 24,
  },
  infoSection: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: "row",
    marginBottom: 8,
  },
  infoLabel: {
    fontSize: 16,
    color: "#666",
    width: 100,
  },
  infoValue: {
    fontSize: 16,
    color: "#333",
    flex: 1,
  },
  participantsSection: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  participantRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  participantInfo: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  avatarPlaceholder: {
    backgroundColor: "#e0e0e0",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    fontSize: 18,
    color: "#666",
  },
  participantName: {
    fontSize: 16,
    color: "#333",
  },
  participationSection: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  participationButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  participationButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#007AFF",
    marginHorizontal: 4,
    alignItems: "center",
  },
  activeButton: {
    backgroundColor: "#007AFF",
  },
  participationButtonText: {
    color: "#007AFF",
    fontWeight: "600",
  },
  activeButtonText: {
    color: "#fff",
  },
  adminSection: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 24,
  },
  editButton: {
    flex: 1,
    backgroundColor: "#007AFF",
    paddingVertical: 12,
    borderRadius: 8,
    marginRight: 8,
    alignItems: "center",
  },
  editButtonText: {
    color: "#fff",
    fontWeight: "600",
  },
  deleteButton: {
    flex: 1,
    backgroundColor: "#ff3b30",
    paddingVertical: 12,
    borderRadius: 8,
    marginLeft: 8,
    alignItems: "center",
  },
  deleteButtonText: {
    color: "#fff",
    fontWeight: "600",
  },
});
