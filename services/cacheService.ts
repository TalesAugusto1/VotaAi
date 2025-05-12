import { VotingPool } from "../types";
import { offlineStorage } from "./offlineStorage";
import NetInfo from "@react-native-community/netinfo";
import AsyncStorage from "@react-native-async-storage/async-storage";

// Cache expiration time (in milliseconds)
const CACHE_EXPIRATION = 5 * 60 * 1000; // 5 minutes

// Define the types of cached data
interface CacheData {
  votingPools: {
    active: VotingPool[];
    upcoming: VotingPool[];
    closed: VotingPool[];
    byId: Record<string, { data: VotingPool; timestamp: number }>;
    lastFetched: Record<"active" | "upcoming" | "closed", number>;
  };
  userVotedPools: {
    active: string[];
    closed: string[];
    lastFetched: Record<"active" | "closed", number>;
  };
}

// Initialize cache with empty values
const cache: CacheData = {
  votingPools: {
    active: [],
    upcoming: [],
    closed: [],
    byId: {},
    lastFetched: {
      active: 0,
      upcoming: 0,
      closed: 0,
    },
  },
  userVotedPools: {
    active: [],
    closed: [],
    lastFetched: {
      active: 0,
      closed: 0,
    },
  },
};

// Check if cache is valid (not expired)
const isCacheValid = (timestamp: number): boolean => {
  return Date.now() - timestamp < CACHE_EXPIRATION;
};

// Load cached data from persistent storage
const initializeFromStorage = async () => {
  try {
    // Check network status first
    const networkState = await NetInfo.fetch();
    const isOnline = networkState.isConnected === true;

    // If online, just initialize empty cache - we'll get fresh data
    // and still have offline data as fallback
    if (isOnline) {
      console.log(
        "[CacheService] Online, will prioritize fresh data on first load"
      );
      // We still initialize cache to avoid undefined errors
      cache.votingPools.active = [];
      cache.votingPools.upcoming = [];
      cache.votingPools.closed = [];
      cache.userVotedPools.active = [];
      cache.userVotedPools.closed = [];

      // Only load voted pool IDs and timestamps from storage, not actual pool data
      const userVotedActive = await offlineStorage.getUserVotedPools("active");
      if (userVotedActive.data.length > 0) {
        cache.userVotedPools.active = userVotedActive.data;
        cache.userVotedPools.lastFetched.active = userVotedActive.timestamp;
        console.log(
          "[CacheService] Loaded user voted active pools from storage:",
          userVotedActive.data.length
        );
      }

      const userVotedClosed = await offlineStorage.getUserVotedPools("closed");
      if (userVotedClosed.data.length > 0) {
        cache.userVotedPools.closed = userVotedClosed.data;
        cache.userVotedPools.lastFetched.closed = userVotedClosed.timestamp;
        console.log(
          "[CacheService] Loaded user voted closed pools from storage:",
          userVotedClosed.data.length
        );
      }

      console.log("[CacheService] Initialized for online mode");
      return;
    }

    // If offline, load everything from storage
    console.log("[CacheService] Offline, loading all data from storage");

    // Load active pools
    const activePools = await offlineStorage.getActivePools();
    if (activePools.data.length > 0) {
      cache.votingPools.active = activePools.data;
      cache.votingPools.lastFetched.active = activePools.timestamp;
      console.log(
        "[CacheService] Loaded active pools from storage:",
        activePools.data.length
      );
    }

    // Load upcoming pools
    const upcomingPools = await offlineStorage.getUpcomingPools();
    if (upcomingPools.data.length > 0) {
      cache.votingPools.upcoming = upcomingPools.data;
      cache.votingPools.lastFetched.upcoming = upcomingPools.timestamp;
      console.log(
        "[CacheService] Loaded upcoming pools from storage:",
        upcomingPools.data.length
      );
    }

    // Load closed pools
    const closedPools = await offlineStorage.getClosedPools();
    if (closedPools.data.length > 0) {
      cache.votingPools.closed = closedPools.data;
      cache.votingPools.lastFetched.closed = closedPools.timestamp;
      console.log(
        "[CacheService] Loaded closed pools from storage:",
        closedPools.data.length
      );
    }

    // Load user voted pools
    const userVotedActive = await offlineStorage.getUserVotedPools("active");
    if (userVotedActive.data.length > 0) {
      cache.userVotedPools.active = userVotedActive.data;
      cache.userVotedPools.lastFetched.active = userVotedActive.timestamp;
      console.log(
        "[CacheService] Loaded user voted active pools from storage:",
        userVotedActive.data.length
      );
    }

    const userVotedClosed = await offlineStorage.getUserVotedPools("closed");
    if (userVotedClosed.data.length > 0) {
      cache.userVotedPools.closed = userVotedClosed.data;
      cache.userVotedPools.lastFetched.closed = userVotedClosed.timestamp;
      console.log(
        "[CacheService] Loaded user voted closed pools from storage:",
        userVotedClosed.data.length
      );
    }

    console.log("[CacheService] Initialized from storage");
  } catch (error) {
    console.error("[CacheService] Error initializing from storage:", error);
  }
};

// Initialize from storage when this module is loaded
initializeFromStorage();

