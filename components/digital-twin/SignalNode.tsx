import type { SignalAspect, Vec2 } from "@/lib/services/digital-twin/types";

export const ASPECT_COLORS: Record<SignalAspect, string> = {
  RED: "#dc2626",
  YELLOW: "#d97706",
  DOUBLE_YELLOW: "#f59e0b",
  GREEN: "#16a34a",
};

/**
 * Draw a colour-light signal as an aspect dot on a short mast,
 * metro-map style: small, high-contrast, readable on light background.
 */
export function drawSignalNode(
  ctx: CanvasRenderingContext2D,
  position: Vec2,
  angle: number,
  aspect: SignalAspect,
  selected: boolean,
  failed = false
): void {
  ctx.save();
  ctx.translate(position.x, position.y);
  ctx.rotate(angle);

  const heads = failed ? 1 : aspect === "DOUBLE_YELLOW" ? 2 : 1;

  // mast perpendicular to the line
  ctx.strokeStyle = failed ? "#94a3b8" : "#475569";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, -13);
  ctx.stroke();

  for (let i = 0; i < heads; i++) {
    ctx.beginPath();
    ctx.arc(-5 + i * 10, -16, 4.5, 0, Math.PI * 2);
    ctx.fillStyle = failed ? "#334155" : ASPECT_COLORS[aspect];
    ctx.fill();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1.75;
    ctx.stroke();
  }

  if (failed) {
    // red X badge over a dark signal
    ctx.strokeStyle = "#dc2626";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-8, -24);
    ctx.lineTo(-2, -18);
    ctx.moveTo(-2, -24);
    ctx.lineTo(-8, -18);
    ctx.stroke();
  }

  if (selected) {
    ctx.beginPath();
    ctx.arc(0, -13, 12, 0, Math.PI * 2);
    ctx.setLineDash([3, 3]);
    ctx.strokeStyle = "#0284c7";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.setLineDash([]);
  }

  ctx.restore();
}
