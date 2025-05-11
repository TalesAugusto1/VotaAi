// User types
export interface User {
  id: string;
  name: string;
  cpf: string;
  email: string;
  avatarUrl?: string;
  role?: number; // 1: normal user, 2: admin user
}

// Voting Pool types
export interface VotingPool {
  id: string;
  title: string;
  description: string;
  category: string;
  imageData?: string; // Base64 encoded image data
  hasImage?: boolean; // Flag to indicate image exists but is not included in storage
  startDate: string; // ISO date string
  endDate: string; // ISO date string
  options: VotingOption[];
  location?: {
    latitude: number;
    longitude: number;
    address: string;
  };
  status: "active" | "upcoming" | "closed";
  anonymous: boolean;
}

export interface VotingOption {
  id: string;
  text: string;
  description?: string;
  imageData?: string; // Base64 encoded image data
  hasImage?: boolean; // Flag to indicate image exists but is not included in storage
  voteCount: number;
}

// Vote type
export interface Vote {
  id: string;
  userId: string;
  poolId: string;
  optionId: string;
  timestamp: string; // ISO date string
}

// For server-side anonymous voting tracking
export interface AnonymousVote {
  id: string;
  poolId: string;
  optionId: string;
  timestamp: string; // ISO date string
  // No user information stored
}
