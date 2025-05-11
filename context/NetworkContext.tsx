import React, { createContext, useContext, useEffect, useState } from "react";
import NetInfo, {
  NetInfoState,
  NetInfoStateType,
} from "@react-native-community/netinfo";

interface NetworkContextType {
  isConnected: boolean | null;
  isInternetReachable: boolean | null;
  showOfflineBanner: boolean;
  hideOfflineBanner: () => void;
}

const NetworkContext = createContext<NetworkContextType>({
  isConnected: null,
  isInternetReachable: null,
  showOfflineBanner: false,
  hideOfflineBanner: () => {},
});

export const useNetwork = () => useContext(NetworkContext);

export const NetworkProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [networkState, setNetworkState] = useState<NetInfoState>({
    isConnected: null,
    isInternetReachable: null,
    type: NetInfoStateType.unknown,
    details: null,
  });

  const [showOfflineBanner, setShowOfflineBanner] = useState(false);
  const [wasOfflineBefore, setWasOfflineBefore] = useState(false);

  useEffect(() => {
    // Subscribe to network info updates
    const unsubscribe = NetInfo.addEventListener((state) => {
      console.log("Network state changed:", state);
      setNetworkState(state);

      // Show banner when connection is lost
      if (wasOfflineBefore === false && state.isConnected === false) {
        setShowOfflineBanner(true);
      }

      // Update was offline flag for next comparison
      setWasOfflineBefore(state.isConnected === false);
    });

    // Fetch initial state
    NetInfo.fetch().then((state) => {
      console.log("Initial network state:", state);
      setNetworkState(state);
      setWasOfflineBefore(state.isConnected === false);
    });

    // Cleanup
    return () => {
      unsubscribe();
    };
  }, []);

  const hideOfflineBanner = () => {
    setShowOfflineBanner(false);
  };

  return (
    <NetworkContext.Provider
      value={{
        isConnected: networkState.isConnected,
        isInternetReachable: networkState.isInternetReachable,
        showOfflineBanner,
        hideOfflineBanner,
      }}
    >
      {children}
    </NetworkContext.Provider>
  );
};
