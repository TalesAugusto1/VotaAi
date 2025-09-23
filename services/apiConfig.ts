// API configuration file
// Central place to store API-related configuration values

// API base URL - Change this to your actual server IP
export const API_BASE_URL = "http://192.168.15.15:3000";

// Token storage key
export const TOKEN_STORAGE_KEY = "VotaAi_token";

// Cache expiration time (in milliseconds)
export const CACHE_EXPIRATION = 5 * 60 * 1000; // 5 minutes

// Request timeout (in milliseconds)
export const REQUEST_TIMEOUT = 10000; // 10 seconds

// Check if we're in development mode
export const IS_DEVELOPMENT = __DEV__;

// Fallback API URL for when the main server is not available
export const FALLBACK_API_URL = "http://localhost:3000";
