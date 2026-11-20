import { useEffect, useState } from "react";

// Fork feature: self-hosted cloud saves. The config is read once by the main
// process at startup, so a single shared request is enough.
let statusPromise: Promise<boolean> | null = null;
let cachedEnabled: boolean | null = null;

const loadStatus = () => {
  statusPromise ??= window.electron
    .getSelfHostedSavesStatus()
    .then((status) => {
      cachedEnabled = status.enabled;
      return status.enabled;
    })
    .catch(() => {
      cachedEnabled = false;
      return false;
    });
  return statusPromise;
};

export function useSelfHostedSaves() {
  const [enabled, setEnabled] = useState(cachedEnabled ?? false);

  useEffect(() => {
    let active = true;
    loadStatus().then((value) => {
      if (active) setEnabled(value);
    });
    return () => {
      active = false;
    };
  }, []);

  return { selfHostedSavesEnabled: enabled };
}
