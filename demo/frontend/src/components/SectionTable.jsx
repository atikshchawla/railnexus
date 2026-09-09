import React from 'react';

export default function SectionTable({ world }) {
  const sections = world?.sections || [];

  return (
    <div className="flex flex-col h-full bg-surface">
      <div className="shrink-0 flex justify-between items-center px-4 py-2 border-b border-border-default bg-surface-sunken">
        <h2 className="text-[13px] font-semibold text-text-primary m-0">Section Status</h2>
        <span className="text-[11px] font-mono text-text-secondary num">{sections.length} sections</span>
      </div>
      
      <div className="overflow-auto flex-1 bg-surface">
        <table className="w-full text-left border-collapse text-[13px]">
          <thead className="sticky top-0 bg-surface-sunken text-text-secondary font-semibold text-[11px] uppercase tracking-wider border-b border-border-default z-10">
            <tr>
              <th className="px-4 py-2 font-semibold border-r border-border-default">Section</th>
              <th className="px-4 py-2 font-semibold border-r border-border-default">Train</th>
              <th className="px-4 py-2 font-semibold border-r border-border-default">State</th>
              <th className="px-4 py-2 font-semibold">Fault</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-default">
            {sections.map(sec => {
              return (
                <tr key={sec.id} className="hover:bg-canvas transition-colors even:bg-surface-sunken/50">
                  <td className="px-4 py-2.5 font-semibold text-text-primary border-r border-border-default">
                    {sec.id}
                  </td>
                  <td className="px-4 py-2.5 text-text-secondary border-r border-border-default num">
                    {sec.occupiedBy || '—'}
                  </td>
                  <td className="px-4 py-2.5 uppercase text-[11px] font-bold tracking-wide border-r border-border-default">
                    <span className={
                      sec.state === 'clear' ? 'text-success' :
                      sec.state === 'occupied' ? 'text-warning' :
                      sec.state === 'maintenance' ? 'text-critical' :
                      sec.state === 'reserved' ? 'text-info' : 'text-text-secondary'
                    }>
                      {sec.state || 'Unknown'}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-text-secondary truncate max-w-[200px]" title={sec.fault}>
                    {sec.fault || '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
