import { createContext, useContext, useEffect, useMemo, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import { createSeedState, type WmsState } from "@/lib/wms-domain";

interface WmsContextValue {
  data: WmsState;
  setData: Dispatch<SetStateAction<WmsState>>;
  signedIn: boolean;
  setSignedIn: Dispatch<SetStateAction<boolean>>;
  ready: boolean;
}

const WmsContext = createContext<WmsContextValue | null>(null);
const STORAGE_KEY = "northstar-wms-state-v1";
const SESSION_KEY = "northstar-wms-session-v1";

export function WmsProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<WmsState>(createSeedState);
  const [signedIn, setSignedIn] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      const session = window.localStorage.getItem(SESSION_KEY);
      if (saved) setData(JSON.parse(saved) as WmsState);
      setSignedIn(session === "active");
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
      window.localStorage.removeItem(SESSION_KEY);
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (ready) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, [data, ready]);

  useEffect(() => {
    if (ready) {
      if (signedIn) window.localStorage.setItem(SESSION_KEY, "active");
      else window.localStorage.removeItem(SESSION_KEY);
    }
  }, [signedIn, ready]);

  const value = useMemo(() => ({ data, setData, signedIn, setSignedIn, ready }), [data, signedIn, ready]);
  return <WmsContext.Provider value={value}>{children}</WmsContext.Provider>;
}

export function useWms() {
  const context = useContext(WmsContext);
  if (!context) throw new Error("useWms must be used inside WmsProvider");
  return context;
}