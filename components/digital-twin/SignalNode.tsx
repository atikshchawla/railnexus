import type { SignalAspect, Vec2 } from "@/lib/services/digital-twin/types";

export const ASPECT_COLORS: Record<SignalAspect, string> = {
  RED: "#dc2626",
  YELLOW: "#d97706",
  DOUBLE_YELLOW: "#f59e0b",
  GREEN: "#16a34a",
};

/**
 * Draw a colour-light railway signal as a rectangular head on a mast,
 * with vertically stacked lenses (red top, yellow middle, green bottom).
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

  // mast perpendicular to the track, pointing away
  const mastH = 20;
  ctx.strokeStyle = failed ? "#64748b" : "#6b7280";
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, -mastH);
  ctx.stroke();

  // base bracket
  ctx.strokeStyle = failed ? "#64748b" : "#6b7280";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-3, 0);
  ctx.lineTo(3, 0);
  ctx.stroke();

  // signal head housing (rectangular, vertical)
  const headW = 10;
  const headH = 22;
  const headX = -headW / 2;
  const headY = -mastH - headH;

  // housing shadow
  ctx.fillStyle = "rgba(0,0,0,0.3)";
  ctx.fillRect(headX + 1, headY + 1, headW, headH);

  // housing body (dark grey/black)
  ctx.fillStyle = "#1e2330";
  ctx.fillRect(headX, headY, headW, headH);
  ctx.strokeStyle = "#374151";
  ctx.lineWidth = 1;
  ctx.strokeRect(headX, headY, headW, headH);

  // three lenses stacked vertically
  const lensR = 3;
  const lensGap = 6;
  const lensCx = 0;
  const lensTopY = headY + 5;
  const lensMidY = lensTopY + lensGap;
  const lensBotY = lensMidY + lensGap;

  const lenses = [
    { y: lensTopY, color: ASPECT_COLORS.RED, active: aspect === "RED" },
    { y: lensMidY, color: ASPECT_COLORS.YELLOW, active: aspect === "YELLOW" || aspect === "DOUBLE_YELLOW" },
    { y: lensBotY, color: ASPECT_COLORS.GREEN, active: aspect === "GREEN" || aspect === "DOUBLE_YELLOW" },
  ];

  for (const lens of lenses) {
    // lens rim
    ctx.beginPath();
    ctx.arc(lensCx, lens.y, lensR + 0.5, 0, Math.PI * 2);
    ctx.fillStyle = "#0f172a";
    ctx.fill();

    // lens glass
    ctx.beginPath();
    ctx.arc(lensCx, lens.y, lensR, 0, Math.PI * 2);
    if (failed) {
      ctx.fillStyle = "#1e2330";
    } else if (lens.active) {
      ctx.fillStyle = lens.color;
      // glow effect
      ctx.shadowColor = lens.color;
      ctx.shadowBlur = 6;
    } else {
      ctx.fillStyle = "#1a1f2e";
    }
    ctx.fill();
    ctx.shadowBlur = 0;

    // lens highlight
    if (lens.active && !failed) {
      ctx.beginPath();
      ctx.arc(lensCx - 0.8, lens.y - 0.8, lensR * 0.4, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255,255,255,0.25)";
      ctx.fill();
    }
  }

  // visor/hood over each lens
  for (const lens of lenses) {
    ctx.strokeStyle = "#374151";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(lensCx - lensR - 1, lens.y - lensR - 1);
    ctx.lineTo(lensCx + lensR + 1, lens.y - lensR - 1);
    ctx.stroke();
  }

  if (failed) {
    // red X badge over the signal head
    ctx.strokeStyle = "#dc2626";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(headX - 2, headY - 2);
    ctx.lineTo(headX + headW + 2, headY + headH + 2);
    ctx.moveTo(headX + headW + 2, headY - 2);
    ctx.lineTo(headX - 2, headY + headH + 2);
    ctx.stroke();
  }

  if (selected) {
    ctx.beginPath();
    ctx.roundRect(headX - 5, headY - 4, headW + 10, headH + 8, 4);
    ctx.setLineDash([3, 3]);
    ctx.strokeStyle = "#0284c7";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.setLineDash([]);
  }

  ctx.restore();
}
