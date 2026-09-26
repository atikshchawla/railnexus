import React, { useState } from 'react';

const DEPARTMENTS = {
  "ENGG": ["Track Renewal", "Ballast Cleaning", "Bridge Repair", "Track Maintenance"],
  "TRD": ["OHE Maintenance", "Substation Repair", "Tower Car Inspection"],
  "S&T": ["Signal Maintenance", "Point Machine Repair", "Cable Trenching"]
};

export default function OptimizerForm({ network }) {
  const sections = network?.sections || [];

  const generateId = () => `REQ-${Math.floor(Math.random() * 9000) + 1000}`;

  const getMidKm = (sectionId) => {
    const sec = sections.find(s => s.id === sectionId);
    if (!sec || !sec.from || !sec.to) return 0;
    return Math.round((sec.from.km + sec.to.km) / 2);
  };

  const [requests, setRequests] = useState([
    {
      id: generateId(),
      section_id: 'AJJ-SHU',
      department: 'ENGG',
      work_type: 'Track Maintenance',
      location_km: 10,
      predicted_duration_minutes: 120,
    }
  ]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const addRequest = () => {
    const defaultSection = sections[0]?.id || 'AJJ-SHU';
    setRequests([
      ...requests,
      {
        id: generateId(),
        section_id: defaultSection,
        department: 'ENGG',
        work_type: 'Track Maintenance',
        location_km: getMidKm(defaultSection),
        predicted_duration_minutes: 60,
      }
    ]);
  };

  const removeRequest = (index) => {
    setRequests(requests.filter((_, i) => i !== index));
  };

  const updateRequest = (index, field, value) => {
    const newReqs = [...requests];
    newReqs[index][field] = value;
    if (field === 'department') {
      newReqs[index].work_type = DEPARTMENTS[value][0];
    } else if (field === 'section_id') {
      newReqs[index].location_km = getMidKm(value);
    }
    setRequests(newReqs);
  };

  const getKmOptions = (sectionId) => {
    const sec = sections.find(s => s.id === sectionId);
    if (!sec || !sec.from || !sec.to) return [];
    const min = Math.min(sec.from.km, sec.to.km);
    const max = Math.max(sec.from.km, sec.to.km);
    const options = [];
    options.push(min);
    for (let km = Math.ceil(min); km <= Math.floor(max); km++) {
      if (km !== min && km !== max) options.push(km);
    }
    options.push(max);
    return Array.from(new Set(options)).sort((a,b) => a - b);
  };

  const mapDept = (dept) => {
    if (dept === "ENGG") return "TMS";
    if (dept === "S&T" || dept === "SNT") return "SMMS";
    if (dept === "TRD") return "TDMS";
    return dept;
  };

  const submitThroughIntegration = async (req) => {
    const externalDept = mapDept(req.department);
    const description = `${req.department} ${req.work_type} at km ${req.location_km}`;

    // 1. Try Member B (port 8787)
    try {
      const res = await fetch('http://localhost:8787/api/inject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          department: externalDept,
          type: 'maintenance_block',
          sectionId: req.section_id,
          description: description,
        })
      });
      if (res.ok) return await res.json();
    } catch (_) {
      // Member B unreachable, fall through to Mid-Layer or Demo Gateway
    }

    // 2. Try Mid-Layer Gateway (port 9002)
    const reqId = req.id;

    try {
      const res = await fetch('http://localhost:9002/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          request_id: reqId,
          department: externalDept,
          type: 'maintenance_block',
          train_id: null,
          section_id: req.section_id,
          description: description,
          raised_at: new Date().toISOString(),
        })
      });
      if (res.ok) return await res.json();
    } catch (_) {
      // Mid-Layer unreachable, fall through to Demo Gateway
    }

    // 3. Fallback to Demo Gateway directly (port 8000 /api/demo-gateway/requests)
    const res = await fetch('http://localhost:8000/api/demo-gateway/requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        request_id: reqId,
        department: externalDept,
        type: 'maintenance_block',
        train_id: null,
        section_id: req.section_id,
        description: description,
        raised_at: new Date().toISOString(),
      })
    });
    if (!res.ok) {
      throw new Error(`Demo Gateway rejected request: ${await res.text()}`);
    }
    return await res.json();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      for (const req of requests) {
        await submitThroughIntegration(req);
      }
      
      setResult({
        success: true,
        message: "Requests successfully submitted through the Integration Gateway to RailNexus ABP. They are now queued for AI optimization and review on the main dashboard!"
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchAndApplyApprovedBlocks = async () => {
    try {
      let res = await fetch('http://localhost:8000/api/operational-blocks');
      let approvedBlocks = [];
      if (res.ok) {
        approvedBlocks = await res.json();
      } else {
        res = await fetch('http://localhost:8000/api/maintenance?status=approved');
        if (res.ok) approvedBlocks = await res.json();
      }
      
      if (approvedBlocks.length === 0) {
        alert('No approved blocks found in the main system. Go to the RailNexus ABP dashboard and approve some suggestions first!');
        return;
      }
      
      let appliedCount = 0;
      for (const req of approvedBlocks) {
        const duration = req.allocated_end_minute && req.allocated_start_minute
          ? (req.allocated_end_minute - req.allocated_start_minute)
          : (req.model_features?.planned_duration_minutes || 60);
        await fetch('http://localhost:9001/faults', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            section_id: req.section_id,
            type: 'Approved Operational Block',
            duration_ticks: duration
          })
        });
        appliedCount++;
      }
      alert(`Successfully injected ${appliedCount} approved block(s) into the live world! Check the map to see trains stop.`);
    } catch (e) {
      alert('Failed to fetch and apply approved blocks: ' + e.message);
    }
  };
  
  const clearBlocks = async () => {
    try {
      for (const section of sections) {
        await fetch(`http://localhost:9001/faults/${section.id}`, { method: 'DELETE' });
      }
      alert('Blocks cleared from live world!');
    } catch (e) {
      alert('Failed to clear blocks: ' + e.message);
    }
  };

  return (
    <div className="flex flex-col bg-surface h-full">
      <div className="px-4 py-2.5 border-b border-border-default bg-surface-sunken flex justify-between items-center shrink-0">
        <h2 className="text-[13px] font-semibold text-text-primary m-0">Live Integration Optimizer</h2>
        <span className="text-[10px] font-semibold tracking-wider text-brand uppercase">STATEFUL API</span>
      </div>

      <div className="p-4 flex-1 overflow-y-auto">
        <div className="mb-4 flex justify-between items-center">
          <p className="text-[12px] text-text-secondary m-0">Create requests to feed the main system.</p>
          <button 
            onClick={addRequest}
            className="text-[11px] font-medium text-brand hover:text-brand-hover border border-brand px-2 py-1 rounded-sm"
          >
            + Add Request
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {requests.map((req, i) => (
            <div key={i} className="p-3 border border-border-default rounded-sm bg-surface-sunken relative">
              <button 
                type="button" 
                onClick={() => removeRequest(i)}
                className="absolute top-2 right-2 text-text-secondary hover:text-critical text-[16px] leading-none"
              >
                &times;
              </button>
              
              <div className="grid grid-cols-2 gap-3 mt-1">
                <label className="flex flex-col gap-1 text-[11px] font-medium text-text-primary">
                  ID
                  <input 
                    type="text" 
                    value={req.id} 
                    onChange={e => updateRequest(i, 'id', e.target.value)}
                    className="bg-surface border border-border-default px-2 py-1 rounded-sm focus:border-brand outline-none"
                    required
                  />
                </label>
                <label className="flex flex-col gap-1 text-[11px] font-medium text-text-primary">
                  Section
                  <select 
                    value={req.section_id} 
                    onChange={e => updateRequest(i, 'section_id', e.target.value)}
                    className="bg-surface border border-border-default px-2 py-1 rounded-sm focus:border-brand outline-none"
                  >
                    {sections.map(s => (
                      <option key={s.id} value={s.id}>{s.id}</option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-[11px] font-medium text-text-primary">
                  Department
                  <select 
                    value={req.department} 
                    onChange={e => updateRequest(i, 'department', e.target.value)}
                    className="bg-surface border border-border-default px-2 py-1 rounded-sm focus:border-brand outline-none"
                  >
                    {Object.keys(DEPARTMENTS).map(dept => (
                      <option key={dept} value={dept}>{dept}</option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-[11px] font-medium text-text-primary">
                  Work Type
                  <select 
                    value={req.work_type} 
                    onChange={e => updateRequest(i, 'work_type', e.target.value)}
                    className="bg-surface border border-border-default px-2 py-1 rounded-sm focus:border-brand outline-none"
                  >
                    {DEPARTMENTS[req.department]?.map(wt => (
                      <option key={wt} value={wt}>{wt}</option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-[11px] font-medium text-text-primary">
                  Location (km)
                  <select 
                    value={req.location_km} 
                    onChange={e => updateRequest(i, 'location_km', Number(e.target.value))}
                    className="bg-surface border border-border-default px-2 py-1 rounded-sm focus:border-brand outline-none"
                    required
                  >
                    {getKmOptions(req.section_id).map(km => (
                      <option key={km} value={km}>{km} km</option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-[11px] font-medium text-text-primary">
                  Duration (min)
                  <input 
                    type="number" 
                    value={req.predicted_duration_minutes} 
                    onChange={e => updateRequest(i, 'predicted_duration_minutes', e.target.value)}
                    className="bg-surface border border-border-default px-2 py-1 rounded-sm focus:border-brand outline-none"
                    min="1"
                    required
                  />
                </label>
              </div>
            </div>
          ))}

          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-brand hover:bg-brand-hover text-surface py-2 rounded-sm text-[12px] font-medium transition-colors disabled:opacity-50"
          >
            {loading ? 'Submitting to Main System...' : 'Submit to Main System'}
          </button>
        </form>

        {error && (
          <div className="mt-4 p-3 bg-critical/10 border border-critical/20 rounded-sm text-critical text-[11px]">
            API error: {error}
          </div>
        )}

        {result && (
          <div className="mt-4 p-3 bg-success/10 border border-success/20 rounded-sm text-success text-[12px] font-medium">
            {result.message}
          </div>
        )}

        <div className="mt-6 border-t border-border-default pt-4">
          <h3 className="text-[12px] font-semibold text-text-primary mb-3">Live World Controls</h3>
          <div className="flex gap-2">
            <button 
              onClick={fetchAndApplyApprovedBlocks}
              className="flex-1 bg-surface-sunken border border-brand text-brand hover:bg-brand/10 py-2 rounded-sm text-[11px] font-medium transition-colors"
            >
              Fetch Approved Blocks
            </button>
            <button 
              onClick={clearBlocks}
              className="flex-1 bg-surface border border-border-default hover:bg-surface-sunken py-2 rounded-sm text-[11px] font-medium text-text-secondary transition-colors"
            >
              Clear Live Blocks
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
