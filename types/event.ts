export interface Event {
  id: string;
  title: string;
  description: string;
  category: string;
  eventDate: string;
  maxPlayers?: number;
  minPlayers?: number;
  status: "scheduled" | "completed" | "cancelled";
  createdAt: string;
  updatedAt: string;
  latitude?: number;
  longitude?: number;
  address?: string;
  image?: string;
  createdBy: {
    id: string;
    name: string;
    avatarImage?: string;
  };
  participants: Array<{
    id: string;
    status: "confirmed" | "maybe" | "declined";
    user: {
      id: string;
      name: string;
      avatarImage?: string;
    };
  }>;
  datePool?: {
    id: string;
    title: string;
    options: Array<{
      id: string;
      date: string;
      description?: string;
    }>;
  };
}
