"use client";

import { Search } from "lucide-react";

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export default function SearchBar({
  value,
  onChange,
  placeholder = "Search by ID, description, or section...",
}: SearchBarProps) {
  return (
    <div className="relative">
      <Search
        size={14}
        strokeWidth={1.75}
        className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-secondary"
      />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-8 pr-3 py-1.5 text-[13px] border border-border-default bg-surface text-text-primary placeholder:text-text-secondary/50"
      />
    </div>
  );
}
