import React, { useState } from 'react';

export default function RaiseRequestForm({ network, world, raiseRequest }) {
  const [department, setDepartment] = useState('TDMS');
  const [type, setType] = useState('section_entry');
  const [trainId, setTrainId] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [statusMsg, setStatusMsg] = useState('');

  const sections = network?.sections || [];
  const trains = world?.trains || [];

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatusMsg('');
    try {
      await raiseRequest(department, type, sectionId, trainId);
      setStatusMsg('Request submitted to ABP.');
      setTimeout(() => setStatusMsg(''), 3000);
    } catch (err) {
      setStatusMsg(`Request failed: ${err.message}`);
    }
  };

  return (
    <div className="bg-[#101d22]/95 border border-[#26383e] rounded-lg shadow-[0_16px_35px_rgba(0,0,0,0.14)] overflow-hidden">
      <div className="p-3 border-b border-[#26383e] bg-[#122026] flex justify-between items-center">
        <h2 className="text-sm font-semibold text-[#e8eef1] m-0">Raise a request</h2>
        <span className="text-[10px] font-mono text-[#91a1a8] uppercase">ABP input</span>
      </div>
      
      <form onSubmit={handleSubmit} className="p-4 flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-[11px] font-mono text-[#91a1a8]">
          Department
          <select 
            value={department} 
            onChange={(e) => setDepartment(e.target.value)}
            className="bg-[#0a1519] border border-[#26383e] text-[#e8eef1] p-2 text-xs rounded-none focus:border-[#55e6a5] focus:outline-none"
          >
            <option value="TDMS">TDMS</option>
            <option value="TMS">TMS</option>
            <option value="SMMS">SMMS</option>
          </select>
        </label>
        
        <label className="flex flex-col gap-1 text-[11px] font-mono text-[#91a1a8]">
          Type
          <select 
            value={type} 
            onChange={(e) => setType(e.target.value)}
            className="bg-[#0a1519] border border-[#26383e] text-[#e8eef1] p-2 text-xs rounded-none focus:border-[#55e6a5] focus:outline-none"
          >
            <option value="section_entry">Section entry</option>
            <option value="running_status">Running status</option>
            <option value="maintenance_block">Maintenance block</option>
          </select>
        </label>
        
        <label className="flex flex-col gap-1 text-[11px] font-mono text-[#91a1a8]">
          Train
          <select 
            value={trainId} 
            onChange={(e) => setTrainId(e.target.value)}
            className="bg-[#0a1519] border border-[#26383e] text-[#e8eef1] p-2 text-xs rounded-none focus:border-[#55e6a5] focus:outline-none"
          >
            <option value="">No train</option>
            {trains.map(t => (
              <option key={t.id} value={t.id}>{t.id} &middot; {t.name}</option>
            ))}
          </select>
        </label>
        
        <label className="flex flex-col gap-1 text-[11px] font-mono text-[#91a1a8]">
          Section
          <select 
            value={sectionId} 
            onChange={(e) => setSectionId(e.target.value)}
            required
            className="bg-[#0a1519] border border-[#26383e] text-[#e8eef1] p-2 text-xs rounded-none focus:border-[#55e6a5] focus:outline-none"
          >
            <option value="" disabled>Select section...</option>
            {sections.map(s => (
              <option key={s.id} value={s.id}>{s.id}</option>
            ))}
          </select>
        </label>
        
        <button 
          type="submit" 
          disabled={!sectionId}
          className="mt-2 bg-[#55e6a5] hover:bg-[#45cc90] text-[#071217] font-bold text-xs p-2 rounded-none transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2"
        >
          Submit request <span className="text-[14px]">↗</span>
        </button>
        
        {statusMsg && (
          <p className="text-[11px] text-[#55e6a5] font-mono mt-1 min-h-[16px]">{statusMsg}</p>
        )}
      </form>
    </div>
  );
}
