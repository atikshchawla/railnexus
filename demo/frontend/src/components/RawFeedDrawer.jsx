import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

export default function RawFeedDrawer({ rawWorld }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="w-full bg-[#101d22] border border-[#26383e] rounded-lg overflow-hidden shadow-[0_16px_35px_rgba(0,0,0,0.14)] mt-4">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex justify-between items-center p-3 bg-[#122026] hover:bg-[#17292e] transition-colors focus:outline-none"
      >
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono tracking-widest text-[#91a1a8] uppercase">Debug</span>
          <h2 className="text-sm font-semibold text-[#e8eef1] m-0">Raw world-state feed</h2>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono text-[#91a1a8]">exact Member B contract</span>
          {isOpen ? <ChevronUp className="w-4 h-4 text-[#91a1a8]" /> : <ChevronDown className="w-4 h-4 text-[#91a1a8]" />}
        </div>
      </button>
      
      {isOpen && (
        <div className="p-4 border-t border-[#26383e] bg-[#0a1519] max-h-[400px] overflow-auto">
          <pre className="m-0 text-[11px] leading-relaxed font-mono text-[#b3d5d0]">
            {rawWorld ? JSON.stringify(rawWorld, null, 2) : 'Waiting for /feed...'}
          </pre>
        </div>
      )}
    </div>
  );
}
