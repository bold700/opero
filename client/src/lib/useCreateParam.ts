import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";

// Opens a feature's create dialog when the page is visited with ?create=1
// (used by the global quick-create menu), then clears the param so a refresh or
// back-navigation doesn't reopen the dialog.
//
// Pass the page's own create-opener. It only fires for admins/anyone allowed —
// the menu already filters by role, but pass `enabled: false` to ignore the
// param on pages where the current user can't create.
export function useCreateParam(open: () => void, enabled = true): void {
  const [params, setParams] = useSearchParams();

  useEffect(() => {
    if (enabled && params.get("create") === "1") {
      open();
      const next = new URLSearchParams(params);
      next.delete("create");
      setParams(next, { replace: true });
    }
    // `open` is referenced but intentionally not a dep — pages define it inline;
    // we only want to react to the param changing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params, enabled]);
}
