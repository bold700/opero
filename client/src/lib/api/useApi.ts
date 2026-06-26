import { useEffect, useState } from "react";
import i18n from "../../i18n";
import { ApiError } from "./client";

type State<T> = {
  data: T | null;
  loading: boolean;
  error: string | null;
};

// Minimal data-fetching hook: runs `fetcher` on mount (and when `deps` change),
// exposing { data, loading, error }. Plain useState/useEffect — no libraries.
export function useApi<T>(fetcher: () => Promise<T>, deps: unknown[] = []): State<T> {
  const [state, setState] = useState<State<T>>({ data: null, loading: true, error: null });

  useEffect(() => {
    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: null }));
    fetcher()
      .then((data) => {
        if (!cancelled) setState({ data, loading: false, error: null });
      })
      .catch((e) => {
        if (cancelled) return;
        // Non-component context: read the translation off the i18n instance.
        const msg = e instanceof ApiError ? e.message : i18n.t("common.states.loadFailed");
        setState({ data: null, loading: false, error: msg });
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return state;
}
