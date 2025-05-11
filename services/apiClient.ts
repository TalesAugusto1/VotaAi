import * as ImagePicker from "expo-image-picker";
import * as SecureStore from "expo-secure-store";
import { User, Vote, VotingOption, VotingPool } from "../types";
import { cacheService } from "./cacheService";

// API base URL
const API_BASE_URL = "http://192.168.15.15:3000";

// Log the API base URL for debugging
console.log("API client initialized with base URL:", API_BASE_URL);

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
  // Check if response is OK first
  if (!response.ok) {
    // Try to get JSON error message
    try {
      const errorData = await response.json();
      throw new Error(errorData.message || `API error: ${response.status}`);
    } catch (jsonError) {
      // If JSON parsing fails, try to get text
      try {
        const textError = await response.text();
        throw new Error(textError || `API error: ${response.status}`);
      } catch (textError) {
        // If all else fails, use status code
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }
    }
  }

  // Check content type to make sure we're getting JSON
  const contentType = response.headers.get("content-type");
  if (!contentType || !contentType.includes("application/json")) {
    throw new Error("Server returned non-JSON response");
  }

  // Try to parse JSON
  try {
    const data = await response.json();
    return data;
  } catch (error) {
    console.error("JSON parse error:", error);
    throw new Error("Failed to parse server response as JSON");
  }
}

