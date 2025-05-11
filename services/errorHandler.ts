// Error types with user-friendly messages
export type ErrorType =
  | "network"
  | "auth"
  | "validation"
  | "notFound"
  | "server"
  | "rateLimit"
  | "unknown";

interface ErrorDetails {
  title: string;
  message: string;
  suggestion: string;
  icon?: string;
}

// Map error codes to user-friendly messages
const errorMessages: Record<ErrorType, ErrorDetails> = {
  network: {
    title: "Falha na Conexão",
    message: "Não foi possível conectar ao servidor.",
    suggestion: "Verifique sua conexão com a internet e tente novamente.",
    icon: "wifi-off",
  },
  auth: {
    title: "Erro de Autenticação",
    message: "Você não tem permissão para realizar esta ação.",
    suggestion: "Faça login novamente ou verifique suas permissões.",
    icon: "lock",
  },
  validation: {
    title: "Dados Inválidos",
    message: "Os dados fornecidos não são válidos.",
    suggestion: "Verifique as informações e tente novamente.",
    icon: "alert-circle",
  },
  notFound: {
    title: "Não Encontrado",
    message: "O item solicitado não foi encontrado.",
    suggestion: "Verifique se o item ainda existe ou tente outra busca.",
    icon: "search-off",
  },
  server: {
    title: "Erro no Servidor",
    message: "Ocorreu um erro no servidor.",
    suggestion:
      "Tente novamente mais tarde. Se o problema persistir, entre em contato com o suporte.",
    icon: "server-off",
  },
  rateLimit: {
    title: "Muitas Solicitações",
    message: "Você realizou muitas solicitações em um curto período.",
    suggestion: "Aguarde um momento antes de tentar novamente.",
    icon: "hourglass",
  },
  unknown: {
    title: "Erro Inesperado",
    message: "Ocorreu um erro inesperado.",
    suggestion:
      "Tente novamente. Se o problema persistir, entre em contato com o suporte.",
    icon: "alert-triangle",
  },
};

// Function to get user-friendly error details from HTTP status code
export function getErrorTypeFromStatus(status: number): ErrorType {
  switch (status) {
    case 400:
      return "validation";
    case 401:
    case 403:
      return "auth";
    case 404:
      return "notFound";
    case 429:
      return "rateLimit";
    case 500:
    case 502:
    case 503:
      return "server";
    default:
      return "unknown";
  }
}

// Function to get error details
export function getErrorDetails(
  error: any,
  defaultType: ErrorType = "unknown"
): ErrorDetails {
  // Try to determine error type based on status code
  let errorType = defaultType;

  // Check for network errors
  if (!navigator.onLine || error?.message?.includes("network")) {
    errorType = "network";
  }
  // Check for status code
  else if (error?.status) {
    errorType = getErrorTypeFromStatus(error.status);
  } else if (error?.response?.status) {
    errorType = getErrorTypeFromStatus(error.response.status);
  }

  // Get base error details
  const details = { ...errorMessages[errorType] };

  // Add specific error message if available
  if (error?.message && errorType !== "network") {
    details.message = `${details.message} ${error.message}`;
  }

  return details;
}
