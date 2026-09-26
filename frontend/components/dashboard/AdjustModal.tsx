"use client";

import { useState } from "react";
import { X, Clock, Train, AlertTriangle, Unlink, Info } from "lucide-react";
import type { BlockRecord } from "@/lib/types";
import type { OptimizedBlockResponse, OperatorOverride } from "@/lib/api";
import { DepartmentBadge } from "@/components/shared";

export type DisplayItem =
  | { isGrouped: false; item: BlockRecord; proposalId?: string }
  | {
      isGrouped: true;
      id: string;
      proposalId?: string;
      optBlock: OptimizedBlockResponse;
      items: BlockRecord[];
      override?: OperatorOverride;
    };

interface AdjustModalProps {
  displayItem: DisplayItem;
  onClose: () => void;
  onSave: (groupId: string, override: OperatorOverride) => Promise<void>;
}

export function AdjustModal({ displayItem, onClose, onSave }: AdjustModalProps) {
  const isGrouped = displayItem.isGrouped;

  const originalStartMinute = isGrouped
    ? (displayItem.optBlock.scheduled_start_minute ?? 0)
    : new Date(displayItem.item.scheduledWindow.start).getHours() * 60 +
      new Date(displayItem.item.scheduledWindow.start).getMinutes();

  const originalEndMinute = isGrouped
    ? (displayItem.optBlock.scheduled_end_minute ?? 0)
    : new Date(displayItem.item.scheduledWindow.end).getHours() * 60 +
      new Date(displayItem.item.scheduledWindow.end).getMinutes();

  const originalDuration = originalEndMinute - originalStartMinute;

  const pad = (n: number) => String(n).padStart(2, "0");
  const toTimeString = (minutes: number) =>
    `${pad(Math.floor(minutes / 60) % 24)}:${pad(minutes % 60)}`;

  const [startMinute, setStartMinute] = useState(originalStartMinute);
  const [endMinute, setEndMinute] = useState(originalEndMinute);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const deviation = startMinute - originalStartMinute; // can be negative
  const newDuration = endMinute - startMinute;

  // Simulated impact: +0.5 min train delay per minute of time shift
  const baseImpact = isGrouped
    ? displayItem.optBlock.train_impact_minutes
    : displayItem.item.mlPrediction?.totalDelayMinutes ?? 30;
  const adjustedImpact = Math.max(0, baseImpact + Math.abs(deviation) * 0.5);

  const handleStartChange = (val: string) => {
    const [h, m] = val.split(":").map(Number);
    if (!isNaN(h) && !isNaN(m)) {
      const newStart = h * 60 + m;
      setStartMinute(newStart);
      // Keep duration constant when moving start
      setEndMinute(newStart + originalDuration);
    }
  };

  const handleEndChange = (val: string) => {
    const [h, m] = val.split(":").map(Number);
    if (!isNaN(h) && !isNaN(m)) setEndMinute(h * 60 + m);
  };

  const handleSave = async () => {
    setSaving(true);
    const id = isGrouped ? displayItem.id : displayItem.item.id;
    const override: OperatorOverride = {
      start_minute: startMinute,
      end_minute: endMinute,
      notes: notes.trim() || undefined,
    };
    try {
      await onSave(id, override);
    } finally {
      setSaving(false);
    }
  };

  const title = isGrouped ? `Adjust Shadow Block — ${displayItem.id}` : `Adjust Block — ${displayItem.item.id}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-surface w-full max-w-2xl overflow-hidden border border-border-default flex flex-col max-h-[90vh] shadow-xl">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border-default bg-surface-sunken shrink-0">
          <h2 className="text-[15px] font-semibold text-text-primary">{title}</h2>
          <button onClick={onClose} className="text-text-secondary hover:text-text-primary transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">

          {/* Constituent requests (shadow blocks only) */}
          {isGrouped && (
            <div>
              <p className="text-[11px] uppercase tracking-wide font-semibold text-text-secondary mb-2">
                Constituent Requests ({displayItem.items.length})
              </p>
              <div className="border border-border-default divide-y divide-border-default">
                {displayItem.items.map((item) => (
                  <div key={item.id} className="flex items-center gap-3 px-3 py-2 bg-surface text-[12px]">
                    <DepartmentBadge dept={item.department} />
                    <span className="font-mono font-medium text-text-primary">{item.id}</span>
                    <span className="text-text-secondary truncate flex-1">{item.description}</span>
                    <span className="text-text-secondary whitespace-nowrap text-[11px]">
                      Km {item.location.kmStart} ({item.location.line})
                    </span>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-text-secondary mt-1.5 flex items-center gap-1">
                <Info size={11} />
                These requests share a single possession window. Adjusting the time shifts all of
                them together. Use &quot;Dissolve&quot; to approve individually.
              </p>
            </div>
          )}

          {/* Time adjustment */}
          <div className="border border-border-default p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-[13px] font-semibold text-text-primary flex items-center gap-2">
                <Clock size={14} className="text-text-secondary" /> Time Window
              </h3>
              {deviation !== 0 && (
                <span className="text-[11px] text-warning flex items-center gap-1">
                  <AlertTriangle size={12} />
                  {Math.abs(deviation)} min {deviation > 0 ? "later" : "earlier"} than ML optimum
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] text-text-secondary mb-1">Start time</label>
                <input
                  type="time"
                  value={toTimeString(startMinute)}
                  onChange={(e) => handleStartChange(e.target.value)}
                  className="w-full bg-surface border border-border-default px-3 py-2 text-text-primary text-[13px] focus:border-brand focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] text-text-secondary mb-1">End time</label>
                <input
                  type="time"
                  value={toTimeString(endMinute)}
                  onChange={(e) => handleEndChange(e.target.value)}
                  className="w-full bg-surface border border-border-default px-3 py-2 text-text-primary text-[13px] focus:border-brand focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-px bg-border-default border border-border-default text-[12px]">
              <div className="bg-surface px-3 py-2">
                <p className="text-text-secondary text-[10px] uppercase mb-0.5">Duration</p>
                <p className="font-semibold">{Math.max(0, newDuration)} min</p>
              </div>
              <div className="bg-surface px-3 py-2">
                <p className="text-text-secondary text-[10px] uppercase mb-0.5">Original</p>
                <p className="font-semibold">{originalDuration} min</p>
              </div>
              <div className="bg-surface px-3 py-2">
                <p className="text-text-secondary text-[10px] uppercase mb-0.5">Est. train impact</p>
                <p className={`font-semibold ${adjustedImpact > baseImpact ? "text-warning" : ""}`}>
                  {Math.round(adjustedImpact)} min
                  {adjustedImpact > baseImpact && (
                    <span className="text-[10px] text-warning ml-1">
                      (+{Math.round(adjustedImpact - baseImpact)})
                    </span>
                  )}
                </p>
              </div>
            </div>
          </div>

          {/* Operator notes */}
          <div>
            <label className="block text-[11px] text-text-secondary mb-1.5 uppercase tracking-wide font-semibold">
              Reason / Notes (optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="e.g. Shifted to avoid peak passenger window, coordinated with ENGG team…"
              className="w-full bg-surface border border-border-default px-3 py-2 text-[12px] text-text-primary resize-none focus:border-brand focus:outline-none"
            />
          </div>

        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-border-default bg-surface-sunken flex items-center justify-between shrink-0">
          <div className="flex items-center gap-1.5 text-[11px] text-text-secondary">
            <Train size={12} /> Adjustment will be saved to the DB and reflected across all pages
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 text-[12px] font-medium text-text-primary border border-border-default hover:bg-surface-sunken transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || newDuration <= 0}
              className="px-4 py-1.5 text-[12px] font-medium text-white bg-brand hover:bg-brand-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? "Saving…" : "Save adjustment"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
