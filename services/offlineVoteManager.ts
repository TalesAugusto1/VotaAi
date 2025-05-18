import NetInfo from "@react-native-community/netinfo";
import * as SecureStore from "expo-secure-store";
import { OfflineVote, offlineStorage } from "./offlineStorage";
import { nanoid } from "./utils";

// API base URL and token storage key definition
const API_BASE_URL = "http://192.168.1.110:3000";
const TOKEN_STORAGE_KEY = "VotaAi_token";

// Maximum number of retry attempts for a vote
const MAX_RETRY_ATTEMPTS = 3;

// Get token from secure storage
const getToken = async (): Promise<string | null> => {
  try {
    return await SecureStore.getItemAsync(TOKEN_STORAGE_KEY);
  } catch (error) {
    console.error("Error getting token:", error);
    return null;
  }
};

// Get auth headers for API requests
const getAuthHeaders = async (): Promise<HeadersInit> => {
  const token = await getToken();

  if (!token) {
    throw new Error("Authentication required");
  }

  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
};

// Add fetchWithRetry function similar to apiClient
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries = 3
): Promise<Response> {
  let retries = 0;
  let lastError: Error = new Error("Maximum retries exceeded");

  while (retries < maxRetries) {
    try {
      console.log(
        `[OfflineVoteManager] Attempt ${
          retries + 1
        }/${maxRetries} to fetch ${url}`
      );
      const response = await fetch(url, options);

      // For 429 (too many requests), wait and retry
      if (response.status === 429) {
        const backoffTime = Math.pow(2, retries) * 1000 + Math.random() * 1000;
        console.log(
          `[OfflineVoteManager] Rate limited. Backing off for ${backoffTime}ms before retry`
        );
        await new Promise((resolve) => setTimeout(resolve, backoffTime));
        retries++;
        continue;
      }

      return response;
    } catch (error) {
      console.error(
        `[OfflineVoteManager] Fetch attempt ${retries + 1} failed:`,
        error
      );
      lastError = error as Error;

      const backoffTime = Math.pow(2, retries) * 1000 + Math.random() * 1000;
      console.log(
        `[OfflineVoteManager] Network error. Backing off for ${backoffTime}ms before retry`
      );
      await new Promise((resolve) => setTimeout(resolve, backoffTime));
      retries++;
    }
  }

  throw lastError;
}

// Submit vote directly to the API
const submitVoteToApi = async (
  poolId: string,
  optionId: string
): Promise<any> => {
  // Get token and handle missing token error proactively
  const token = await getToken();
  if (!token) {
    console.error("[OfflineVoteManager] Authentication token not found");
    throw new Error("Authentication required");
  }

  // Log the token length and first characters for debugging
  console.log(
    `[OfflineVoteManager] Using token (length: ${
      token.length
    }): ${token.substring(0, 10)}...`
  );

  // Get auth headers and add content type for JSON
  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };

  console.log("[OfflineVoteManager] Submitting vote for pool:", poolId);

  try {
    // Use the retry mechanism
    const response = await fetchWithRetry(
      `${API_BASE_URL}/api/votes`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({ poolId, optionId }),
      },
      3
    );

    if (!response.ok) {
      // Handle different error statuses
      if (response.status === 401 || response.status === 403) {
        console.error(
          "[OfflineVoteManager] Authentication failed:",
          response.status
        );
        throw new Error("Authentication required");
      }

      // Try to parse the error message from response
      try {
        const errorData = await response.json();
        throw new Error(
          errorData.message || `Failed to submit vote: ${response.status}`
        );
      } catch (jsonError) {
        throw new Error(`API error: ${response.status}`);
      }
    }

    // Parse the response
    try {
      const data = await response.json();
      console.log("[OfflineVoteManager] Vote submitted successfully");
      return data.vote;
    } catch (parseError) {
      console.error("[OfflineVoteManager] Error parsing response:", parseError);
      throw new Error("Failed to parse server response");
    }
  } catch (error) {
    console.error("[OfflineVoteManager] Vote submission failed:", error);
    throw error;
  }
};

