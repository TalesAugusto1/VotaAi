import { useState } from "react";

interface ModalOptions {
  title?: string;
  message: string;
  type?: "success" | "error" | "info" | "warning";
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

  const hideModal = () => {
    setVisible(false);
  };

  return {
    visible,
    options,
    showModal,
    hideModal,
  };
}
