import { useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import Paper from "@mui/material/Paper";
import Popper from "@mui/material/Popper";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import SendIcon from "@mui/icons-material/Send";
import { CARD_SHADOW, HAIRLINE, RADIUS, SPACING } from "../../../theme/tokens";
import type { MentionCandidate } from "../api";

type ActiveMention = { start: number; end: number; query: string };

function findActiveMention(value: string, cursor: number): ActiveMention | null {
  const beforeCursor = value.slice(0, cursor);
  const match = beforeCursor.match(/(?:^|\s)@([^\s@]*)$/);
  if (!match) return null;
  const at = beforeCursor.lastIndexOf("@");
  return { start: at, end: cursor, query: match[1].toLocaleLowerCase() };
}

export function MentionComposer({
  candidates,
  onSubmit,
}: {
  candidates: MentionCandidate[];
  onSubmit: (body: string, mentionUserIds: string[]) => Promise<void>;
}) {
  const { t } = useTranslation();
  const anchorRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState("");
  const [selectedMentions, setSelectedMentions] = useState<MentionCandidate[]>([]);
  const [activeMention, setActiveMention] = useState<ActiveMention | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [sending, setSending] = useState(false);

  const matches = useMemo(() => {
    if (!activeMention) return [];
    const query = activeMention.query;
    return candidates
      .filter((candidate) =>
        `${candidate.name} ${candidate.email}`.toLocaleLowerCase().includes(query),
      )
      .slice(0, 8);
  }, [activeMention, candidates]);

  const updateActiveMention = (nextValue: string, cursor: number) => {
    setActiveMention(findActiveMention(nextValue, cursor));
    setActiveIndex(0);
  };

  const choose = (candidate: MentionCandidate) => {
    if (!activeMention) return;
    const nextValue = `${value.slice(0, activeMention.start)}@${candidate.name} ${value.slice(activeMention.end)}`;
    const nextCursor = activeMention.start + candidate.name.length + 2;
    setValue(nextValue);
    setSelectedMentions((current) =>
      current.some((mention) => mention.id === candidate.id)
        ? current
        : [...current, candidate],
    );
    setActiveMention(null);
    queueMicrotask(() => {
      inputRef.current?.focus();
      inputRef.current?.setSelectionRange(nextCursor, nextCursor);
    });
  };

  const send = async () => {
    const body = value.trim();
    if (!body) return;
    const mentionUserIds = selectedMentions
      .filter((mention) => body.includes(`@${mention.name}`))
      .map((mention) => mention.id);
    setSending(true);
    try {
      await onSubmit(body, mentionUserIds);
      setValue("");
      setSelectedMentions([]);
      setActiveMention(null);
    } finally {
      setSending(false);
    }
  };

  return (
    <Box
      ref={anchorRef}
      sx={{
        display: "flex",
        gap: SPACING.itemGap,
        py: SPACING.itemGap,
        borderBottom: `1px solid ${HAIRLINE}`,
      }}
    >
      <TextField
        inputRef={inputRef}
        placeholder={t("workOrderDetail.notes.placeholder")}
        value={value}
        onChange={(event) => {
          const nextValue = event.target.value;
          setValue(nextValue);
          updateActiveMention(nextValue, event.target.selectionStart ?? nextValue.length);
        }}
        onClick={(event) => {
          const input = event.currentTarget.querySelector("textarea, input") as HTMLInputElement | null;
          updateActiveMention(value, input?.selectionStart ?? value.length);
        }}
        onKeyDown={(event) => {
          if (activeMention && matches.length > 0) {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setActiveIndex((index) => (index + 1) % matches.length);
              return;
            }
            if (event.key === "ArrowUp") {
              event.preventDefault();
              setActiveIndex((index) => (index - 1 + matches.length) % matches.length);
              return;
            }
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              choose(matches[activeIndex] ?? matches[0]);
              return;
            }
          }
          if (event.key === "Escape") {
            setActiveMention(null);
            return;
          }
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            void send();
          }
        }}
        disabled={sending}
        size="small"
        fullWidth
        multiline
        maxRows={4}
      />
      <IconButton
        aria-label={t("activity.commentSend")}
        onClick={() => void send()}
        disabled={sending || !value.trim()}
        color="primary"
      >
        <SendIcon fontSize="small" />
      </IconButton>
      <Popper
        open={Boolean(activeMention) && matches.length > 0}
        anchorEl={anchorRef.current}
        placement="bottom-start"
        sx={{ zIndex: (theme) => theme.zIndex.modal + 1, width: anchorRef.current?.clientWidth }}
      >
        <Paper
          elevation={0}
          sx={{
            mt: SPACING.fieldLabelGap,
            border: `1px solid ${HAIRLINE}`,
            borderRadius: `${RADIUS.control}px`,
            boxShadow: CARD_SHADOW,
            overflow: "hidden",
          }}
        >
          <List disablePadding>
            {matches.map((candidate, index) => (
              <ListItemButton
                key={candidate.id}
                selected={index === activeIndex}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => choose(candidate)}
              >
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {candidate.name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" noWrap>
                    {candidate.email}
                  </Typography>
                </Box>
              </ListItemButton>
            ))}
          </List>
        </Paper>
      </Popper>
    </Box>
  );
}