// Cache service functions
export const cacheService = {
  // Voting Pools
  async getActiveVotingPools(): Promise<{
    data: VotingPool[];
    isCached: boolean;
  }> {
    const isCached = isCacheValid(cache.votingPools.lastFetched.active);
    return {
      data: cache.votingPools.active,
      isCached,
    };
  },

  async getUpcomingVotingPools(): Promise<{
    data: VotingPool[];
    isCached: boolean;
  }> {
    const isCached = isCacheValid(cache.votingPools.lastFetched.upcoming);
    return {
      data: cache.votingPools.upcoming,
      isCached,
    };
  },

  async getClosedVotingPools(): Promise<{
    data: VotingPool[];
    isCached: boolean;
  }> {
    const isCached = isCacheValid(cache.votingPools.lastFetched.closed);
    return {
      data: cache.votingPools.closed,
      isCached,
    };
  },

  async getVotingPoolById(id: string): Promise<{
    data: VotingPool | null;
    isCached: boolean;
  }> {
    const cachedPool = cache.votingPools.byId[id];

    if (cachedPool && isCacheValid(cachedPool.timestamp)) {
      return {
        data: cachedPool.data,
        isCached: true,
      };
    }

    // Try to get from persistent storage if not in memory cache
    const storedPool = await offlineStorage.getPoolDetails(id);
    if (storedPool.data && isCacheValid(storedPool.timestamp)) {
      // Also update memory cache
      cache.votingPools.byId[id] = {
        data: storedPool.data,
        timestamp: storedPool.timestamp,
      };

      return {
        data: storedPool.data,
        isCached: true,
      };
    }

    return { data: null, isCached: false };
  },

  async setActiveVotingPools(pools: VotingPool[]): Promise<void> {
    cache.votingPools.active = pools;
    cache.votingPools.lastFetched.active = Date.now();

    // Also save to persistent storage
    await offlineStorage.saveActivePools(pools);
  },

  async setUpcomingVotingPools(pools: VotingPool[]): Promise<void> {
    cache.votingPools.upcoming = pools;
    cache.votingPools.lastFetched.upcoming = Date.now();

    // Also save to persistent storage
    await offlineStorage.saveUpcomingPools(pools);
  },

  async setClosedVotingPools(pools: VotingPool[]): Promise<void> {
    cache.votingPools.closed = pools;
    cache.votingPools.lastFetched.closed = Date.now();

    // Also save to persistent storage
    await offlineStorage.saveClosedPools(pools);
  },

  async setVotingPoolById(id: string, pool: VotingPool): Promise<void> {
    cache.votingPools.byId[id] = {
      data: pool,
      timestamp: Date.now(),
    };

    // Also save to persistent storage
    await offlineStorage.savePoolDetails(id, pool);
  },

  // User Voted Pools
  async getUserVotedPools(status: "active" | "closed"): Promise<{
    data: string[];
    isCached: boolean;
  }> {
    const isCached = isCacheValid(cache.userVotedPools.lastFetched[status]);
    return {
      data: cache.userVotedPools[status],
      isCached,
    };
  },

  async setUserVotedPools(
    status: "active" | "closed",
    poolIds: string[]
  ): Promise<void> {
    cache.userVotedPools[status] = poolIds;
    cache.userVotedPools.lastFetched[status] = Date.now();

    // Also save to persistent storage
    await offlineStorage.saveUserVotedPools(status, poolIds);
  },

  // Clear specific cache
  async invalidateCache(
    type: "active" | "upcoming" | "closed" | "all"
  ): Promise<void> {
    if (type === "all") {
      // Reset all timestamps to force refetch
      cache.votingPools.lastFetched.active = 0;
      cache.votingPools.lastFetched.upcoming = 0;
      cache.votingPools.lastFetched.closed = 0;
      cache.userVotedPools.lastFetched.active = 0;
      cache.userVotedPools.lastFetched.closed = 0;
    } else {
      cache.votingPools.lastFetched[type] = 0;

      if (type === "active" || type === "closed") {
        cache.userVotedPools.lastFetched[type] = 0;
      }
    }

    // Also invalidate persistent storage cache
    await offlineStorage.invalidateCache(type);
  },

  // Add a new method to get cache age
  async getCacheAge(key: string): Promise<number> {
    try {
      const timestamp = await AsyncStorage.getItem(`${key}_timestamp`);
      if (!timestamp) return Infinity;

      const cacheTime = parseInt(timestamp, 10);
      const now = Date.now();
      return now - cacheTime;
    } catch (error) {
      console.error(`Error getting cache age for ${key}:`, error);
      return Infinity;
    }
  },

  // When setting the cache, also set a timestamp
  async setCacheWithTimestamp(key: string, data: any): Promise<void> {
    try {
      await AsyncStorage.setItem(key, JSON.stringify(data));
      await AsyncStorage.setItem(`${key}_timestamp`, Date.now().toString());
      console.log(`Cache set for ${key}`);
    } catch (error) {
      console.error(`Error setting cache for ${key}:`, error);
    }
  },

  // Generic get method for any data
  async get(key: string): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(key);
    } catch (error) {
      console.error(`Error getting cache for ${key}:`, error);
      return null;
    }
  },

  // Generic set method for any data
  async set(key: string, value: string): Promise<void> {
    try {
      await AsyncStorage.setItem(key, value);
      console.log(`Cache set for ${key}`);
    } catch (error) {
      console.error(`Error setting cache for ${key}:`, error);
    }
  },
};
