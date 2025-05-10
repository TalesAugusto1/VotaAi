import * as SecureStore from "expo-secure-store";
import { User, Vote, VotingOption, VotingPool } from "../types";

// API base URL
const API_BASE_URL = "http://192.168.15.15:3000";

// Extended types for API responses
interface APIVotingPool extends Omit<VotingPool, "options"> {
  hasImage?: boolean;
  options: APIVotingOption[];
}

interface APIVotingOption extends Omit<VotingOption, "voteCount"> {
  hasImage?: boolean;
  _count?: {
    votes: number;
  };
}

// Token storage key
const TOKEN_STORAGE_KEY = "VotaAi_token";

// Helper to get the token
async function getToken(): Promise<string | null> {
  return await SecureStore.getItemAsync(TOKEN_STORAGE_KEY);
}

// Helper to set the token
async function setToken(token: string): Promise<void> {
  return await SecureStore.setItemAsync(TOKEN_STORAGE_KEY, token);
}

// Helper to remove the token
async function removeToken(): Promise<void> {
  return await SecureStore.deleteItemAsync(TOKEN_STORAGE_KEY);
}

// Helper to check if response is OK
async function handleResponse<T>(response: Response): Promise<T> {
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "An error occurred");
  }

  return data;
}

// Transform API pool to app pool
function transformPoolData(apiPool: APIVotingPool): VotingPool {
  return {
    ...apiPool,
    imageUrl: apiPool.hasImage
      ? `${API_BASE_URL}/api/voting-pools/${apiPool.id}/image`
      : undefined,
    options: apiPool.options.map((option) => ({
      ...option,
      voteCount: option._count?.votes || 0,
      imageUrl: option.hasImage
        ? `${API_BASE_URL}/api/voting-pools/option/${option.id}/image`
        : undefined,
    })),
  };
}

// Auth API functions
export const authApi = {
  // Register a new user
  async register(
    userData: {
      name: string;
      cpf: string;
      email: string;
      password: string;
    },
    avatarFile?: any
  ): Promise<{ user: User; token: string }> {
    try {
      // For debugging - log what we're sending
      console.log("Registering with data:", {
        name: userData.name,
        cpf: userData.cpf.replace(/\D/g, ""), // Log cleaned CPF
        email: userData.email,
        passwordLength: userData.password?.length,
        hasAvatar: !!avatarFile,
      });

      // Always use FormData for registration - the endpoint expects multipart/form-data
      const formData = new FormData();

      // Ensure CPF is numbers only - no dots or dashes
      const cleanedCpf = userData.cpf.replace(/\D/g, "");

      // Add required fields to FormData - exactly as server expects them
      formData.append("name", userData.name);
      formData.append("cpf", cleanedCpf);
      formData.append("email", userData.email);
      formData.append("password", userData.password);

      // Add avatar if provided
      if (avatarFile) {
        // Format the file object for React Native
        const fileToUpload = {
          uri: avatarFile.uri,
          type: avatarFile.type || "image/jpeg",
          name: avatarFile.fileName || "avatar.jpg",
        };

        formData.append("avatar", fileToUpload as any);
      }

      console.log("FormData created successfully");

      // Make the request with FormData
      const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
        method: "POST",
        body: formData,
        // No Content-Type header for FormData, let the browser/RN set it
      });

      // Get response data
      const data = await response.json();
      console.log("Registration response status:", response.status);

      // Handle error responses
      if (!response.ok) {
        console.error("Registration error from server:", data.message);
        throw new Error(data.message || "Registration failed");
      }

      // Store the token
      await setToken(data.token);

      return { user: data.user, token: data.token };
    } catch (error) {
      console.error("Registration error:", error);
      throw error;
    }
  },

  // Login with CPF and password
  async login(
    cpf: string,
    password: string
  ): Promise<{ user: User; token: string }> {
    try {
      console.log("Logging in with CPF:", cpf, "Length:", cpf.length);

      // Ensure CPF is clean (digits only)
      const cleanedCpf = cpf.replace(/\D/g, "");

      const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ cpf: cleanedCpf, password }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error("Login error response:", errorData);
        throw new Error(errorData.message || "Login failed");
      }

      const data = await response.json();

      // Store the token
      await setToken(data.token);

      console.log("Login successful");
      return { user: data.user, token: data.token };
    } catch (error) {
      console.error("Login error in API client:", error);
      throw error;
    }
  },

  // Log out the current user
  async logout(): Promise<void> {
    const token = await getToken();

    if (token) {
      try {
        await fetch(`${API_BASE_URL}/api/auth/logout`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
      } catch (error) {
        console.error("Logout error:", error);
      } finally {
        // Remove the token regardless of API response
        await removeToken();
      }
    }
  },

  // Get the current user's data
  async getCurrentUser(): Promise<User | null> {
    const token = await getToken();

    if (!token) {
      return null;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          // Token expired or invalid
          await removeToken();
          return null;
        }
        throw new Error("Failed to get user");
      }

      const data = await response.json();
      return data.user;
    } catch (error) {
      console.error("Get current user error:", error);
      return null;
    }
  },

  // Get avatar URL for a user
  getAvatarUrl(userId: string): string {
    return `${API_BASE_URL}/api/auth/avatar/${userId}`;
  },

  // Update avatar for current user
  async updateAvatar(avatarFile: any): Promise<void> {
    const token = await getToken();

    if (!token) {
      throw new Error("Authentication required");
    }

    const formData = new FormData();
    formData.append("avatar", avatarFile);

    const response = await fetch(`${API_BASE_URL}/api/auth/avatar`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });

    await handleResponse<{ message: string }>(response);
  },
};

