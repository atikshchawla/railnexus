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
    <div className="flex flex-col bg-surface">
      <div className="px-4 py-2.5 border-b border-border-default bg-surface-sunken flex justify-between items-center">
        <h2 className="text-[13px] font-semibold text-text-primary m-0">Raise a request</h2>
        <span className="text-[10px] font-semibold tracking-wider text-text-secondary uppercase">ABP Input</span>
      </div>
      
      <form onSubmit={handleSubmit} className="p-4 flex flex-col gap-3.5">
        <label className="flex flex-col gap-1.5 text-[12px] font-medium text-text-primary">
          Department
          <select 
            value={department} 
            onChange={(e) => setDepartment(e.target.value)}
            className="bg-surface border border-border-default text-text-primary px-3 py-2 text-[13px] rounded-sm focus:border-brand focus:ring-1 focus:ring-brand focus:outline-none transition-shadow"
          >
            <option value="TDMS">TDMS</option>
            <option value="TMS">TMS</option>
            <option value="SMMS">SMMS</option>
          </select>
        </label>
        
        <label className="flex flex-col gap-1.5 text-[12px] font-medium text-text-primary">
          Type
          <select 
            value={type} 
            onChange={(e) => setType(e.target.value)}
            className="bg-surface border border-border-default text-text-primary px-3 py-2 text-[13px] rounded-sm focus:border-brand focus:ring-1 focus:ring-brand focus:outline-none transition-shadow"
          >
            <option value="section_entry">Section entry</option>
            <option value="running_status">Running status</option>
            <option value="maintenance_block">Maintenance block</option>
          </select>
        </label>
        
        <label className="flex flex-col gap-1.5 text-[12px] font-medium text-text-primary">
          Train
          <select 
            value={trainId} 
            onChange={(e) => setTrainId(e.target.value)}
            className="bg-surface border border-border-default text-text-primary px-3 py-2 text-[13px] rounded-sm focus:border-brand focus:ring-1 focus:ring-brand focus:outline-none transition-shadow num"
          >
            <option value="">No train</option>
            {trains.map(t => (
              <option key={t.id} value={t.id}>{t.id} &middot; {t.name}</option>
            ))}
          </select>
        </label>
        
        <label className="flex flex-col gap-1.5 text-[12px] font-medium text-text-primary">
          Section
          <select 
            value={sectionId} 
            onChange={(e) => setSectionId(e.target.value)}
            required
            className="bg-surface border border-border-default text-text-primary px-3 py-2 text-[13px] rounded-sm focus:border-brand focus:ring-1 focus:ring-brand focus:outline-none transition-shadow"
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
          className="mt-1 bg-brand hover:bg-brand-hover text-white font-medium text-[13px] py-2 px-4 rounded-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2"
        >
          Submit request <span className="text-[14px]">↗</span>
        </button>
        
        {statusMsg && (
          <p className="text-[12px] text-success font-medium mt-1 min-h-[18px] text-center">{statusMsg}</p>
        )}
      </form>
    </div>
  );
}
