import React, { useMemo } from 'react';
import { CheckCircle2, Clock, XCircle, AlertTriangle } from 'lucide-react';

const DEPT_COLORS = {
  TDMS: 'bg-[#22d3ee]',
  SMMS: 'bg-[#f87171]',
  TMS: 'bg-[#c084fc]',
};

const STATUS_ICONS = {
  approved: <CheckCircle2 className="w-3 h-3 text-[#3ddc84]" />,
  pending: <Clock className="w-3 h-3 text-[#f5a623]" />,
  rejected: <XCircle className="w-3 h-3 text-[#e5484d]" />,
  raised: <Clock className="w-3 h-3 text-[#f5a623]" />
};

export default function RequestFeed({ memberB }) {
  const feedItems = useMemo(() => {
    if (!memberB) return [];
    
    // Combine all requests
    const allRequests = ['TMS', 'TDMS', 'SMMS'].flatMap(dept => 
      (memberB.departments?.[dept]?.requests || []).map(r => ({ ...r, department: dept }))
    );
    
    // Map decisions
    const decisions = new Map((memberB.decisions || []).map(d => [d.requestId, d]));
    
    // Sort by time descending
    allRequests.sort((a, b) => new Date(b.raisedAt) - new Date(a.raisedAt));
    
    // Deduplicate consecutive identical events
    const deduped = [];
    for (const req of allRequests) {
      const decision = decisions.get(req.id);
      const status = decision ? decision.decision : 'pending';
      const item = { ...req, status };
      
      const last = deduped[deduped.length - 1];
      if (last && last.type === item.type && last.sectionId === item.sectionId && last.status === item.status) {
        last.count = (last.count || 1) + 1;
        last.duplicates = last.duplicates || [];
        last.duplicates.push(item);
      } else {
        item.count = 1;
        deduped.push(item);
      }
    }
    
    return deduped;
  }, [memberB]);

  return (
    <div className="flex flex-col h-full bg-[#101d22]/95 border border-[#26383e] rounded-lg overflow-hidden shadow-[0_16px_35px_rgba(0,0,0,0.14)]">
      <div className="flex justify-between items-center p-3 border-b border-[#26383e] bg-[#122026]">
        <h2 className="text-sm font-semibold text-[#e8eef1] m-0 flex items-center gap-2">
          Request Feed
        </h2>
        <span className="text-xs font-mono text-[#91a1a8]">{feedItems.length} events</span>
      </div>
      
      <div className="flex-1 overflow-auto p-3 space-y-3">
        {feedItems.length === 0 ? (
          <p className="text-xs text-[#91a1a8] italic text-center py-8">Waiting for live requests...</p>
        ) : (
          feedItems.slice(0, 50).map((item) => (
            <div 
              key={item.id} 
              className="relative pl-3 py-2 pr-2 bg-[#0d181c] border border-[#26383e] rounded shadow-sm hover:bg-[#122126] transition-colors group"
            >
              {/* Department Color Border */}
              <div className={`absolute left-0 top-0 bottom-0 w-1 rounded-l ${DEPT_COLORS[item.department] || 'bg-gray-500'}`}></div>
              
              <div className="flex justify-between items-start mb-1">
                <span className="text-[10px] font-mono text-[#91a1a8] uppercase tracking-wider">
                  {item.department} &middot; {item.type.replace('_', ' ')}
                  {item.count > 1 && (
                    <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium bg-[#1d343b] text-[#e8eef1]">
                      &times;{item.count}
                    </span>
                  )}
                </span>
                <span className="flex items-center gap-1 text-[10px] font-mono uppercase text-[#e8eef1]">
                  {STATUS_ICONS[item.status.toLowerCase()]}
                  <span className={item.status === 'approved' ? 'text-[#3ddc84]' : item.status === 'rejected' ? 'text-[#e5484d]' : 'text-[#f5a623]'}>
                    {item.status}
                  </span>
                </span>
              </div>
              
              <div className="text-xs text-[#e8eef1] mb-1.5 pr-4 leading-relaxed">
                {item.description}
              </div>
              
              <div className="flex justify-between items-center text-[10px] font-mono text-[#91a1a8]">
                <span>
                  <span className="text-[#e8eef1] font-semibold">{item.sectionId}</span>
                  {item.trainId && <span> &middot; {item.trainId}</span>}
                </span>
                <span className="text-[#55e6a5]">
                  {item.status === 'pending' ? 'Awaiting ABP' : 'ABP resolved'}
                </span>
              </div>
              
              {/* Collapsible duplicates if any could go here */}
              {item.count > 1 && (
                <div className="mt-2 pt-2 border-t border-[#26383e] hidden group-hover:block">
                  <span className="text-[9px] font-mono text-[#91a1a8]">Includes {item.count - 1} earlier similar requests</span>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
