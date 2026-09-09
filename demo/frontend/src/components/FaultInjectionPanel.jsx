import React, { useState } from 'react';
import { AlertOctagon } from 'lucide-react';

export default function FaultInjectionPanel({ network, injectFault, clearFault }) {
  const [sectionId, setSectionId] = useState('');
  const [faultDesc, setFaultDesc] = useState('Physical track unavailable');

  const sections = network?.sections || [];

  return (
    <div className="p-4 w-full">
      <div className="flex items-center gap-3 mb-4">
        <div className="bg-[#FCE8E8] p-2 rounded-sm text-critical">
          <AlertOctagon className="w-5 h-5" />
        </div>
        <div>
          <span className="text-[10px] font-semibold tracking-wider text-critical uppercase">Fault Injection</span>
          <h2 className="text-[14px] font-semibold text-text-primary m-0">Physical availability hook</h2>
        </div>
      </div>
      
      <div className="flex flex-wrap gap-4 items-end">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-[12px] font-medium text-text-primary mb-1.5">Section</label>
          <select 
            value={sectionId} 
            onChange={(e) => setSectionId(e.target.value)}
            className="w-full bg-surface border border-border-default text-text-primary px-3 py-2 text-[13px] rounded-sm focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand transition-shadow"
          >
            <option value="" disabled>Select section...</option>
            {sections.map(s => (
              <option key={s.id} value={s.id}>{s.id}</option>
            ))}
          </select>
        </div>
        
        <div className="flex-[2] min-w-[250px]">
          <label className="block text-[12px] font-medium text-text-primary mb-1.5">Fault Description</label>
          <input 
            type="text" 
            value={faultDesc} 
            onChange={(e) => setFaultDesc(e.target.value)}
            className="w-full bg-surface border border-border-default text-text-primary px-3 py-2 text-[13px] rounded-sm focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand transition-shadow"
          />
        </div>
        
        <div className="flex gap-2">
          <button 
            onClick={() => sectionId && injectFault(sectionId, faultDesc)}
            disabled={!sectionId}
            className="bg-critical hover:bg-[#8A1D16] text-white border border-transparent px-4 py-2.5 text-[13px] font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap rounded-sm"
          >
            Trigger fault
          </button>
          
          <button 
            onClick={() => sectionId && clearFault(sectionId)}
            disabled={!sectionId}
            className="bg-surface hover:bg-surface-sunken text-text-primary border border-border-default px-4 py-2.5 text-[13px] font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap rounded-sm"
          >
            Clear fault
          </button>
        </div>
      </div>
    </div>
  );
}
