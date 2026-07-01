import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import Box from "@mui/material/Box";
import InputBase from "@mui/material/InputBase";
import Typography from "@mui/material/Typography";
import CircularProgress from "@mui/material/CircularProgress";
import ClickAwayListener from "@mui/material/ClickAwayListener";
import SearchIcon from "@mui/icons-material/Search";
import CloseIcon from "@mui/icons-material/Close";
import GroupsIcon from "@mui/icons-material/Groups";
import FolderOutlinedIcon from "@mui/icons-material/FolderOutlined";
import AssignmentIcon from "@mui/icons-material/Assignment";
import { search, totalHits, type SearchResults, type SearchHit } from "../../../lib/api/search";
import { CARD_SHADOW, LAVENDER, RADIUS } from "../../../theme/tokens";

const EMPTY: SearchResults = { customers: [], projects: [], workOrders: [] };

// Inline search box that lives in the top bar. Click into it and type — results
// drop down directly below the field. No modal, no anchor math: the field IS the
// anchor, and focus is a normal click. Role-scoped via /search.
export function SearchField() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SearchResults>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Debounced search.
  useEffect(() => {
    const query = q.trim();
    if (query.length < 2) {
      setResults(EMPTY);
      setLoading(false);
      return;
    }
    setLoading(true);
    let cancelled = false;
    const handle = setTimeout(async () => {
      try {
        const r = await search(query);
        if (!cancelled) setResults(r);
      } catch {
        if (!cancelled) setResults(EMPTY);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [q]);

  const go = (path: string) => {
    setFocused(false);
    inputRef.current?.blur();
    navigate(path);
  };

  const clear = () => {
    setQ("");
    setResults(EMPTY);
    inputRef.current?.focus();
  };

  const hasQuery = q.trim().length >= 2;
  const count = totalHits(results);
  const open = focused && hasQuery;

  const groups: {
    key: string;
    icon: typeof GroupsIcon;
    hits: SearchHit[];
    route: (h: SearchHit) => string;
  }[] = [
    { key: "workOrders", icon: AssignmentIcon, hits: results.workOrders, route: (h) => `/work-orders/${h.id}` },
    { key: "projects", icon: FolderOutlinedIcon, hits: results.projects, route: () => `/work-orders` },
    { key: "customers", icon: GroupsIcon, hits: results.customers, route: () => `/customers` },
  ];

  return (
    <ClickAwayListener onClickAway={() => setFocused(false)}>
      <Box sx={{ position: "relative", width: { xs: 200, sm: 280 } }}>
        {/* The field */}
        <Box
          onClick={() => inputRef.current?.focus()}
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1,
            height: 40,
            px: 1.5,
            borderRadius: `${RADIUS.pill}px`,
            bgcolor: "action.hover",
            border: "1px solid",
            borderColor: focused ? "primary.main" : "transparent",
            transition: "border-color .15s",
            cursor: "text",
          }}
        >
          <SearchIcon fontSize="small" sx={{ color: "text.secondary" }} />
          <InputBase
            inputRef={inputRef}
            fullWidth
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onFocus={() => setFocused(true)}
            placeholder={t("search.placeholder")}
            sx={{ fontSize: 14 }}
          />
          {loading ? (
            <CircularProgress size={15} />
          ) : q ? (
            <CloseIcon
              fontSize="small"
              onClick={(e) => {
                e.stopPropagation();
                clear();
              }}
              sx={{ color: "text.secondary", cursor: "pointer", fontSize: 18 }}
            />
          ) : null}
        </Box>

        {/* Results dropdown — anchored to the field, full field width. */}
        {open ? (
          <Box
            sx={{
              position: "absolute",
              top: "calc(100% + 6px)",
              right: 0,
              width: 360,
              maxWidth: "calc(100vw - 32px)",
              bgcolor: "background.paper",
              border: `1px solid`,
              borderColor: "divider",
              borderRadius: `${RADIUS.card}px`,
              boxShadow: CARD_SHADOW,
              overflow: "hidden",
              zIndex: 20,
            }}
          >
            <Box sx={{ maxHeight: 380, overflowY: "auto", py: 0.5 }}>
              {!loading && count === 0 ? (
                <Box sx={{ px: 2, py: 2.5, textAlign: "center" }}>
                  <Typography variant="body2" color="text.secondary">
                    {t("search.empty")}
                  </Typography>
                </Box>
              ) : (
                groups
                  .filter((g) => g.hits.length > 0)
                  .map((g) => {
                    const Icon = g.icon;
                    return (
                      <Box key={g.key} sx={{ mb: 0.5 }}>
                        <Typography
                          sx={{
                            px: 2,
                            pt: 1,
                            pb: 0.5,
                            fontSize: 11,
                            fontWeight: 700,
                            letterSpacing: "0.06em",
                            textTransform: "uppercase",
                            color: "text.secondary",
                          }}
                        >
                          {t(`search.groups.${g.key}`)}
                        </Typography>
                        {g.hits.map((h) => (
                          <Box
                            key={h.id}
                            role="button"
                            onClick={() => go(g.route(h))}
                            sx={{
                              display: "flex",
                              alignItems: "center",
                              gap: 1.5,
                              mx: 1,
                              px: 1.5,
                              py: 1,
                              borderRadius: `${RADIUS.control}px`,
                              cursor: "pointer",
                              "&:hover": { bgcolor: LAVENDER },
                            }}
                          >
                            <Icon fontSize="small" sx={{ color: "primary.main", flexShrink: 0 }} />
                            <Box sx={{ minWidth: 0 }}>
                              <Typography sx={{ fontSize: 14, fontWeight: 500 }} noWrap>
                                {h.label}
                              </Typography>
                              {h.sublabel ? (
                                <Typography variant="caption" color="text.secondary" noWrap sx={{ display: "block" }}>
                                  {h.sublabel}
                                </Typography>
                              ) : null}
                            </Box>
                          </Box>
                        ))}
                      </Box>
                    );
                  })
              )}
            </Box>
          </Box>
        ) : null}
      </Box>
    </ClickAwayListener>
  );
}
