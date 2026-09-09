import React from 'react';

const STATE_COLORS = {
  clear: 'border-l-[#3ddc84]',
  occupied: 'border-l-[#f5a623]',
  maintenance: 'border-l-[#e5484d]',
  reserved: 'border-l-[#5b8def]',
};

export default function SectionTable({ world }) {
  const sections = world?.sections || [];

  return (
    <div className="bg-[#101d22]/95 border border-[#26383e] rounded-lg overflow-hidden shadow-[0_16px_35px_rgba(0,0,0,0.14)] flex flex-col h-full">
      <div className="flex justify-between items-center p-3 border-b border-[#26383e] bg-[#122026]">
        <h2 className="text-sm font-semibold text-[#e8eef1] m-0">Section Status</h2>
        <span className="text-xs font-mono text-[#91a1a8]">{sections.length} sections</span>
      </div>
      
      <div className="overflow-auto flex-1">
        <table className="w-full text-left border-collapse text-xs">
          <thead className="sticky top-0 bg-[#0d181c] text-[#91a1a8] font-mono uppercase text-[10px] tracking-wider border-b border-[#26383e] z-10">
            <tr>
              <th className="p-3 font-semibold">Section</th>
              <th className="p-3 font-semibold">Train</th>
              <th className="p-3 font-semibold">State</th>
              <th className="p-3 font-semibold">Fault</th>
            </tr>
          </thead>
          <tbody className="font-mono divide-y divide-[#26383e]/50">
            {sections.map(sec => {
              const borderClass = STATE_COLORS[sec.state?.toLowerCase()] || 'border-l-[#91a1a8]';
              return (
                <tr key={sec.id} className="hover:bg-[#122126] transition-colors">
                  <td className={`p-3 border-l-2 ${borderClass} font-semibold text-[#e8eef1]`}>
                    {sec.id}
                  </td>
                  <td className="p-3 text-[#91a1a8]">
                    {sec.occupiedBy || '—'}
                  </td>
                  <td className="p-3 uppercase text-[10px]">
                    <span className={
                      sec.state === 'clear' ? 'text-[#3ddc84]' :
                      sec.state === 'occupied' ? 'text-[#f5a623]' :
                      sec.state === 'maintenance' ? 'text-[#e5484d]' :
                      sec.state === 'reserved' ? 'text-[#5b8def]' : 'text-[#91a1a8]'
                    }>
                      {sec.state || 'Unknown'}
                    </span>
                  </td>
                  <td className="p-3 text-[#91a1a8] truncate max-w-[150px]" title={sec.fault}>
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