export const offlineVoteManager = {
  /**
   * Submit a vote - works both online and offline
   */
  async submitVote(
    poolId: string,
    optionId: string
  ): Promise<{ success: boolean; offline: boolean; voteId?: string }> {
    // Check network status
    const networkState = await NetInfo.fetch();
    const isOnline = networkState.isConnected === true;

    if (isOnline) {
      try {
        // If online, try to submit directly to the API
        const voteResponse = await submitVoteToApi(poolId, optionId);
        console.log("[OfflineVoteManager] Vote submitted online successfully");

        // Extract the vote ID from the response
        const voteId = voteResponse?.id || nanoid(); // Use a fallback ID if no ID in response

        return {
          success: true,
          offline: false,
          voteId,
        };
      } catch (error) {
        console.error(
          "[OfflineVoteManager] Failed to submit vote online, falling back to offline:",
          error
        );
        // If the online submission fails, save as offline vote
        return this.saveOfflineVote(poolId, optionId);
      }
    } else {
      // If offline, save vote to queue
      console.log(
        "[OfflineVoteManager] Device is offline, saving vote for later submission"
      );
      return this.saveOfflineVote(poolId, optionId);
    }
  },

  /**
   * Save vote to offline storage queue
   */
  async saveOfflineVote(
    poolId: string,
    optionId: string
  ): Promise<{ success: boolean; offline: boolean; voteId: string }> {
    const voteId = nanoid();

    const offlineVote: OfflineVote = {
      id: voteId,
      poolId,
      optionId,
      timestamp: Date.now(),
      status: "pending",
      retryCount: 0,
    };

    await offlineStorage.saveOfflineVote(offlineVote);
    console.log("[OfflineVoteManager] Vote saved to offline queue:", voteId);

    return {
      success: true,
      offline: true,
      voteId,
    };
  },

  /**
   * Get all pending offline votes
   */
  async getPendingVotes(): Promise<OfflineVote[]> {
    const allVotes = await offlineStorage.getOfflineVotes();
    const pendingVotes = allVotes.filter((vote) => vote.status === "pending");
    return pendingVotes;
  },

  /**
   * Get all offline votes including pending, synced, and error states
   */
  async getAllOfflineVotes(): Promise<OfflineVote[]> {
    return await offlineStorage.getOfflineVotes();
  },

  /**
   * Sync a specific vote
   */
  async syncVote(voteId: string): Promise<boolean> {
    const allVotes = await offlineStorage.getOfflineVotes();
    const vote = allVotes.find((v) => v.id === voteId);

    if (!vote) {
      console.log(
        `[OfflineVoteManager] Vote ${voteId} not found in offline storage`
      );
      return false;
    }

    if (vote.status === "synced") {
      console.log(`[OfflineVoteManager] Vote ${voteId} already synced`);
      return true;
    }

    // Check network status
    const networkState = await NetInfo.fetch();
    const isOnline = networkState.isConnected === true;

    if (!isOnline) {
      console.log(
        `[OfflineVoteManager] Cannot sync vote ${voteId} - device is offline`
      );
      return false;
    }

    // Verify token exists before attempting sync
    const token = await getToken();
    if (!token) {
      console.error(
        `[OfflineVoteManager] Cannot sync vote ${voteId} - no authentication token`
      );

      // Update the vote with the auth error
      await offlineStorage.updateOfflineVote(voteId, {
        error: "Authentication required",
        retryCount: vote.retryCount + 1,
      });

      return false;
    }

    try {
      // Submit to server directly
      await submitVoteToApi(vote.poolId, vote.optionId);

      // Update vote status to synced
      await offlineStorage.updateOfflineVote(voteId, {
        status: "synced",
        error: undefined, // Clear any previous errors
      });

      console.log(`[OfflineVoteManager] Vote ${voteId} synced successfully`);
      return true;
    } catch (error) {
      // Update retry count and possibly status
      const retryCount = vote.retryCount + 1;
      const errorMsg = error instanceof Error ? error.message : "Unknown error";

      console.error(
        `[OfflineVoteManager] Failed to sync vote ${voteId}: [Error: ${errorMsg}]`
      );

      const updates: Partial<OfflineVote> = {
        retryCount,
        error: errorMsg,
      };

      // Mark as error if max retries reached
      if (retryCount >= MAX_RETRY_ATTEMPTS) {
        updates.status = "error";
        console.log(
          `[OfflineVoteManager] Max retry attempts (${MAX_RETRY_ATTEMPTS}) reached for vote ${voteId}`
        );
      }

      await offlineStorage.updateOfflineVote(voteId, updates);
      return false;
    }
  },

  /**
   * Sync all pending votes
   */
  async syncAllPendingVotes(): Promise<{
    total: number;
    successful: number;
    failed: number;
  }> {
    const pendingVotes = await this.getPendingVotes();
    let successful = 0;
    let failed = 0;

    console.log(
      `[OfflineVoteManager] Starting sync of ${pendingVotes.length} pending votes`
    );

    for (const vote of pendingVotes) {
      const success = await this.syncVote(vote.id);
      if (success) {
        successful++;
      } else {
        failed++;
      }
    }

    console.log(
      `[OfflineVoteManager] Sync completed: ${successful} successful, ${failed} failed`
    );

    return {
      total: pendingVotes.length,
      successful,
      failed,
    };
  },

  /**
   * Remove synced votes that are older than the specified age in milliseconds
   */
  async cleanupSyncedVotes(
    maxAgeMs: number = 7 * 24 * 60 * 60 * 1000
  ): Promise<number> {
    const allVotes = await offlineStorage.getOfflineVotes();
    const now = Date.now();
    let removedCount = 0;

    for (const vote of allVotes) {
      if (vote.status === "synced" && now - vote.timestamp > maxAgeMs) {
        await offlineStorage.removeOfflineVote(vote.id);
        removedCount++;
      }
    }

    console.log(
      `[OfflineVoteManager] Cleaned up ${removedCount} old synced votes`
    );
    return removedCount;
  },
};

// Add a setup function at the end of the file - after the offlineVoteManager export
// Set up network listeners to automatically sync when coming online
export const setupOfflineVoteSync = () => {
  let isSyncing = false;

  // Subscribe to network state changes
  const unsubscribe = NetInfo.addEventListener(async (state) => {
    // Check if we're coming online and not already syncing
    if (state.isConnected && !isSyncing) {
      isSyncing = true;
      try {
        console.log(
          "[OfflineVoteManager] Network connected, checking for offline votes to sync"
        );

        // Get pending votes
        const pendingVotes = await offlineVoteManager.getPendingVotes();

        // If we have pending votes, sync them
        if (pendingVotes.length > 0) {
          console.log(
            `[OfflineVoteManager] Found ${pendingVotes.length} offline votes to sync`
          );
          await offlineVoteManager.syncAllPendingVotes();
        } else {
          console.log("[OfflineVoteManager] No offline votes to sync");
        }
      } catch (error) {
        console.error(
          "[OfflineVoteManager] Error syncing offline votes:",
          error
        );
      } finally {
        isSyncing = false;
      }
    }
  });

  // Return the unsubscribe function for cleanup
  return unsubscribe;
};

// Auto-setup when this module is imported
const unsubscribeNetInfo = setupOfflineVoteSync();
