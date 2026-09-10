import { useCallback, useEffect, useMemo, useState } from "react";
import {
  PUBLIC_ENDPOINTS,
  type PublicEndpointKey,
} from "@blockreq/rpc";

export type EditableEndpoints = {
  https: string;
  wss: string;
  draftHttps: string;
  draftWss: string;
  label: string;
  chainIdHex: string;
  endpointKey: PublicEndpointKey;
  dirty: boolean;
  setHttps: (v: string) => void;
  setWss: (v: string) => void;
  commit: () => void;
  reset: () => void;
};

function storageKey(slug: string, endpointKey: PublicEndpointKey) {
  return `blockreq.ep.${slug}.${endpointKey}`;
}

function loadStored(slug: string, endpointKey: PublicEndpointKey) {
  try {
    const raw = localStorage.getItem(storageKey(slug, endpointKey));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { https?: string; wss?: string };
    if (!parsed || typeof parsed !== "object") return null;
    return {
      https: typeof parsed.https === "string" ? parsed.https.trim() : "",
      wss: typeof parsed.wss === "string" ? parsed.wss.trim() : "",
    };
  } catch {
    return null;
  }
}

function saveStored(slug: string, endpointKey: PublicEndpointKey, https: string, wss: string) {
  try {
    localStorage.setItem(storageKey(slug, endpointKey), JSON.stringify({ https, wss }));
  } catch {
    /* ignore */
  }
}

/**
 * User-editable HTTPS/WSS defaults from PUBLIC_ENDPOINTS.
 * Persists per slug + chain key in localStorage.
 */
export function useEditableEndpoints(
  slug: string,
  endpointKey: PublicEndpointKey
): EditableEndpoints {
  const defaults = PUBLIC_ENDPOINTS[endpointKey];
  const [https, setHttpsState] = useState<string>(defaults.https);
  const [wss, setWssState] = useState<string>(defaults.wss);
  const [draftHttps, setDraftHttps] = useState<string>(defaults.https);
  const [draftWss, setDraftWss] = useState<string>(defaults.wss);

  useEffect(() => {
    const stored = loadStored(slug, endpointKey);
    const nextHttps = stored?.https || defaults.https;
    const nextWss = stored?.wss || defaults.wss;
    setHttpsState(nextHttps);
    setWssState(nextWss);
    setDraftHttps(nextHttps);
    setDraftWss(nextWss);
  }, [slug, endpointKey, defaults.https, defaults.wss]);

  const dirty = draftHttps.trim() !== https || draftWss.trim() !== wss;

  const commit = useCallback(() => {
    const nextHttps = draftHttps.trim() || defaults.https;
    const nextWss = draftWss.trim() || defaults.wss;
    setHttpsState(nextHttps);
    setWssState(nextWss);
    setDraftHttps(nextHttps);
    setDraftWss(nextWss);
    saveStored(slug, endpointKey, nextHttps, nextWss);
  }, [draftHttps, draftWss, defaults.https, defaults.wss, slug, endpointKey]);

  const reset = useCallback(() => {
    setHttpsState(defaults.https);
    setWssState(defaults.wss);
    setDraftHttps(defaults.https);
    setDraftWss(defaults.wss);
    try {
      localStorage.removeItem(storageKey(slug, endpointKey));
    } catch {
      /* ignore */
    }
  }, [defaults.https, defaults.wss, slug, endpointKey]);

  return useMemo(
    () => ({
      https,
      wss,
      draftHttps,
      draftWss,
      label: defaults.label,
      chainIdHex: defaults.chainIdHex,
      endpointKey,
      dirty,
      setHttps: setDraftHttps,
      setWss: setDraftWss,
      commit,
      reset,
    }),
    [
      https,
      wss,
      draftHttps,
      draftWss,
      defaults.label,
      defaults.chainIdHex,
      endpointKey,
      dirty,
      commit,
      reset,
    ]
  );
}
