import { VotingPool } from "../types";

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

// Cache expiration time (in milliseconds)
const CACHE_EXPIRATION = 5 * 60 * 1000; // 5 minutes

// Check if cache is valid (not expired)
const isCacheValid = (timestamp: number): boolean => {
  return Date.now() - timestamp < CACHE_EXPIRATION;
};

// Cache service functions
export const cacheService = {
  // Voting Pools
  getActiveVotingPools(): { data: VotingPool[]; isCached: boolean } {
    const isCached = isCacheValid(cache.votingPools.lastFetched.active);
    return {
      data: cache.votingPools.active,
      isCached,
    };
  },

  getUpcomingVotingPools(): { data: VotingPool[]; isCached: boolean } {
    const isCached = isCacheValid(cache.votingPools.lastFetched.upcoming);
    return {
      data: cache.votingPools.upcoming,
      isCached,
    };
  },

  getClosedVotingPools(): { data: VotingPool[]; isCached: boolean } {
    const isCached = isCacheValid(cache.votingPools.lastFetched.closed);
    return {
      data: cache.votingPools.closed,
      isCached,
    };
  },

  getVotingPoolById(id: string): {
    data: VotingPool | null;
    isCached: boolean;
  } {
    const cachedPool = cache.votingPools.byId[id];

    if (cachedPool && isCacheValid(cachedPool.timestamp)) {
      return {
        data: cachedPool.data,
        isCached: true,
      };
    }

    return { data: null, isCached: false };
  },

  setActiveVotingPools(pools: VotingPool[]): void {
    cache.votingPools.active = pools;
    cache.votingPools.lastFetched.active = Date.now();
  },

  setUpcomingVotingPools(pools: VotingPool[]): void {
    cache.votingPools.upcoming = pools;
    cache.votingPools.lastFetched.upcoming = Date.now();
  },

  setClosedVotingPools(pools: VotingPool[]): void {
    cache.votingPools.closed = pools;
    cache.votingPools.lastFetched.closed = Date.now();
  },

  setVotingPoolById(id: string, pool: VotingPool): void {
    cache.votingPools.byId[id] = {
      data: pool,
      timestamp: Date.now(),
    };
  },

  // User Voted Pools
  getUserVotedPools(status: "active" | "closed"): {
    data: string[];
    isCached: boolean;
  } {
    const isCached = isCacheValid(cache.userVotedPools.lastFetched[status]);
    return {
      data: cache.userVotedPools[status],
      isCached,
    };
  },

  setUserVotedPools(status: "active" | "closed", poolIds: string[]): void {
    cache.userVotedPools[status] = poolIds;
    cache.userVotedPools.lastFetched[status] = Date.now();
  },

  // Clear specific cache
  invalidateCache(type: "active" | "upcoming" | "closed" | "all"): void {
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
  },
};
