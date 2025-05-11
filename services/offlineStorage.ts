import AsyncStorage from "@react-native-async-storage/async-storage";
import { VotingPool, VotingOption } from "../types";

// Storage keys
const STORAGE_KEYS = {
  ACTIVE_POOLS: "votaai_active_pools",
  UPCOMING_POOLS: "votaai_upcoming_pools",
  CLOSED_POOLS: "votaai_closed_pools",
  POOL_DETAILS: "votaai_pool_details_",
  OFFLINE_VOTES: "votaai_offline_votes",
  LAST_FETCHED: "votaai_last_fetched_",
  USER_VOTED_POOLS: "votaai_user_voted_pools_",
};

// Define the offline vote structure
export interface OfflineVote {
  id: string; // Locally generated ID
  poolId: string;
  optionId: string;
  timestamp: number;
  status: "pending" | "error" | "synced";
  error?: string;
  retryCount: number;
}

// Offline storage service
export const offlineStorage = {
  // Pool cache operations
  async saveActivePools(pools: VotingPool[]): Promise<void> {
    try {
      // Create stripped copies of pools without large image data
      const storablePools = pools.map((pool) => {
        const poolCopy = { ...pool };

        // Remove large image data but keep a flag that images exist
        if (poolCopy.imageData) {
          poolCopy.hasImage = true;
          delete poolCopy.imageData;
        }

        // Handle images in options
        if (poolCopy.options) {
          poolCopy.options = poolCopy.options.map((option) => {
            const optionCopy = { ...option };
            if (optionCopy.imageData) {
              optionCopy.hasImage = true;
              delete optionCopy.imageData;
            }
            return optionCopy;
          });
        }

        return poolCopy;
      });

      const json = JSON.stringify(storablePools);
      await AsyncStorage.setItem(STORAGE_KEYS.ACTIVE_POOLS, json);
      await AsyncStorage.setItem(
        STORAGE_KEYS.LAST_FETCHED + "active",
        Date.now().toString()
      );
      console.log("[OfflineStorage] Saved active pools:", pools.length);
    } catch (error) {
      console.error("[OfflineStorage] Error saving active pools:", error);
    }
  },

  async saveUpcomingPools(pools: VotingPool[]): Promise<void> {
    try {
      // Create stripped copies of pools without large image data
      const storablePools = pools.map((pool) => {
        const poolCopy = { ...pool };

        // Remove large image data but keep a flag that images exist
        if (poolCopy.imageData) {
          poolCopy.hasImage = true;
          delete poolCopy.imageData;
        }

        // Handle images in options
        if (poolCopy.options) {
          poolCopy.options = poolCopy.options.map((option) => {
            const optionCopy = { ...option };
            if (optionCopy.imageData) {
              optionCopy.hasImage = true;
              delete optionCopy.imageData;
            }
            return optionCopy;
          });
        }

        return poolCopy;
      });

      const json = JSON.stringify(storablePools);
      await AsyncStorage.setItem(STORAGE_KEYS.UPCOMING_POOLS, json);
      await AsyncStorage.setItem(
        STORAGE_KEYS.LAST_FETCHED + "upcoming",
        Date.now().toString()
      );
      console.log("[OfflineStorage] Saved upcoming pools:", pools.length);
    } catch (error) {
      console.error("[OfflineStorage] Error saving upcoming pools:", error);
    }
  },

  async saveClosedPools(pools: VotingPool[]): Promise<void> {
    try {
      // Create stripped copies of pools without large image data
      const storablePools = pools.map((pool) => {
        const poolCopy = { ...pool };

        // Remove large image data but keep a flag that images exist
        if (poolCopy.imageData) {
          poolCopy.hasImage = true;
          delete poolCopy.imageData;
        }

        // Handle images in options
        if (poolCopy.options) {
          poolCopy.options = poolCopy.options.map((option) => {
            const optionCopy = { ...option };
            if (optionCopy.imageData) {
              optionCopy.hasImage = true;
              delete optionCopy.imageData;
            }
            return optionCopy;
          });
        }

        return poolCopy;
      });

      const json = JSON.stringify(storablePools);
      await AsyncStorage.setItem(STORAGE_KEYS.CLOSED_POOLS, json);
      await AsyncStorage.setItem(
        STORAGE_KEYS.LAST_FETCHED + "closed",
        Date.now().toString()
      );
      console.log("[OfflineStorage] Saved closed pools:", pools.length);
    } catch (error) {
      console.error("[OfflineStorage] Error saving closed pools:", error);
    }
  },

  async savePoolDetails(poolId: string, pool: VotingPool): Promise<void> {
    try {
      // Create a copy of the pool to modify
      const storablePool = { ...pool };

      // Remove large image data but keep a flag that images exist
      if (storablePool.imageData) {
        storablePool.hasImage = true;
        delete storablePool.imageData;
      }

      // Handle images in options
      if (storablePool.options) {
        storablePool.options = storablePool.options.map((option) => {
          const optionCopy = { ...option };
          if (optionCopy.imageData) {
            optionCopy.hasImage = true;
            delete optionCopy.imageData;
          }
          return optionCopy;
        });
      }

      const json = JSON.stringify({
        data: storablePool,
        timestamp: Date.now(),
      });

      await AsyncStorage.setItem(STORAGE_KEYS.POOL_DETAILS + poolId, json);
      console.log("[OfflineStorage] Saved pool details:", poolId);
    } catch (error) {
      console.error(
        `[OfflineStorage] Error saving pool details for ${poolId}:`,
        error
      );
    }
  },

  async getActivePools(): Promise<{ data: VotingPool[]; timestamp: number }> {
    try {
      const json = await AsyncStorage.getItem(STORAGE_KEYS.ACTIVE_POOLS);
      const timestampStr = await AsyncStorage.getItem(
        STORAGE_KEYS.LAST_FETCHED + "active"
      );

      if (json) {
        const data = JSON.parse(json) as VotingPool[];

        // Ensure all options have voteCount defined
        const processedData = data.map((pool) => ({
          ...pool,
          options: pool.options.map((option: VotingOption) => ({
            ...option,
            voteCount:
              typeof option.voteCount === "number" ? option.voteCount : 0,
          })),
        }));

        const timestamp = timestampStr ? parseInt(timestampStr, 10) : 0;
        console.log(
          "[OfflineStorage] Retrieved active pools:",
          processedData.length
        );
        return { data: processedData, timestamp };
      }
    } catch (error) {
      console.error("[OfflineStorage] Error retrieving active pools:", error);
    }

    return { data: [], timestamp: 0 };
  },

  async getUpcomingPools(): Promise<{ data: VotingPool[]; timestamp: number }> {
    try {
      const json = await AsyncStorage.getItem(STORAGE_KEYS.UPCOMING_POOLS);
      const timestampStr = await AsyncStorage.getItem(
        STORAGE_KEYS.LAST_FETCHED + "upcoming"
      );

      if (json) {
        const data = JSON.parse(json) as VotingPool[];

        // Ensure all options have voteCount defined
        const processedData = data.map((pool) => ({
          ...pool,
          options: pool.options.map((option: VotingOption) => ({
            ...option,
            voteCount:
              typeof option.voteCount === "number" ? option.voteCount : 0,
          })),
        }));

        const timestamp = timestampStr ? parseInt(timestampStr, 10) : 0;
        console.log(
          "[OfflineStorage] Retrieved upcoming pools:",
          processedData.length
        );
        return { data: processedData, timestamp };
      }
    } catch (error) {
      console.error("[OfflineStorage] Error retrieving upcoming pools:", error);
    }

    return { data: [], timestamp: 0 };
  },

  async getClosedPools(): Promise<{ data: VotingPool[]; timestamp: number }> {
    try {
      const json = await AsyncStorage.getItem(STORAGE_KEYS.CLOSED_POOLS);
      const timestampStr = await AsyncStorage.getItem(
        STORAGE_KEYS.LAST_FETCHED + "closed"
      );

      if (json) {
        const data = JSON.parse(json) as VotingPool[];

        // Ensure all options have voteCount defined
        const processedData = data.map((pool) => ({
          ...pool,
          options: pool.options.map((option: VotingOption) => ({
            ...option,
            voteCount:
              typeof option.voteCount === "number" ? option.voteCount : 0,
          })),
        }));

        const timestamp = timestampStr ? parseInt(timestampStr, 10) : 0;
        console.log(
          "[OfflineStorage] Retrieved closed pools:",
          processedData.length
        );
        return { data: processedData, timestamp };
      }
    } catch (error) {
      console.error("[OfflineStorage] Error retrieving closed pools:", error);
    }

    return { data: [], timestamp: 0 };
  },

  async getPoolDetails(
    poolId: string
  ): Promise<{ data: VotingPool | null; timestamp: number }> {
    try {
      const json = await AsyncStorage.getItem(
        STORAGE_KEYS.POOL_DETAILS + poolId
      );

      if (json) {
        const { data, timestamp } = JSON.parse(json);

        // Ensure all options have voteCount defined if present
        if (data && data.options) {
          data.options = data.options.map((option: VotingOption) => ({
            ...option,
            voteCount:
              typeof option.voteCount === "number" ? option.voteCount : 0,
          }));
        }

        console.log(`[OfflineStorage] Retrieved pool details for ${poolId}`);
        return { data, timestamp };
      }
    } catch (error) {
      console.error(
        `[OfflineStorage] Error retrieving pool details for ${poolId}:`,
        error
      );
    }

    return { data: null, timestamp: 0 };
  },

  // Offline votes queue operations
  async saveOfflineVote(vote: OfflineVote): Promise<void> {
    try {
      // Get current offline votes
      const votes = await this.getOfflineVotes();

      // Add new vote
      votes.push(vote);

      // Save back to storage
      const json = JSON.stringify(votes);
      await AsyncStorage.setItem(STORAGE_KEYS.OFFLINE_VOTES, json);
      console.log("[OfflineStorage] Saved offline vote:", vote.id);
    } catch (error) {
      console.error("[OfflineStorage] Error saving offline vote:", error);
    }
  },

  async getOfflineVotes(): Promise<OfflineVote[]> {
    try {
      const json = await AsyncStorage.getItem(STORAGE_KEYS.OFFLINE_VOTES);

      if (json) {
        const votes = JSON.parse(json) as OfflineVote[];
        console.log("[OfflineStorage] Retrieved offline votes:", votes.length);
        return votes;
      }
    } catch (error) {
      console.error("[OfflineStorage] Error retrieving offline votes:", error);
    }

    return [];
  },

  async updateOfflineVote(
    id: string,
    updates: Partial<OfflineVote>
  ): Promise<void> {
    try {
      const votes = await this.getOfflineVotes();
      const index = votes.findIndex((vote) => vote.id === id);

      if (index !== -1) {
        votes[index] = { ...votes[index], ...updates };
        const json = JSON.stringify(votes);
        await AsyncStorage.setItem(STORAGE_KEYS.OFFLINE_VOTES, json);
        console.log("[OfflineStorage] Updated offline vote:", id);
      }
    } catch (error) {
      console.error(
        `[OfflineStorage] Error updating offline vote ${id}:`,
        error
      );
    }
  },

  async removeOfflineVote(id: string): Promise<void> {
    try {
      const votes = await this.getOfflineVotes();
      const updatedVotes = votes.filter((vote) => vote.id !== id);

      const json = JSON.stringify(updatedVotes);
      await AsyncStorage.setItem(STORAGE_KEYS.OFFLINE_VOTES, json);
      console.log("[OfflineStorage] Removed offline vote:", id);
    } catch (error) {
      console.error(
        `[OfflineStorage] Error removing offline vote ${id}:`,
        error
      );
    }
  },

  // User voted pools operations
  async saveUserVotedPools(
    status: "active" | "closed",
    poolIds: string[]
  ): Promise<void> {
    try {
      const json = JSON.stringify(poolIds);
      await AsyncStorage.setItem(STORAGE_KEYS.USER_VOTED_POOLS + status, json);
      await AsyncStorage.setItem(
        STORAGE_KEYS.LAST_FETCHED + "voted_" + status,
        Date.now().toString()
      );
      console.log(
        `[OfflineStorage] Saved user voted ${status} pools:`,
        poolIds.length
      );
    } catch (error) {
      console.error(
        `[OfflineStorage] Error saving user voted ${status} pools:`,
        error
      );
    }
  },

  async getUserVotedPools(
    status: "active" | "closed"
  ): Promise<{ data: string[]; timestamp: number }> {
    try {
      const json = await AsyncStorage.getItem(
        STORAGE_KEYS.USER_VOTED_POOLS + status
      );
      const timestampStr = await AsyncStorage.getItem(
        STORAGE_KEYS.LAST_FETCHED + "voted_" + status
      );

      if (json) {
        const data = JSON.parse(json) as string[];
        const timestamp = timestampStr ? parseInt(timestampStr, 10) : 0;
        console.log(
          `[OfflineStorage] Retrieved user voted ${status} pools:`,
          data.length
        );
        return { data, timestamp };
      }
    } catch (error) {
      console.error(
        `[OfflineStorage] Error retrieving user voted ${status} pools:`,
        error
      );
    }

    return { data: [], timestamp: 0 };
  },

  // Clear storage
  async clearOfflineData(): Promise<void> {
    try {
      const keys = [
        STORAGE_KEYS.ACTIVE_POOLS,
        STORAGE_KEYS.UPCOMING_POOLS,
        STORAGE_KEYS.CLOSED_POOLS,
        STORAGE_KEYS.OFFLINE_VOTES,
        STORAGE_KEYS.USER_VOTED_POOLS + "active",
        STORAGE_KEYS.USER_VOTED_POOLS + "closed",
      ];

      await AsyncStorage.multiRemove(keys);
      console.log("[OfflineStorage] Cleared offline data");
    } catch (error) {
      console.error("[OfflineStorage] Error clearing offline data:", error);
    }
  },

  // Only clear the timestamps to force refresh
  async invalidateCache(
    type: "active" | "upcoming" | "closed" | "all"
  ): Promise<void> {
    try {
      if (type === "all") {
        const keys = [
          STORAGE_KEYS.LAST_FETCHED + "active",
          STORAGE_KEYS.LAST_FETCHED + "upcoming",
          STORAGE_KEYS.LAST_FETCHED + "closed",
          STORAGE_KEYS.LAST_FETCHED + "voted_active",
          STORAGE_KEYS.LAST_FETCHED + "voted_closed",
        ];
        await AsyncStorage.multiRemove(keys);
      } else {
        await AsyncStorage.removeItem(STORAGE_KEYS.LAST_FETCHED + type);

        if (type === "active" || type === "closed") {
          await AsyncStorage.removeItem(
            STORAGE_KEYS.LAST_FETCHED + "voted_" + type
          );
        }
      }

      console.log(`[OfflineStorage] Invalidated cache for ${type}`);
    } catch (error) {
      console.error(
        `[OfflineStorage] Error invalidating cache for ${type}:`,
        error
      );
    }
  },
};
