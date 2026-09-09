"use client";

import { useState, useEffect } from "react";
import { TopBar } from "@/components/layout";
import { mockMetrics } from "@/lib/mock-data";
import { fetchAnalytics } from "@/lib/api-client";
import { isImprovement } from "@/lib/rules";
import { ArrowDown, ArrowUp, Calendar, BarChart3 } from "lucide-react";
import type { AnalyticsMetric } from "@/lib/types";

// ─── Sparkline Components ────────────────────────────────────────────

function MetricSparkline({ series, color }: { series: { value: number; weekLabel: string }[]; color: string }) {
  if (!series || series.length < 2) return null;
  const min = Math.min(...series.map(s => s.value)) * 0.9;
  const max = Math.max(...series.map(s => s.value)) * 1.1;
  const range = max - min;
  
  const w = 240;
  const h = 40;
  const step = w / (series.length - 1);
  
  const points = series.map((s, i) => {
    const x = i * step;
    const y = h - ((s.value - min) / range) * h;
    return `${x},${y}`;
  }).join(" ");

  return (
    <div className="pt-2">
      <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="overflow-visible">
        <polyline points={points} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        {series.map((s, i) => {
          const x = i * step;
          const y = h - ((s.value - min) / range) * h;
          return <circle key={i} cx={x} cy={y} r={3} fill={color} stroke="var(--bg-surface)" strokeWidth={1.5} />;
        })}
      </svg>
      <div className="flex justify-between mt-1.5 text-[9px] text-text-secondary uppercase tracking-wider font-semibold">
        {series.map((s, i) => (
          <span key={i}>{s.weekLabel}</span>
        ))}
      </div>
    </div>
  );
}

