"use client";

import { useState, useEffect, useCallback } from "react";
import { Minus, Plus, Sun, ZapOff } from "lucide-react";

type FontScale = "small" | "normal" | "large";

const FONT_SCALE_KEY = "railnexus-font-scale";
const CONTRAST_KEY = "railnexus-high-contrast";

/**
 * GIGW 3.0 mandatory accessibility toolbar.
 * Provides: skip-nav link, font size controls (A- A A+), high-contrast toggle.
 * Persists user preferences to localStorage.
 */
export default function AccessibilityToolbar() {
  const [fontScale, setFontScale] = useState<FontScale>("normal");
  const [highContrast, setHighContrast] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Hydrate from localStorage on mount
  useEffect(() => {
    setMounted(true);
    const savedScale = localStorage.getItem(FONT_SCALE_KEY) as FontScale | null;
    const savedContrast = localStorage.getItem(CONTRAST_KEY);

    if (savedScale && ["small", "normal", "large"].includes(savedScale)) {
      setFontScale(savedScale);
      document.documentElement.setAttribute("data-font-scale", savedScale);
    }

    if (savedContrast === "true") {
      setHighContrast(true);
      document.documentElement.setAttribute("data-contrast", "high");
    }
  }, []);

  const updateFontScale = useCallback((scale: FontScale) => {
    setFontScale(scale);
    document.documentElement.setAttribute("data-font-scale", scale);
    localStorage.setItem(FONT_SCALE_KEY, scale);
  }, []);

  const toggleContrast = useCallback(() => {
    const next = !highContrast;
    setHighContrast(next);
    if (next) {
      document.documentElement.setAttribute("data-contrast", "high");
    } else {
      document.documentElement.removeAttribute("data-contrast");
    }
    localStorage.setItem(CONTRAST_KEY, String(next));
  }, [highContrast]);

  const scaleDown = () => {
    if (fontScale === "large") updateFontScale("normal");
    else if (fontScale === "normal") updateFontScale("small");
  };

  const scaleUp = () => {
    if (fontScale === "small") updateFontScale("normal");
    else if (fontScale === "normal") updateFontScale("large");
  };

  // Avoid hydration mismatch — render placeholder until mounted
  if (!mounted) {
    return <div className="h-7 shrink-0 bg-surface-sunken border-b border-border-default" />;
  }

  return (
    <div className="h-7 shrink-0 flex items-center justify-end gap-2 px-4 bg-surface-sunken border-b border-border-default text-[11px] text-text-secondary">
      {/* Skip navigation — GIGW 3.0 mandatory */}
      <a href="#main-content" className="skip-nav">
        Skip to main content
      </a>

      {/* Font size controls */}
      <div className="flex items-center gap-1">
        <span className="mr-1">Text size:</span>
        <button
          onClick={scaleDown}
          disabled={fontScale === "small"}
          aria-label="Decrease text size"
          className="touch-target p-1 rounded hover:bg-surface disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          style={{ minWidth: "28px", minHeight: "24px" }}
        >
          <Minus size={12} strokeWidth={2} />
        </button>
        <span className="font-medium w-5 text-center">
          {fontScale === "small" ? "A-" : fontScale === "large" ? "A+" : "A"}
        </span>
        <button
          onClick={scaleUp}
          disabled={fontScale === "large"}
          aria-label="Increase text size"
          className="touch-target p-1 rounded hover:bg-surface disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          style={{ minWidth: "28px", minHeight: "24px" }}
        >
          <Plus size={12} strokeWidth={2} />
        </button>
      </div>

      {/* Separator */}
      <div className="w-px h-3 bg-border-default" />

      {/* High-contrast toggle */}
      <button
        onClick={toggleContrast}
        aria-label={highContrast ? "Disable high contrast mode" : "Enable high contrast mode"}
        aria-pressed={highContrast}
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
          highContrast
            ? "bg-brand text-white"
            : "hover:bg-surface text-text-secondary"
        }`}
      >
        {highContrast ? (
          <ZapOff size={11} strokeWidth={2} />
        ) : (
          <Sun size={11} strokeWidth={2} />
        )}
        {highContrast ? "Standard" : "High contrast"}
      </button>
    </div>
  );
}
