import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Tooltip from "@mui/material/Tooltip";
import { useTranslation } from "react-i18next";
import { Card } from "../../../components/Card";
import { HAIRLINE } from "../../../theme/tokens";

// Pick a "nice" axis max + a small set of round tick values, so the y-axis reads
// cleanly (e.g. max 7 → ticks 0,2,4,6,8). Falls back to 0/1 when there's no data.
function niceScale(maxValue: number): { max: number; ticks: number[] } {
  if (maxValue <= 0) return { max: 1, ticks: [0, 1] };
  const targetTicks = 4;
  const rough = maxValue / targetTicks;
  const mag = Math.pow(10, Math.floor(Math.log10(rough)));
  const step = [1, 2, 5, 10].map((m) => m * mag).find((s) => s >= rough) ?? mag * 10;
  const max = Math.ceil(maxValue / step) * step;
  const ticks: number[] = [];
  for (let v = 0; v <= max; v += step) ticks.push(v);
  return { max, ticks };
}

// Work-orders bar chart with a y-axis, gridlines, per-bar value labels, and a
// hover tooltip.
export function WeeklyChart({ chart }: { chart: { week: string; value: number }[] }) {
  const { t } = useTranslation();
  const dataMax = Math.max(0, ...chart.map((c) => c.value));
  const { max, ticks } = niceScale(dataMax);
  const PLOT_H = 220;

  return (
    <Card sx={{ width: "100%", minWidth: 0 }}>
      <Typography variant="h6" sx={{ fontWeight: 700, mb: 4 }}>
        {t("reports.weeklyChart.title")}
      </Typography>

      <Box sx={{ display: "flex", gap: 1 }}>
        {/* Y-axis tick labels */}
        <Box
          sx={{
            position: "relative",
            width: 26,
            height: PLOT_H,
            flexShrink: 0,
          }}
        >
          {ticks.map((v) => (
            <Typography
              key={v}
              variant="caption"
              color="text.secondary"
              sx={{
                position: "absolute",
                right: 0,
                bottom: `${(v / max) * 100}%`,
                transform: "translateY(50%)",
                fontVariantNumeric: "tabular-nums",
                lineHeight: 1,
              }}
            >
              {v}
            </Typography>
          ))}
        </Box>

        {/* Plot area: gridlines behind, bars in front */}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box sx={{ position: "relative", height: PLOT_H }}>
            {/* Horizontal gridlines at each tick */}
            {ticks.map((v) => (
              <Box
                key={v}
                sx={{
                  position: "absolute",
                  left: 0,
                  right: 0,
                  bottom: `${(v / max) * 100}%`,
                  borderTop: `1px solid ${HAIRLINE}`,
                }}
              />
            ))}

            {/* Bars */}
            <Box
              sx={{
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "flex-end",
                justifyContent: "space-around",
                gap: 2,
              }}
            >
              {chart.map((c) => (
                <Box
                  key={c.week}
                  sx={{
                    flex: 1,
                    height: "100%",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "flex-end",
                  }}
                >
                  {/* value label on top of the bar */}
                  {c.value > 0 ? (
                    <Typography
                      variant="caption"
                      sx={{ fontWeight: 600, mb: 0.75, fontVariantNumeric: "tabular-nums", lineHeight: 1 }}
                    >
                      {c.value}
                    </Typography>
                  ) : null}
                  <Tooltip
                    title={t("reports.weeklyChart.tooltip", { week: c.week, count: c.value })}
                    arrow
                    placement="top"
                  >
                    <Box
                      sx={{
                        width: "62%",
                        maxWidth: 48,
                        height: `${(c.value / max) * 100}%`,
                        minHeight: c.value > 0 ? 4 : 0,
                        bgcolor: "primary.main",
                        borderRadius: "6px 6px 0 0",
                        cursor: "default",
                        transition: "opacity .15s",
                        "&:hover": { opacity: 0.85 },
                      }}
                    />
                  </Tooltip>
                </Box>
              ))}
            </Box>
          </Box>

          {/* X-axis labels */}
          <Box sx={{ display: "flex", justifyContent: "space-around", gap: 2, mt: 0.75 }}>
            {chart.map((c) => (
              <Typography
                key={c.week}
                variant="caption"
                color="text.secondary"
                sx={{ flex: 1, textAlign: "center" }}
                noWrap
              >
                {c.week}
              </Typography>
            ))}
          </Box>
        </Box>
      </Box>
    </Card>
  );
}
