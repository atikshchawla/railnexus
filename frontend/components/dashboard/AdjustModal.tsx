"use client";

import { useState } from "react";
import { X, Clock, Train, AlertTriangle } from "lucide-react";
import type { DisplayItem } from "@/app/(dashboard)/approvals/page";

interface AdjustModalProps {
  displayItem: DisplayItem;
  onClose: () => void;
}

export function AdjustModal({ displayItem, onClose }: AdjustModalProps) {
  // Extract initial start time from the block
  const originalStartMinute = displayItem.isGrouped 
    ? (displayItem.optBlock.scheduled_start_minute || 0)
    : (new Date(displayItem.item.scheduledWindow.start).getHours() * 60 + new Date(displayItem.item.scheduledWindow.start).getMinutes());
    
  const originalEndMinute = displayItem.isGrouped 
    ? (displayItem.optBlock.scheduled_end_minute || 0)
    : (new Date(displayItem.item.scheduledWindow.end).getHours() * 60 + new Date(displayItem.item.scheduledWindow.end).getMinutes());

  const duration = originalEndMinute - originalStartMinute;

  const [startMinute, setStartMinute] = useState(originalStartMinute);

  const startHourStr = String(Math.floor(startMinute / 60)).padStart(2, '0');
  const startMinStr = String(startMinute % 60).padStart(2, '0');
  const [timeInput, setTimeInput] = useState(`${startHourStr}:${startMinStr}`);

  // Base predicted impacts
  const baseTrainImpact = displayItem.isGrouped 
    ? displayItem.optBlock.train_impact_minutes 
    : (displayItem.item.mlPrediction?.totalDelayMinutes || 45);

  // Calculate dynamic impact based on time shift
  // (In a real system, shifting the time would call the backend optimizer again. Here we simulate.)
  const shiftDiff = Math.abs(startMinute - originalStartMinute);
  const dynamicTrainImpact = baseTrainImpact + (shiftDiff * 0.5); 
  const affectedTrainsCount = displayItem.isGrouped 
    ? Math.max(3, Math.floor(dynamicTrainImpact / 15)) 
    : (displayItem.item.mlPrediction?.trainsAffected || 2);

  const endMinute = startMinute + duration;
  
  const formatTime = (totalMin: number) => {
    const h = Math.floor(totalMin / 60) % 24;
    const m = totalMin % 60;
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
  };

  const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTimeInput(e.target.value);
    const [h, m] = e.target.value.split(':').map(Number);
    if (!isNaN(h) && !isNaN(m)) {
      setStartMinute(h * 60 + m);
    }
  };

  const title = displayItem.isGrouped ? "Adjust Shadow Block" : "Adjust Individual Block";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-surface rounded-lg shadow-xl w-full max-w-3xl overflow-hidden border border-border-default flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-default bg-surface-sunken">
          <h2 className="text-lg font-semibold text-text-primary">{title}</h2>
          <button onClick={onClose} className="text-text-secondary hover:text-text-primary transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Metadata Section */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <p className="text-[12px] text-text-secondary uppercase tracking-wider font-semibold">Affected Requests</p>
              <p className="text-[14px] text-text-primary">
                {displayItem.isGrouped ? displayItem.items.map(i => i.id).join(", ") : displayItem.item.id}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-[12px] text-text-secondary uppercase tracking-wider font-semibold">Total Duration</p>
              <p className="text-[14px] text-text-primary flex items-center gap-1.5">
                <Clock size={15} className="text-text-secondary" /> {Math.round(duration)} minutes
              </p>
            </div>
          </div>

          {/* Time Slider & Impact Section */}
          <div className="bg-surface-sunken border border-border-default rounded p-5 space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-text-primary text-[14px]">Simulation Adjustments</h3>
              {shiftDiff > 0 && (
                <span className="text-[12px] text-warning flex items-center gap-1.5">
                  <AlertTriangle size={14} /> Deviation from ML optimum
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-[12px] text-text-secondary mb-1.5">New Start Time</label>
                <input 
                  type="time" 
                  value={timeInput}
                  onChange={handleTimeChange}
                  className="w-full bg-surface border border-border-default rounded px-3 py-2 text-text-primary text-[14px]"
                />
                <p className="text-[12px] text-text-secondary mt-1.5">
                  Ends at: <span className="font-medium text-text-primary">{formatTime(endMinute)}</span>
                </p>
              </div>
              
              <div className="bg-surface border border-border-default rounded p-4 flex flex-col justify-center">
                <p className="text-[12px] text-text-secondary mb-1">Predicted Train Impacts</p>
                <div className="flex items-end gap-3">
                  <div className="text-2xl font-semibold text-critical">
                    {Math.round(dynamicTrainImpact)}<span className="text-[14px] text-text-secondary font-normal ml-1">min</span>
                  </div>
                  <div className="text-[13px] text-text-secondary mb-1 flex items-center gap-1">
                    <Train size={14} /> {affectedTrainsCount} trains affected
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Interactive Timeline Mock */}
          <div className="space-y-3">
            <h3 className="font-semibold text-text-primary text-[14px]">Timeline View</h3>
            <div className="border border-border-default rounded bg-surface overflow-x-auto relative h-[150px]">
              {/* Timeline Grid Background */}
              <div className="absolute inset-0" style={{ backgroundSize: '100px 100%', backgroundImage: 'linear-gradient(to right, var(--color-border-default) 1px, transparent 1px)' }} />
              
              <div className="relative w-[1440px] h-full" style={{ left: `-${Math.max(0, startMinute - 100)}px` }}>
                
                {/* Adjacent Train Paths (Mocked based on dynamic impact) */}
                <div className="absolute top-[30px] h-[4px] bg-brand/40 rounded" style={{ left: `${startMinute - 50}px`, width: '120px' }} title="Train 1204" />
                <div className="absolute top-[50px] h-[4px] bg-brand/40 rounded" style={{ left: `${endMinute - 20}px`, width: '150px' }} title="Train 8492" />
                {shiftDiff > 30 && (
                  <div className="absolute top-[70px] h-[4px] bg-critical/60 rounded animate-pulse" style={{ left: `${startMinute + 10}px`, width: '90px' }} title="Conflict Train" />
                )}

                {/* The Dragged Block */}
                <div 
                  className="absolute top-[20px] bottom-[20px] bg-warning/20 border-x-2 border-warning shadow-[0_0_15px_rgba(var(--color-warning-rgb),0.1)] flex items-center justify-center transition-all duration-300"
                  style={{ left: `${startMinute}px`, width: `${duration}px` }}
                >
                  <span className="text-[11px] font-bold text-warning uppercase whitespace-nowrap overflow-hidden px-2">
                    {displayItem.isGrouped ? "Shadow Block" : "Block Window"}
                  </span>
                </div>
              </div>
            </div>
            <p className="text-[11px] text-text-secondary text-center">
              The timeline shows the relative positioning of the block window (yellow) against scheduled train movements.
            </p>
          </div>
          
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border-default bg-surface-sunken flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-[13px] font-medium text-text-primary border border-border-default hover:bg-surface transition-colors bg-transparent">
            Cancel
          </button>
          <button onClick={onClose} className="px-4 py-2 text-[13px] font-medium text-white bg-brand hover:bg-brand-hover transition-colors">
            Save Adjustment
          </button>
        </div>
      </div>
    </div>
  );
}
