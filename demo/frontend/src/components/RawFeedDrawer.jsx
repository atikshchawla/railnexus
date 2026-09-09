import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

export default function RawFeedDrawer({ rawWorld }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="w-full bg-surface border-t-0 flex flex-col">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex justify-between items-center px-4 py-2.5 bg-surface hover:bg-surface-sunken transition-colors focus:outline-none border-b border-border-default"
      >
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-semibold tracking-wider text-text-secondary uppercase">Debug</span>
          <h2 className="text-[13px] font-semibold text-text-primary m-0">Raw world-state feed</h2>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-medium text-text-secondary">Exact Member B contract</span>
          {isOpen ? <ChevronUp className="w-4 h-4 text-text-secondary" /> : <ChevronDown className="w-4 h-4 text-text-secondary" />}
        </div>
      </button>
      
      {isOpen && (
        <div className="p-4 bg-canvas max-h-[300px] overflow-auto shadow-inner">
          <pre className="m-0 text-[11px] leading-relaxed font-mono text-text-secondary selection:bg-brand selection:text-white">
            {rawWorld ? JSON.stringify(rawWorld, null, 2) : 'Waiting for /feed...'}
          </pre>
        </div>
      )}
    </div>
  );
}
