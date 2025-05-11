/**
 * Generate a random alphanumeric string of specified length
 * This is a simple implementation of nanoid for client use
 */
export function nanoid(length: number = 8): string {
  const chars =
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "";

  // Use crypto random values when available for better security
  if (
    typeof window !== "undefined" &&
    window.crypto &&
    window.crypto.getRandomValues
  ) {
    const randomValues = new Uint8Array(length);
    window.crypto.getRandomValues(randomValues);

    for (let i = 0; i < length; i++) {
      result += chars[randomValues[i] % chars.length];
    }
  } else {
    // Fallback to Math.random
    for (let i = 0; i < length; i++) {
      result += chars[Math.floor(Math.random() * chars.length)];
    }
  }

  return result;
}

/**
 * Format a date to a human-readable string
 */
export function formatDate(date: Date | string): string {
  if (typeof date === "string") {
    date = new Date(date);
  }

  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/**
 * Format a date and time to a human-readable string
 */
export function formatDateTime(date: Date | string): string {
  if (typeof date === "string") {
    date = new Date(date);
  }

  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Calculate time elapsed since a date
 * Returns a human-readable string like "2 minutes ago" or "3 days ago"
 */
export function timeAgo(date: Date | string | number): string {
  const now = new Date();
  const past = new Date(date);
  const diffMs = now.getTime() - past.getTime();

  // Convert to seconds
  const diffSecs = Math.floor(diffMs / 1000);

  if (diffSecs < 60) {
    return "há alguns segundos";
  }

  // Convert to minutes
  const diffMins = Math.floor(diffSecs / 60);

  if (diffMins < 60) {
    return `há ${diffMins} ${diffMins === 1 ? "minuto" : "minutos"}`;
  }

  // Convert to hours
  const diffHours = Math.floor(diffMins / 60);

  if (diffHours < 24) {
    return `há ${diffHours} ${diffHours === 1 ? "hora" : "horas"}`;
  }

  // Convert to days
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays < 30) {
    return `há ${diffDays} ${diffDays === 1 ? "dia" : "dias"}`;
  }

  // Convert to months
  const diffMonths = Math.floor(diffDays / 30);

  if (diffMonths < 12) {
    return `há ${diffMonths} ${diffMonths === 1 ? "mês" : "meses"}`;
  }

  // Convert to years
  const diffYears = Math.floor(diffMonths / 12);

  return `há ${diffYears} ${diffYears === 1 ? "ano" : "anos"}`;
}
