import { User, Vote, VotingPool } from "../types";
import { generateId } from "../utils/helpers";
import { users, votes, votingPools } from "./mockData";
import axios, {
  InternalAxiosRequestConfig,
  AxiosResponse,
  AxiosError,
} from "axios";
import { API_URL } from "../config";
import * as SecureStore from "expo-secure-store";
import { API_BASE_URL, TOKEN_STORAGE_KEY } from "./apiConfig";

// Simulate API delay for realistic experience
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Authentication service
 */
export const authService = {
  // Login with CPF
  async login(cpf: string, password: string): Promise<User | null> {
    await delay(800); // Simulate network delay

    const user = users.find((user) => user.cpf === cpf);

    // In a real app, password would be hashed and properly verified
    if (user) {
      // For demo purposes, any password works
      return user;
    }

    return null;
  },

  // Register new user
  async register(userData: Omit<User, "id">): Promise<User> {
    await delay(1000); // Simulate network delay

    const newUser: User = {
      id: generateId(),
      ...userData,
    };

    // In a real app, this would be saved to a database
    users.push(newUser);

    return newUser;
  },
};

/**
 * Voting Pools service
 */
export const votingPoolsService = {
  // Get all voting pools
  async getVotingPools(): Promise<VotingPool[]> {
    await delay(600);
    return [...votingPools];
  },

  // Get voting pool by ID
  async getVotingPoolById(id: string): Promise<VotingPool | null> {
    await delay(400);
    const pool = votingPools.find((pool) => pool.id === id);
    return pool || null;
  },

  // Get active voting pools
  async getActiveVotingPools(): Promise<VotingPool[]> {
    await delay(600);
    return votingPools.filter((pool) => pool.status === "active");
  },

  // Get upcoming voting pools
  async getUpcomingVotingPools(): Promise<VotingPool[]> {
    await delay(600);
    return votingPools.filter((pool) => pool.status === "upcoming");
  },

  // Get closed voting pools
  async getClosedVotingPools(): Promise<VotingPool[]> {
    await delay(600);
    return votingPools.filter((pool) => pool.status === "closed");
  },
};

/**
 * Votes service
 */
export const votesService = {
  // Submit a vote
  async submitVote(
    userId: string,
    poolId: string,
    optionId: string
  ): Promise<Vote> {
    await delay(800);

    // Find the pool and option to update the count
    const pool = votingPools.find((p) => p.id === poolId);
    if (!pool) {
      throw new Error("Voting pool not found");
    }

    const option = pool.options.find((o) => o.id === optionId);
    if (!option) {
      throw new Error("Option not found");
    }

    // Check if user already voted in this pool
    const existingVote = votes.find(
      (v) => v.userId === userId && v.poolId === poolId
    );
    if (existingVote) {
      throw new Error("User already voted in this pool");
    }

    // Create new vote
    const newVote: Vote = {
      id: generateId(),
      userId,
      poolId,
      optionId,
      timestamp: new Date().toISOString(),
    };

    // Update option vote count
    option.voteCount += 1;

    // Save vote
    votes.push(newVote);

    return newVote;
  },

  // Get user votes
  async getUserVotes(userId: string): Promise<Vote[]> {
    await delay(500);
    return votes.filter((vote) => vote.userId === userId);
  },

  // Check if user has voted in a pool
  async hasUserVoted(userId: string, poolId: string): Promise<boolean> {
    await delay(300);
    return votes.some(
      (vote) => vote.userId === userId && vote.poolId === poolId
    );
  },
};

// Create axios instance
export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Add a request interceptor to include the auth token
api.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    const token = await SecureStore.getItemAsync(TOKEN_STORAGE_KEY);
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error: AxiosError) => {
    return Promise.reject(error);
  }
);

// Add a response interceptor to handle errors
api.interceptors.response.use(
  (response: AxiosResponse) => response,
  async (error: AxiosError) => {
    if (error.response?.status === 401) {
      // Handle unauthorized access
      await SecureStore.deleteItemAsync(TOKEN_STORAGE_KEY);
      // In React Native, we can't use window.location
      // Instead, we'll let the app handle the navigation
    }
    return Promise.reject(error);
  }
);
