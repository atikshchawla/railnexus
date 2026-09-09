import React, { useMemo } from 'react';
import { CheckCircle2, Clock, XCircle } from 'lucide-react';

const DEPT_COLORS = {
  TDMS: 'text-info',
  SMMS: 'text-critical',
  TMS: 'text-warning',
};

const STATUS_ICONS = {
  approved: <CheckCircle2 className="w-3 h-3 text-success" />,
  pending: <Clock className="w-3 h-3 text-warning" />,
  rejected: <XCircle className="w-3 h-3 text-critical" />,
  raised: <Clock className="w-3 h-3 text-warning" />
};

export default function RequestFeed({ memberB }) {
  const feedItems = useMemo(() => {
    if (!memberB) return [];
    
    const allRequests = ['TMS', 'TDMS', 'SMMS'].flatMap(dept => 
      (memberB.departments?.[dept]?.requests || []).map(r => ({ ...r, department: dept }))
    );
    
    const decisions = new Map((memberB.decisions || []).map(d => [d.requestId, d]));
    
    allRequests.sort((a, b) => new Date(b.raisedAt) - new Date(a.raisedAt));
    
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
    <div className="flex flex-col h-full bg-surface">
      <div className="shrink-0 flex justify-between items-center px-4 py-2 border-b border-border-default bg-surface-sunken">
        <h2 className="text-[13px] font-semibold text-text-primary m-0">
          Request Feed
        </h2>
        <span className="text-[11px] font-mono text-text-secondary num">{feedItems.length} events</span>
      </div>
      
      <div className="flex-1 overflow-auto p-3 space-y-2">
        {feedItems.length === 0 ? (
          <p className="text-[12px] text-text-secondary italic text-center py-8">Waiting for live requests...</p>
        ) : (
          feedItems.slice(0, 50).map((item) => (
            <div 
              key={item.id} 
              className="p-3 bg-surface border border-border-default rounded-sm shadow-sm hover:bg-canvas transition-colors"
            >
              <div className="flex justify-between items-start mb-1.5">
                <span className="text-[10px] font-semibold text-text-secondary uppercase tracking-wide">
                  <span className={`${DEPT_COLORS[item.department] || 'text-text-primary'}`}>{item.department}</span>
                  <span className="mx-1.5 opacity-50">&middot;</span> 
                  {item.type.replace('_', ' ')}
                  {item.count > 1 && (
                    <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded-sm text-[10px] font-bold bg-surface-sunken text-text-primary border border-border-default num">
                      &times;{item.count}
                    </span>
                  )}
                </span>
                <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide">
                  {STATUS_ICONS[item.status.toLowerCase()]}
                  <span className={item.status === 'approved' ? 'text-success' : item.status === 'rejected' ? 'text-critical' : 'text-warning'}>
                    {item.status}
                  </span>
                </span>
              </div>
              
              <div className="text-[13px] text-text-primary mb-2 leading-relaxed">
                {item.description}
              </div>
              
              <div className="flex justify-between items-center text-[11px] text-text-secondary">
                <span>
                  <span className="font-semibold text-text-primary">{item.sectionId}</span>
                  {item.trainId && <span> &middot; {item.trainId}</span>}
                </span>
                <span className="text-info font-medium">
                  {item.status === 'pending' ? 'Awaiting ABP' : 'ABP resolved'}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
