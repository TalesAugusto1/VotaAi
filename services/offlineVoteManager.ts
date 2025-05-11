import { OfflineVote, offlineStorage } from "./offlineStorage";
import { votesApi } from "./apiClient";
import { nanoid } from "./utils";
import NetInfo from "@react-native-community/netinfo";
import * as SecureStore from "expo-secure-store";

// API base URL
const API_BASE_URL = "https://your-api-url.com";

// Maximum number of retry attempts for a vote
const MAX_RETRY_ATTEMPTS = 3;

// Get token from secure storage
const getToken = async (): Promise<string | null> => {
  try {
    return await SecureStore.getItemAsync("user_token");
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

// Submit vote directly to the API
const submitVoteToApi = async (
  poolId: string,
  optionId: string
): Promise<any> => {
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
        await submitVoteToApi(poolId, optionId);
        console.log("[OfflineVoteManager] Vote submitted online successfully");
        return { success: true, offline: false };
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

    try {
      // Submit to server directly
      await submitVoteToApi(vote.poolId, vote.optionId);

      // Update vote status to synced
      await offlineStorage.updateOfflineVote(voteId, {
        status: "synced",
      });

      console.log(`[OfflineVoteManager] Vote ${voteId} synced successfully`);
      return true;
    } catch (error) {
      // Update retry count and possibly status
      const retryCount = vote.retryCount + 1;
      const updates: Partial<OfflineVote> = {
        retryCount,
        error: error instanceof Error ? error.message : "Unknown error",
      };

      // Mark as error if max retries reached
      if (retryCount >= MAX_RETRY_ATTEMPTS) {
        updates.status = "error";
      }

      await offlineStorage.updateOfflineVote(voteId, updates);
      console.error(
        `[OfflineVoteManager] Failed to sync vote ${voteId}:`,
        error
      );
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