// Voting Pools API functions
export const votingPoolsApi = {
  // Get all voting pools
  async getVotingPools(
    status?: "active" | "upcoming" | "closed"
  ): Promise<VotingPool[]> {
    let url = `${API_BASE_URL}/api/voting-pools`;

    if (status) {
      url += `?status=${status}`;
    }

    const response = await fetch(url);

    const data = await handleResponse<APIVotingPool[]>(response);

    // Transform API response to match app data structure
    return data.map(transformPoolData);
  },

  // Get active voting pools
  async getActiveVotingPools(): Promise<VotingPool[]> {
    return this.getVotingPools("active");
  },

  // Get upcoming voting pools
  async getUpcomingVotingPools(): Promise<VotingPool[]> {
    return this.getVotingPools("upcoming");
  },

  // Get closed voting pools
  async getClosedVotingPools(): Promise<VotingPool[]> {
    return this.getVotingPools("closed");
  },

  // Get a voting pool by ID
  async getVotingPoolById(id: string): Promise<VotingPool | null> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/voting-pools/${id}`);

      if (!response.ok) {
        if (response.status === 404) {
          return null;
        }
        throw new Error("Failed to get voting pool");
      }

      const pool = (await response.json()) as APIVotingPool;

      // Transform API response to match app data structure
      return transformPoolData(pool);
    } catch (error) {
      console.error("Get voting pool error:", error);
      return null;
    }
  },

  // Create a new voting pool (for admin functionality)
  async createVotingPool(
    poolData: {
      title: string;
      description: string;
      category: string;
      startDate: Date;
      endDate: Date;
      anonymous: boolean;
      latitude?: number;
      longitude?: number;
      address?: string;
      options: { text: string; description?: string }[];
    },
    mainImage?: any,
    optionImages: any[] = []
  ): Promise<VotingPool> {
    const token = await getToken();

    if (!token) {
      throw new Error("Authentication required");
    }

    const formData = new FormData();

    // Add main pool data
    formData.append("title", poolData.title);
    formData.append("description", poolData.description);
    formData.append("category", poolData.category);
    formData.append("startDate", poolData.startDate.toISOString());
    formData.append("endDate", poolData.endDate.toISOString());
    formData.append("anonymous", String(poolData.anonymous));

    // Add location data if available
    if (poolData.latitude && poolData.longitude) {
      formData.append("latitude", String(poolData.latitude));
      formData.append("longitude", String(poolData.longitude));
      formData.append("address", poolData.address || "");
    }

    // Add main image if available
    if (mainImage) {
      formData.append("image", mainImage);
    }

    // Add options
    formData.append("options", JSON.stringify(poolData.options));

    // Add option images if available
    if (optionImages.length > 0) {
      formData.append("hasOptionImages", "true");
      optionImages.forEach((image, index) => {
        if (image) {
          formData.append(`option${index}`, image);
        }
      });
    }

    const response = await fetch(`${API_BASE_URL}/api/voting-pools`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });

    const data = await handleResponse<{
      message: string;
      votingPool: APIVotingPool;
    }>(response);

    return transformPoolData(data.votingPool);
  },
};

// Votes API functions
export const votesApi = {
  // Submit a vote
  async submitVote(poolId: string, optionId: string): Promise<Vote> {
    const token = await getToken();

    if (!token) {
      throw new Error("Authentication required");
    }

    const response = await fetch(`${API_BASE_URL}/api/votes`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ poolId, optionId }),
    });

    const data = await handleResponse<{
      message: string;
      vote: Vote;
    }>(response);

    return data.vote;
  },

  // Get all votes for the current user
  async getUserVotes(): Promise<Vote[]> {
    const token = await getToken();

    if (!token) {
      return [];
    }

    const response = await fetch(`${API_BASE_URL}/api/votes/user`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        await removeToken();
        return [];
      }
      throw new Error("Failed to get user votes");
    }

    return await response.json();
  },

  // Check if the current user has voted in a pool
  async hasUserVoted(
    poolId: string
  ): Promise<{ hasVoted: boolean; optionId: string | null }> {
    const token = await getToken();

    if (!token) {
      return { hasVoted: false, optionId: null };
    }

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/votes/user/pools/${poolId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        if (response.status === 401) {
          await removeToken();
          return { hasVoted: false, optionId: null };
        }
        return { hasVoted: false, optionId: null };
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error("Has user voted error:", error);
      return { hasVoted: false, optionId: null };
    }
  },
};

// Results API functions
export const resultsApi = {
  // Get results for a specific pool
  async getPoolResults(poolId: string): Promise<{
    poolId: string;
    title: string;
    totalVotes: number;
    results: {
      id: string;
      text: string;
      description?: string;
      voteCount: number;
      percentage: number;
    }[];
  }> {
    const response = await fetch(`${API_BASE_URL}/api/results/pools/${poolId}`);

    return await handleResponse(response);
  },

  // Get results for all pools the user has voted in
  async getUserVotedPoolsResults(status?: "active" | "closed"): Promise<
    {
      poolId: string;
      title: string;
      status: "active" | "closed";
      totalVotes: number;
      results: {
        id: string;
        text: string;
        voteCount: number;
        percentage: number;
      }[];
    }[]
  > {
    const token = await getToken();

    if (!token) {
      throw new Error("Authentication required");
    }

    let url = `${API_BASE_URL}/api/results/pools`;
    if (status) {
      url += `?status=${status}`;
    }

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    return await handleResponse(response);
  },
};
