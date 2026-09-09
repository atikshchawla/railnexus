import React, { useState } from 'react';
import { AlertOctagon } from 'lucide-react';

export default function FaultInjectionPanel({ network, injectFault, clearFault }) {
  const [sectionId, setSectionId] = useState('');
  const [faultDesc, setFaultDesc] = useState('Physical track unavailable');

  const sections = network?.sections || [];

  return (
    <div className="bg-[#101d22]/95 border border-[#26383e] rounded-lg p-4 shadow-[0_16px_35px_rgba(0,0,0,0.14)] w-full">
      <div className="flex items-center gap-3 mb-4">
        <div className="bg-[#2b1a1c] p-2 rounded text-[#ffaaa4]">
          <AlertOctagon className="w-5 h-5" />
        </div>
        <div>
          <span className="text-[10px] font-mono tracking-widest text-[#ffaaa4] uppercase">Fault Injection</span>
          <h2 className="text-sm font-semibold text-[#e8eef1] m-0">Physical availability hook</h2>
        </div>
      </div>
      
      <div className="flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-[11px] font-mono text-[#91a1a8] mb-1">Section</label>
          <select 
            value={sectionId} 
            onChange={(e) => setSectionId(e.target.value)}
            className="w-full bg-[#0a1519] border border-[#26383e] text-[#e8eef1] p-2 text-xs font-mono rounded-none focus:outline-none focus:border-[#55e6a5]"
          >
            <option value="" disabled>Select section...</option>
            {sections.map(s => (
              <option key={s.id} value={s.id}>{s.id}</option>
            ))}
          </select>
        </div>
        
        <div className="flex-[2] min-w-[250px]">
          <label className="block text-[11px] font-mono text-[#91a1a8] mb-1">Fault Description</label>
          <input 
            type="text" 
            value={faultDesc} 
            onChange={(e) => setFaultDesc(e.target.value)}
            className="w-full bg-[#0a1519] border border-[#26383e] text-[#e8eef1] p-2 text-xs font-mono rounded-none focus:outline-none focus:border-[#55e6a5]"
          />
        </div>
        
        <div className="flex gap-2">
          <button 
            onClick={() => sectionId && injectFault(sectionId, faultDesc)}
            disabled={!sectionId}
            className="bg-[#2b1a1c] hover:bg-[#3d2528] text-[#ffaaa4] border border-[#794340] px-4 py-2 text-xs font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
          >
            Trigger fault
          </button>
          
          <button 
            onClick={() => sectionId && clearFault(sectionId)}
            disabled={!sectionId}
            className="bg-[#19383e] hover:bg-[#255158] text-[#e8eef1] border border-[#3c6265] px-4 py-2 text-xs font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
          >
            Clear fault
          </button>
        </div>
      </div>
    </div>
  );
}
