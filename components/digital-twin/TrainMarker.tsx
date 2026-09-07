import type { Train, Vec2 } from "@/lib/services/digital-twin/types";

export const TRAIN_COLORS: Record<Train["kind"], string> = {
  PASSENGER: "#0d9488",
  EXPRESS: "#7c3aed",
  FREIGHT: "#ea580c",
};

const BODY_LENGTH = 34;
const BODY_WIDTH = 16;

/** Draw a train capsule centred at `position`, oriented along travel direction. */
export function drawTrainMarker(
  ctx: CanvasRenderingContext2D,
  position: Vec2,
  angle: number,
  train: Train,
  selected: boolean,
  diverted = false
): void {
  ctx.save();
  ctx.translate(position.x, position.y);
  if (train.direction === -1) ctx.rotate(angle + Math.PI);
  else ctx.rotate(angle);

  const hl = BODY_LENGTH / 2;
  const hw = BODY_WIDTH / 2;

  // drop shadow
  ctx.beginPath();
  ctx.roundRect(-hl, -hw, BODY_LENGTH, BODY_WIDTH, 7);
  ctx.shadowColor = "rgba(0,0,0,0.5)";
  ctx.shadowBlur = 8;
  ctx.fillStyle = "rgba(0,0,0,0.3)";
  ctx.fill();
  ctx.shadowBlur = 0;

  // body
  ctx.beginPath();
  ctx.roundRect(-hl, -hw, BODY_LENGTH, BODY_WIDTH, 7);
  ctx.fillStyle = TRAIN_COLORS[train.kind];
  ctx.fill();
  ctx.strokeStyle = "#1a1d2e";
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // windshield stripe
  ctx.fillStyle = "rgba(255,255,255,0.15)";
  ctx.fillRect(-hl + 7, -1.75, BODY_LENGTH - 18, 3.5);

  // direction chevron
  ctx.beginPath();
  ctx.moveTo(hl + 7, 0);
  ctx.lineTo(hl - 1, -5.5);
  ctx.lineTo(hl - 1, 5.5);
  ctx.closePath();
  ctx.fillStyle = TRAIN_COLORS[train.kind];
  ctx.fill();
  ctx.strokeStyle = "#1a1d2e";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // halted badge
  if (train.status === "HALTED") {
    ctx.beginPath();
    ctx.arc(hl - 4, -hw - 2, 4, 0, Math.PI * 2);
    ctx.fillStyle = "#dc2626";
    ctx.fill();
    ctx.strokeStyle = "#1a1d2e";
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  if (selected) {
    ctx.beginPath();
    ctx.roundRect(-hl - 6, -hw - 6, BODY_LENGTH + 12, BODY_WIDTH + 12, 9);
    ctx.setLineDash([4, 3]);
    ctx.strokeStyle = "#0284c7";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // label with halo
  ctx.rotate(train.direction === -1 ? -(angle + Math.PI) : -angle);
  ctx.font = "bold 11px ui-sans-serif, system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.lineWidth = 3.5;
  ctx.strokeStyle = "rgba(26,29,46,0.9)";
  const suffix =
    train.status === "HALTED" ? " (halted)" : diverted ? " · diverted" : "";
  const label = `${train.name}${suffix}`;
  ctx.strokeText(label, 0, hw + 15);
  ctx.fillStyle = train.status === "HALTED" ? "#fca5a5" : diverted ? "#fbbf24" : "#e8e8ed";
  ctx.fillText(label, 0, hw + 15);

  ctx.restore();
}
