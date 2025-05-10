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
  console.log("Storing token in SecureStore, length:", token.length);
  return await SecureStore.setItemAsync(TOKEN_STORAGE_KEY, token);
}

// Helper to remove the token
async function removeToken(): Promise<void> {
  console.log("Removing token from SecureStore");
  return await SecureStore.deleteItemAsync(TOKEN_STORAGE_KEY);
}

// Helper to create authorized headers with the token
async function getAuthHeaders(): Promise<HeadersInit> {
  const token = await getToken();

  // Debug token retrieval
  if (token) {
    console.log("Retrieved token from SecureStore. Length:", token.length);
    console.log("Token prefix:", token.substring(0, 10));
  } else {
    console.log("No token found in SecureStore");
  }

  const headers: Record<string, string> = {
    Accept: "application/json",
  };

  if (token) {
    // Important: Make sure to format exactly as backend expects
    headers["Authorization"] = `Bearer ${token}`;
    console.log("Added Authorization header with Bearer token");
  }

  return headers;
}

// Helper to check if authorization header is present
function hasAuthHeader(headers: HeadersInit): boolean {
  if (headers instanceof Headers) {
    return headers.has("Authorization");
  } else if (Array.isArray(headers)) {
    return headers.some((pair) => pair[0] === "Authorization");
  } else {
    return "Authorization" in headers;
  }
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

// TEMPORARY debug function to force set a token for testing
async function debugSetToken(token: string) {
  console.log("DEBUG: Manually setting token with length:", token.length);

  // First remove any existing token
  await SecureStore.deleteItemAsync(TOKEN_STORAGE_KEY);

  // Then set the new token
  await SecureStore.setItemAsync(TOKEN_STORAGE_KEY, token);

  // Verify it was set
  const check = await SecureStore.getItemAsync(TOKEN_STORAGE_KEY);
  console.log(
    "DEBUG: Token set verification:",
    !!check,
    check ? check.substring(0, 10) : "None"
  );

  return !!check;
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

      // Create a copy of the API base URL to ensure it's correct
      const loginUrl = `${API_BASE_URL}/api/auth/login`;
      console.log("Login URL:", loginUrl);

      const response = await fetch(loginUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ cpf: cleanedCpf, password }),
      });

      console.log("Login response status:", response.status);

      // Log response headers
      const headerMap: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        headerMap[key] = value;
      });
      console.log("Response headers:", JSON.stringify(headerMap));

      if (!response.ok) {
        const errorData = await response.json();
        console.error("Login error response:", errorData);
        throw new Error(errorData.message || "Login failed");
      }

      // Get the raw response text first to debug
      const responseText = await response.clone().text();
      console.log(
        "Raw login response:",
        responseText.substring(0, 100) + "..."
      );

      // Then parse as JSON
      const data = await response.json();
      console.log(
        "Login successful, token received. Token length:",
        data.token?.length || 0
      );

      // Log first few chars to ensure we have a proper JWT (starts with ey...)
      if (data.token) {
        console.log("Token prefix:", data.token.substring(0, 10));
      }

      if (!data.token) {
        console.error("No token received in login response!");
        throw new Error("No authentication token received");
      }

      // Try the new debug token storage method
      const success = await debugSetToken(data.token);
      console.log("DEBUG token set success:", success);

      // Also store using original method as backup
      await setToken(data.token);

      // Verify the token was stored
      const storedToken = await getToken();
      console.log("Token stored successfully:", !!storedToken);
      // Check if stored token matches original token
      if (storedToken) {
        console.log(
          "Stored token matches original:",
          storedToken.length === data.token.length &&
            storedToken.substring(0, 10) === data.token.substring(0, 10)
        );
      }

      return { user: data.user, token: data.token };
    } catch (error) {
      console.error("Login error in API client:", error);
      throw error;
    }
  },

  // Get the current user's data
  async getCurrentUser(): Promise<User | null> {
    try {
      const token = await getToken();

      if (!token) {
        console.log("getCurrentUser: No token available");
        return null;
      }

      console.log("getCurrentUser: Fetching user data with token");
      const headers = await getAuthHeaders();

      const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
        headers,
      });

      if (!response.ok) {
        console.error("getCurrentUser: Error response", response.status);
        if (response.status === 401) {
          // Token expired or invalid
          console.log("getCurrentUser: Token invalid, removing");
          await removeToken();
          return null;
        }
        throw new Error("Failed to get user");
      }

      const data = await response.json();
      console.log("getCurrentUser: Successfully retrieved user data");
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

    const headers = await getAuthHeaders();
    // Don't set Content-Type for multipart/form-data

    const response = await fetch(`${API_BASE_URL}/api/auth/avatar`, {
      method: "POST",
      headers,
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || "Failed to update avatar");
    }

    return;
  },

  // Log out the current user
  async logout(): Promise<void> {
    const token = await getToken();

    if (token) {
      try {
        const headers = await getAuthHeaders();
        await fetch(`${API_BASE_URL}/api/auth/logout`, {
          method: "POST",
          headers,
        });
      } catch (error) {
        console.error("Logout error:", error);
      } finally {
        // Remove the token regardless of API response
        await removeToken();
      }
    }
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

    // Get auth headers without Content-Type (will be set by FormData)
    const headers = await getAuthHeaders();
    console.log("Creating voting pool with auth token");

    const response = await fetch(`${API_BASE_URL}/api/voting-pools`, {
      method: "POST",
      headers,
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || "Failed to create voting pool");
    }

    const data = await response.json();
    console.log("Voting pool created successfully");
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

    // Get auth headers and add content type for JSON
    const headers = (await getAuthHeaders()) as Record<string, string>;
    headers["Content-Type"] = "application/json";

    console.log("Submitting vote with token for pool:", poolId);
    const response = await fetch(`${API_BASE_URL}/api/votes`, {
      method: "POST",
      headers,
      body: JSON.stringify({ poolId, optionId }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || "Failed to submit vote");
    }

    const data = await response.json();
    console.log("Vote submitted successfully");
    return data.vote;
  },

  // Get all votes for the current user
  async getUserVotes(): Promise<Vote[]> {
    const token = await getToken();

    if (!token) {
      console.log("No token available for getUserVotes");
      return [];
    }

    try {
      const headers = await getAuthHeaders();
      console.log("Fetching user votes with token");

      const response = await fetch(`${API_BASE_URL}/api/votes/user`, {
        headers,
      });

      if (!response.ok) {
        console.error("Error fetching user votes:", response.status);
        if (response.status === 401) {
          await removeToken();
          return [];
        }
        throw new Error("Failed to get user votes");
      }

      const data = await response.json();
      console.log(`Retrieved ${data.length} user votes`);
      return data;
    } catch (error) {
      console.error("getUserVotes error:", error);
      return [];
    }
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
      const headers = await getAuthHeaders();

      const response = await fetch(
        `${API_BASE_URL}/api/votes/user/pools/${poolId}`,
        {
          headers,
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
    try {
      console.log(
        "Fetching results with token:",
        (await getToken()) ? "Present" : "Missing"
      );

      const token = await getToken();
      if (!token) {
        console.log("No authentication token found for results");
        return []; // Return empty array instead of throwing error
      }

      let url = `${API_BASE_URL}/api/results/pools`;
      if (status) {
        url += `?status=${status}`;
      }

      console.log("Fetching results from URL:", url);

      // Create headers manually for more control
      const headers: Record<string, string> = {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      };

      console.log(
        "Auth header value:",
        headers.Authorization.substring(0, 15) + "..."
      );

      const response = await fetch(url, {
        headers,
      });

      if (!response.ok) {
        console.error("Results API error:", response.status);

        // Log the request headers that were sent
        console.log("Request headers sent:", JSON.stringify(headers));

        // Get specific error message from response
        const errorText = await response.text();
        console.error("Error response:", errorText);

        // If unauthorized, try one more fetch with a logged token
        if (response.status === 401) {
          console.log("Unauthorized. Token value length:", token.length);
          console.log("Token starts with:", token.substring(0, 15));

          // Try with a new token fetch
          console.log("Getting fresh token");
          const freshToken = await getToken();
          if (freshToken && freshToken !== token) {
            console.log("Got different token, retrying");
            headers.Authorization = `Bearer ${freshToken}`;

            // Try once more
            const retryResponse = await fetch(url, { headers });
            if (retryResponse.ok) {
              const retryData = await retryResponse.json();
              console.log(
                `Retry succeeded! Received ${retryData.length} results`
              );
              return retryData;
            } else {
              console.error("Retry also failed:", await retryResponse.text());
            }
          }
        }

        return [];
      }

      const data = await response.json();
      console.log(`Received ${data.length} results from API`);
      return data;
    } catch (error) {
      console.error("Results API exception:", error);
      return [];
    }
  },
};
