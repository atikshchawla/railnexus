"use client";

import { Plus } from "lucide-react";

export default function BlockRequestForm() {
  return (
    <div className="bg-surface border border-border-default">
      <div className="px-4 py-2.5 border-b border-border-default flex items-center justify-between">
        <h3 className="text-[15px] font-semibold text-text-primary">
          New block request
        </h3>
      </div>

      <form className="p-4 space-y-3">
        <div className="grid grid-cols-3 gap-3">
          {/* Department */}
          <div>
            <label className="block text-[12px] text-text-secondary mb-1">
              Department
            </label>
            <select className="w-full text-[13px] px-2.5 py-1.5 border border-border-default bg-surface text-text-primary">
              <option>Engg</option>
              <option>TRD</option>
              <option>S&T</option>
            </select>
          </div>

          {/* Priority */}
          <div>
            <label className="block text-[12px] text-text-secondary mb-1">
              Priority
            </label>
            <select className="w-full text-[13px] px-2.5 py-1.5 border border-border-default bg-surface text-text-primary">
              <option>IMR — Immediate repair</option>
              <option>OBS — Observation</option>
              <option>PM — Predictive maintenance</option>
              <option>Routine</option>
            </select>
          </div>

          {/* Section */}
          <div>
            <label className="block text-[12px] text-text-secondary mb-1">
              Section (Km range)
            </label>
            <input
              type="text"
              placeholder="e.g. Km 244–248, UP"
              className="w-full text-[13px] px-2.5 py-1.5 border border-border-default bg-surface text-text-primary placeholder:text-text-secondary/50"
            />
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="block text-[12px] text-text-secondary mb-1">
            Description of work
          </label>
          <textarea
            rows={2}
            placeholder="Describe the maintenance work required..."
            className="w-full text-[13px] px-2.5 py-1.5 border border-border-default bg-surface text-text-primary placeholder:text-text-secondary/50 resize-none"
          />
        </div>

        <div className="grid grid-cols-3 gap-3">
          {/* Requested date */}
          <div>
            <label className="block text-[12px] text-text-secondary mb-1">
              Requested date
            </label>
            <input
              type="date"
              className="w-full text-[13px] px-2.5 py-1.5 border border-border-default bg-surface text-text-primary"
            />
          </div>

          {/* Duration */}
          <div>
            <label className="block text-[12px] text-text-secondary mb-1">
              Estimated duration
            </label>
            <select className="w-full text-[13px] px-2.5 py-1.5 border border-border-default bg-surface text-text-primary">
              <option>30 minutes</option>
              <option>1 hour</option>
              <option>1 hour 30 min</option>
              <option>2 hours</option>
              <option>2 hours 30 min</option>
              <option>3 hours</option>
              <option>4 hours</option>
            </select>
          </div>

          {/* Line */}
          <div>
            <label className="block text-[12px] text-text-secondary mb-1">
              Line
            </label>
            <select className="w-full text-[13px] px-2.5 py-1.5 border border-border-default bg-surface text-text-primary">
              <option>UP line</option>
              <option>DN line</option>
              <option>Both</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2 pt-1">
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[12.5px] font-medium bg-brand text-white hover:bg-brand-hover transition-colors"
          >
            <Plus size={13} strokeWidth={2} />
            Submit request
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[12.5px] font-medium border border-border-default text-text-secondary hover:bg-surface-sunken transition-colors"
          >
            Save as draft
          </button>
        </div>
      </form>
    </div>
  );
}
