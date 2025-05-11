import { useState } from "react";
import { getErrorDetails, ErrorType } from "../services/errorHandler";

interface ModalOptions {
  title?: string;
  message: string;
  suggestion?: string;
  type?: "success" | "error" | "info" | "warning";
  icon?: string;
  actions?: {
    text: string;
    onPress: () => void;
    style?: "default" | "cancel" | "destructive";
  }[];
}

export function useModal() {
  const [visible, setVisible] = useState(false);
  const [options, setOptions] = useState<ModalOptions>({
    title: "",
    message: "",
    type: "info",
    actions: [{ text: "OK", onPress: () => hideModal(), style: "default" }],
  });

  const showModal = (newOptions: ModalOptions) => {
    setOptions({
      ...options,
      ...newOptions,
      actions: newOptions.actions || [
        { text: "OK", onPress: () => hideModal(), style: "default" },
      ],
    });
    setVisible(true);
  };

  const showErrorModal = (error: any, errorType?: ErrorType) => {
    const errorDetails = getErrorDetails(error, errorType);

    showModal({
      title: errorDetails.title,
      message: errorDetails.message,
      suggestion: errorDetails.suggestion,
      type: "error",
      icon: errorDetails.icon,
      actions: [
        {
          text: "OK",
          onPress: () => hideModal(),
          style: "default",
        },
      ],
    });
  };

  const hideModal = () => {
    setVisible(false);
  };

  return {
    visible,
    options,
    showModal,
    showErrorModal,
    hideModal,
  };
}