function TableBar({ value, max, colorClass }: { value: number; max: number; colorClass: string }) {
  const pct = Math.max(2, (value / max) * 100);
  return (
    <div className="flex items-center gap-2">
      <span className="w-8 text-right num">{value}</span>
      <div className="w-16 h-1.5 bg-surface-sunken overflow-hidden">
        <div className={`h-full ${colorClass}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const [backendData, setBackendData] = useState<any>(null);

  useEffect(() => {
    fetchAnalytics().then(setBackendData).catch(() => {});
  }, []);

  const sampleMetric = mockMetrics[0];
  const sizesMatch = Math.abs(sampleMetric.sampleSizeCurrent - sampleMetric.sampleSizeBaseline) / sampleMetric.sampleSizeBaseline <= 0.2;

  return (
    <>
      <TopBar
        title="Analytics & Coordination"
        subtitle="Cross-department performance and block utilization trends"
      />
      <div className="flex-1 p-5 space-y-6 overflow-y-auto bg-canvas">
        
        {/* Methodology (R6) */}
        <div className="bg-surface-sunken border border-border-default px-4 py-3 flex items-start gap-3">
          <Calendar size={16} className="text-text-secondary mt-0.5 shrink-0" />
          <div className="text-[12.5px] text-text-primary leading-snug">
            <span className="font-semibold">Methodology:</span> Comparing {sampleMetric.dateRangeCurrent.start}–{sampleMetric.dateRangeCurrent.end} (n={sampleMetric.sampleSizeCurrent} blocks) 
            against baseline {sampleMetric.dateRangeBaseline.start}–{sampleMetric.dateRangeBaseline.end} (n={sampleMetric.sampleSizeBaseline} blocks).
            {!sizesMatch && (
              <span className="ml-1 text-warning font-semibold">Sample sizes differ significantly — compare trend shapes, not absolute totals.</span>
            )}
          </div>
        </div>

        {/* Backend Live Analytics */}
        {backendData && (
          <div className="grid grid-cols-4 gap-px bg-border-default border border-border-default">
            <div className="bg-surface p-3">
              <p className="text-[11px] text-text-secondary mb-0.5 uppercase tracking-wider font-semibold">Total blocks (DB)</p>
              <p className="text-[24px] font-semibold text-text-primary leading-none num">{backendData.live?.totalBlocks ?? 0}</p>
              <p className="text-[11px] text-text-secondary mt-1">{backendData.live?.criticalCount ?? 0} critical</p>
            </div>
            <div className="bg-surface p-3">
              <p className="text-[11px] text-text-secondary mb-0.5 uppercase tracking-wider font-semibold">Historical Executed</p>
              <p className="text-[24px] font-semibold text-text-primary leading-none num">{backendData.historical?.totalExecuted ?? 0}</p>
              <p className="text-[11px] text-text-secondary mt-1">From block history</p>
            </div>
            <div className="bg-surface p-3">
              <p className="text-[11px] text-text-secondary mb-0.5 uppercase tracking-wider font-semibold">Avg Actual Duration</p>
              <p className="text-[24px] font-semibold text-text-primary leading-none num">{backendData.historical?.avgActualMinutes ?? 0} min</p>
              <p className="text-[11px] text-text-secondary mt-1">vs {backendData.historical?.avgPlannedMinutes ?? 0} planned</p>
            </div>
            <div className="bg-surface p-3">
              <p className="text-[11px] text-text-secondary mb-0.5 uppercase tracking-wider font-semibold">Overrun Rate</p>
              <p className={`text-[24px] font-semibold leading-none num ${(backendData.historical?.overrunRate ?? 0) > 20 ? "text-critical" : "text-text-primary"}`}>{backendData.historical?.overrunRate ?? 0}%</p>
              <p className="text-[11px] text-text-secondary mt-1">Blocks exceeding plan by &gt;10%</p>
            </div>
          </div>
        )}

        {/* Metric Cards */}
        <div className="grid grid-cols-3 gap-4">
          {mockMetrics.map(metric => {
            const improved = isImprovement(metric);
            const diff = metric.currentValue - metric.baselineValue;
            const sign = diff > 0 ? "+" : diff < 0 ? "−" : ""; // real sign
            const pctChange = ((diff / metric.baselineValue) * 100).toFixed(1);
            
            const colorClass = improved ? "text-success" : "text-critical";
            const hexColor = improved ? "#15803D" : "#DC2626";
            
            return (
              <div key={metric.name} className="bg-surface border border-border-default flex flex-col h-full">
                {/* Top Half */}
                <div className="p-4 border-b border-border-default">
                  <h3 className="text-[13px] font-semibold text-text-primary mb-2">{metric.name}</h3>
                  <div className="flex items-end gap-3">
                    <span className="text-[28px] font-semibold text-text-primary leading-none num">
                      {metric.currentValue}<span className="text-[16px] text-text-secondary ml-1">{metric.unit}</span>
                    </span>
                    <div className={`flex items-center gap-1 text-[13px] font-bold mb-1 ${colorClass}`}>
                      {improved ? (metric.goodDirection === "up" ? <ArrowUp size={16} strokeWidth={3} /> : <ArrowDown size={16} strokeWidth={3} />) 
                                : (metric.goodDirection === "up" ? <ArrowDown size={16} strokeWidth={3} /> : <ArrowUp size={16} strokeWidth={3} />)}
                      <span className="num">{sign}{Math.abs(diff).toFixed(1)}{metric.unit === "%" ? "pp" : ""} ({sign}{Math.abs(Number(pctChange))}%)</span>
                    </div>
                  </div>
                </div>
                {/* Bottom Half */}
                <div className="p-4 bg-surface-sunken/30 grow">
                  <MetricSparkline series={metric.weeklySeries} color={hexColor} />
                </div>
              </div>
            );
          })}
        </div>

        {/* Department Table */}
        <div className="bg-surface border border-border-default mt-6">
          <div className="px-4 py-3 border-b border-border-default">
            <h3 className="text-[14px] font-semibold text-text-primary">Department coordination efficiency</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[12.5px]">
              <thead>
                <tr className="bg-surface-sunken text-text-secondary text-left uppercase tracking-wider text-[10px]">
                  <th className="px-4 py-3 font-semibold w-1/5">Department</th>
                  <th className="px-4 py-3 font-semibold">Blocks this month</th>
                  <th className="px-4 py-3 font-semibold">Shadow blocks joined</th>
                  <th className="px-4 py-3 font-semibold">Conflicts raised</th>
                  <th className="px-4 py-3 font-semibold">Conflicts resolved</th>
                  <th className="px-4 py-3 font-semibold">Avg response time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-default">
                <tr className="hover:bg-surface-sunken/50">
                  <td className="px-4 py-3 font-semibold text-text-primary"><span className="inline-block w-2 h-2 rounded-full bg-amber-700 mr-2"></span>Engineering</td>
                  <td className="px-4 py-3"><TableBar value={142} max={150} colorClass="bg-amber-700" /></td>
                  <td className="px-4 py-3"><TableBar value={28} max={30} colorClass="bg-amber-700" /></td>
                  <td className="px-4 py-3"><TableBar value={12} max={15} colorClass="bg-critical" /></td>
                  <td className="px-4 py-3"><TableBar value={10} max={12} colorClass="bg-success" /></td>
                  <td className="px-4 py-3 num">4.2 hrs</td>
                </tr>
                <tr className="hover:bg-surface-sunken/50">
                  <td className="px-4 py-3 font-semibold text-text-primary"><span className="inline-block w-2 h-2 rounded-full bg-blue-700 mr-2"></span>TRD</td>
                  <td className="px-4 py-3"><TableBar value={86} max={150} colorClass="bg-blue-700" /></td>
                  <td className="px-4 py-3"><TableBar value={41} max={50} colorClass="bg-blue-700" /></td>
                  <td className="px-4 py-3"><TableBar value={4} max={15} colorClass="bg-critical" /></td>
                  <td className="px-4 py-3"><TableBar value={4} max={12} colorClass="bg-success" /></td>
                  <td className="px-4 py-3 num">2.1 hrs</td>
                </tr>
                <tr className="hover:bg-surface-sunken/50">
                  <td className="px-4 py-3 font-semibold text-text-primary"><span className="inline-block w-2 h-2 rounded-full bg-green-700 mr-2"></span>S&T</td>
                  <td className="px-4 py-3"><TableBar value={45} max={150} colorClass="bg-green-700" /></td>
                  <td className="px-4 py-3"><TableBar value={12} max={30} colorClass="bg-green-700" /></td>
                  <td className="px-4 py-3"><TableBar value={2} max={15} colorClass="bg-critical" /></td>
                  <td className="px-4 py-3"><TableBar value={2} max={12} colorClass="bg-success" /></td>
                  <td className="px-4 py-3 num">1.8 hrs</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </>
  );
}