// Transform API pool to app pool
function transformPoolData(apiPool: APIVotingPool): VotingPool {
  return {
    ...apiPool,
    options: apiPool.options.map((option) => ({
      ...option,
      voteCount: option._count?.votes || 0,
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
    status?: "active" | "upcoming" | "closed",
    forceRefresh = false
  ): Promise<VotingPool[]> {
    // If we have a specific status, try to get from cache first
    if (status && !forceRefresh) {
      let cacheResult;
      if (status === "active") {
        cacheResult = cacheService.getActiveVotingPools();
      } else if (status === "upcoming") {
        cacheResult = cacheService.getUpcomingVotingPools();
      } else if (status === "closed") {
        cacheResult = cacheService.getClosedVotingPools();
      }

      if (cacheResult && cacheResult.isCached && cacheResult.data.length > 0) {
        console.log(`Using cached ${status} voting pools`);
        return cacheResult.data;
      }
    }

    // If not cached or force refresh, fetch from API
    let url = `${API_BASE_URL}/api/voting-pools`;

    if (status) {
      url += `?status=${status}`;
    }

    const response = await fetch(url);
    const data = await handleResponse<APIVotingPool[]>(response);

    // Transform API response to match app data structure
    const transformedData = data.map(transformPoolData);

    // Update cache based on status
    if (status === "active") {
      cacheService.setActiveVotingPools(transformedData);
    } else if (status === "upcoming") {
      cacheService.setUpcomingVotingPools(transformedData);
    } else if (status === "closed") {
      cacheService.setClosedVotingPools(transformedData);
    }

    return transformedData;
  },

  // Get active voting pools
  async getActiveVotingPools(forceRefresh = false): Promise<VotingPool[]> {
    return this.getVotingPools("active", forceRefresh);
  },

  // Get upcoming voting pools
  async getUpcomingVotingPools(forceRefresh = false): Promise<VotingPool[]> {
    return this.getVotingPools("upcoming", forceRefresh);
  },

  // Get closed voting pools
  async getClosedVotingPools(forceRefresh = false): Promise<VotingPool[]> {
    return this.getVotingPools("closed", forceRefresh);
  },

  // Get a voting pool by ID
  async getVotingPoolById(
    id: string,
    forceRefresh = false
  ): Promise<VotingPool | null> {
    try {
      // Check cache first unless force refresh is requested
      if (!forceRefresh) {
        const cacheResult = cacheService.getVotingPoolById(id);
        if (cacheResult.isCached && cacheResult.data) {
          console.log(`Using cached pool ${id}`);
          return cacheResult.data;
        }
      }

      // Fetch from API if not cached or force refresh
      const response = await fetch(`${API_BASE_URL}/api/voting-pools/${id}`);

      if (!response.ok) {
        if (response.status === 404) {
          return null;
        }
        throw new Error("Failed to get voting pool");
      }

      const pool = (await response.json()) as APIVotingPool;

      // Transform API response to match app data structure
      const transformedPool = transformPoolData(pool);

      // Update the cache
      cacheService.setVotingPoolById(id, transformedPool);

      return transformedPool;
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
    mainImage?: ImagePicker.ImagePickerAsset | null,
    optionImages: (ImagePicker.ImagePickerAsset | null)[] = []
  ): Promise<VotingPool> {
    const token = await getToken();

    if (!token) {
      throw new Error("Authentication required");
    }

    console.log("Creating voting pool with data:", {
      title: poolData.title,
      category: poolData.category,
      options: poolData.options.length,
      hasMainImage: !!mainImage,
      optionImagesCount: optionImages.filter(Boolean).length,
    });

    const formData = new FormData();

    // Add main pool data
    formData.append("title", poolData.title);
    formData.append("description", poolData.description);
    formData.append("category", poolData.category);
    formData.append("startDate", poolData.startDate.toISOString());
    formData.append("endDate", poolData.endDate.toISOString());

    // Important: Convert boolean to lowercase string "true" or "false"
    formData.append("anonymous", poolData.anonymous ? "true" : "false");

    // Add options as JSON string
    formData.append("options", JSON.stringify(poolData.options));

    // Add location data if available
    if (poolData.latitude && poolData.longitude) {
      formData.append("latitude", String(poolData.latitude));
      formData.append("longitude", String(poolData.longitude));
      if (poolData.address) {
        formData.append("address", poolData.address);
      }
    }

    // Add main image if available
    if (mainImage) {
      console.log("Preparing main image for upload:", {
        uri: mainImage.uri,
        type: mainImage.mimeType,
        fileName: mainImage.fileName,
      });

      const fileToUpload = {
        uri: mainImage.uri,
        type: mainImage.mimeType || "image/jpeg",
        name: mainImage.fileName || "pool-image.jpg",
      };

      // Important: Field name MUST be "image" to match backend expectation
      formData.append("image", fileToUpload as any);
    }

    // Add option images if available
    let hasOptionImages = false;
    optionImages.forEach((image, index) => {
      if (image) {
        hasOptionImages = true;
        console.log(`Preparing option ${index} image for upload:`, {
          uri: image.uri,
          type: image.mimeType,
          fileName: image.fileName,
        });

        const fileToUpload = {
          uri: image.uri,
          type: image.mimeType || "image/jpeg",
          name: image.fileName || `option${index}.jpg`,
        };

        // Important: Field name MUST be "option0", "option1", etc. to match backend expectation
        formData.append(`option${index}`, fileToUpload as any);
      }
    });

    // Add flag if we have option images
    if (hasOptionImages) {
      formData.append("hasOptionImages", "true");
    }

    // URL for the API endpoint
    const url = `${API_BASE_URL}/api/voting-pools`;

    // Get auth headers
    const headers = await getAuthHeaders();
    console.log("Auth token retrieved for pool creation");

    // Log FormData entries for debugging
    console.log("FormData entries:");
    try {
      for (const pair of (formData as any).entries()) {
        if (typeof pair[1] === "object" && pair[1].uri) {
          console.log(`${pair[0]}: [File Object]`, {
            uri: pair[1].uri.substring(0, 30) + "...",
            type: pair[1].type,
            name: pair[1].name,
          });
        } else {
          console.log(`${pair[0]}: ${pair[1]}`);
        }
      }
    } catch (e) {
      console.log("Could not log FormData entries:", e);
    }

    console.log("Making API request to:", url);

    const response = await fetch(url, {
      method: "POST",
      headers,
      body: formData,
    });

    console.log("Create voting pool response status:", response.status);

    if (!response.ok) {
      try {
        const errorData = await response.json();
        console.error("Error creating voting pool:", errorData);
        throw new Error(errorData.message || "Failed to create voting pool");
      } catch (jsonError) {
        // If error response isn't JSON, try to get raw text
        try {
          const errorText = await response.text();
          console.error("Error response (non-JSON):", errorText);
          throw new Error(
            "Failed to create voting pool: " +
              (errorText.length > 100
                ? errorText.substring(0, 100) + "..."
                : errorText)
          );
        } catch (textError) {
          // If we can't even get text
          console.error("Error response could not be read as text:", textError);
          throw new Error(
            `Failed to create voting pool. Server returned status ${response.status}`
          );
        }
      }
    }

    const data = await response.json();
    console.log("Voting pool created successfully");
    return transformPoolData(data.votingPool);
  },

  // Delete a voting pool
  async deleteVotingPool(id: string): Promise<boolean> {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/api/voting-pools/${id}`, {
        method: "DELETE",
        headers,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to delete voting pool");
      }

      return true;
    } catch (error) {
      console.error("Error deleting voting pool:", error);
      throw error;
    }
  },

  // Method to invalidate cache after actions that modify data
  invalidatePoolsCache(
    type: "active" | "upcoming" | "closed" | "all" = "all"
  ): void {
    cacheService.invalidateCache(type);
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

  // Get results for pools the user has voted in
  async getUserVotedPoolsResults(
    status: "active" | "closed" = "active",
    forceRefresh = false
  ): Promise<any[]> {
    // Check cache first unless force refresh is requested
    if (!forceRefresh) {
      const cacheResult = cacheService.getUserVotedPools(status);
      if (cacheResult.isCached && cacheResult.data.length > 0) {
        console.log(`Using cached user voted pools for status: ${status}`);

        // Return the cached pool IDs in the expected format
        return cacheResult.data.map((id) => ({ poolId: id }));
      }
    }

    // If not cached or forceRefresh, fetch from API
    const token = await getToken();
    if (!token) {
      return [];
    }

    try {
      const headers = await getAuthHeaders();
      // Fix the API endpoint path to match the backend route
      const response = await fetch(
        `${API_BASE_URL}/api/results/user-voted?status=${status}`,
        { headers }
      );

      // Check for non-200 responses
      if (!response.ok) {
        console.error(`API error: ${response.status} ${response.statusText}`);
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }

      // Check content type to make sure we're getting JSON
      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        // Try to read the response as text for debugging
        const textResponse = await response.text();
        console.error("Non-JSON response:", textResponse.substring(0, 200));
        throw new Error("Server returned non-JSON response");
      }

      // Safe JSON parsing
      let data;
      try {
        data = await response.json();
      } catch (jsonError) {
        console.error("JSON parse error:", jsonError);
        throw new Error("Failed to parse server response as JSON");
      }

      // Update cache with the pool IDs
      if (data && Array.isArray(data)) {
        const poolIds = data.map((item) => item.poolId);
        cacheService.setUserVotedPools(status, poolIds);
      }

      return data || [];
    } catch (error) {
      console.error(`Error fetching user voted pools for ${status}:`, error);

      // Fall back to cache even if it's expired
      const fallbackCache = cacheService.getUserVotedPools(status);
      if (fallbackCache.data.length > 0) {
        console.log(`Server error, using expired cache for ${status}`);
        return fallbackCache.data.map((id) => ({ poolId: id }));
      }

      // If all else fails, return empty array
      return [];
    }
  },

  // Invalidate user voted pools cache
  invalidateUserVotedPoolsCache(
    type: "active" | "closed" | "all" = "all"
  ): void {
    if (type === "all") {
      cacheService.invalidateCache("all");
    } else {
      cacheService.invalidateCache(type);
    }
  },
};
