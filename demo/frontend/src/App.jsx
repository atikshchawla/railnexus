import React, { useState } from 'react';
import { useDemoState } from './hooks/useDemoState';
import MapView from './components/MapView';
import RequestFeed from './components/RequestFeed';
import SectionTable from './components/SectionTable';
import FaultInjectionPanel from './components/FaultInjectionPanel';
import RaiseRequestForm from './components/RaiseRequestForm';
import OptimizerForm from './components/OptimizerForm';
import RawFeedDrawer from './components/RawFeedDrawer';

export default function App() {
  const {
    network,
    world,
    rawWorld,
    memberB,
    error,
    paused,
    setPaused,
    injectFault,
    clearFault,
    raiseRequest,
  } = useDemoState();

  const [mode, setMode] = useState('coa'); // 'coa' or 'world'
  const [selectedDetail, setSelectedDetail] = useState(null);
  const [formMode, setFormMode] = useState('multi'); // 'single' or 'multi'

  return (
    <div className="h-screen overflow-hidden bg-canvas text-text-primary font-sans flex flex-col">
      {/* Header */}
      <header className="shrink-0 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 p-4 md:px-6 md:py-3 bg-brand text-white border-b border-border-default z-50">
        <div>
          <span className="text-[10px] font-mono tracking-widest text-[#BEE2FF] uppercase">
            RAILNEXUS / DEMO CONTROL
          </span>
          <h1 className="text-[18px] font-semibold tracking-tight mt-0.5 mb-0">
            Southern Railway Live Operations
          </h1>
          <p className="text-[11px] font-mono text-[#D6E8F7] mt-0.5 mb-0">
            {network?.corridor || 'AJJ–JTJ Trained Corridor'}
          </p>
        </div>
        
        <div className="flex items-center gap-4 flex-wrap justify-end">
          <span className={`text-[10px] font-mono tracking-[0.11em] px-2.5 py-1 border rounded bg-surface ${error ? 'text-critical border-critical' : 'text-success border-success'}`}>
            {error ? 'OFFLINE' : 'LIVE'}
          </span>
          
          <span className="text-[11px] font-mono text-[#BEE2FF] flex items-center gap-2">
            TICK <strong className="text-[16px] text-white num">{world?.tick || '--'}</strong>
          </span>
          
          <div className="flex border border-[#0A335A] rounded p-1 bg-[#0A335A]">
            <button 
              onClick={() => setMode('coa')}
              className={`px-3 py-1.5 text-xs rounded transition-colors ${mode === 'coa' ? 'bg-surface text-text-primary font-medium' : 'text-[#BEE2FF] hover:text-white'}`}
            >
              COA dashboard
            </button>
            <button 
              onClick={() => setMode('world')}
              className={`px-3 py-1.5 text-xs rounded transition-colors ${mode === 'world' ? 'bg-surface text-text-primary font-medium' : 'text-[#BEE2FF] hover:text-white'}`}
            >
              Member A console
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden p-4 md:px-6 md:py-5 flex flex-col gap-5 min-h-0">
        
        {mode === 'coa' ? (
          // COA View
          <div className="flex-1 flex flex-col lg:flex-row gap-5 min-h-0">
            {/* Left Column (65%) */}
            <div className="flex-[2] flex flex-col gap-4 min-h-0">
              <div className="flex-1 min-h-0 border border-border-default bg-surface shadow-sm rounded-sm">
                <MapView world={world} network={network} setSelectedDetail={setSelectedDetail} />
              </div>
              
              <div className="shrink-0 flex flex-col gap-2 p-3 bg-surface border border-border-default rounded-sm shadow-sm">
                <div className="flex justify-between items-center">
                  <div>
                    <span className="text-[10px] font-mono text-brand uppercase tracking-widest font-semibold">Presenter Controls</span>
                    <strong className="block text-xs mt-1 text-text-primary">Keep the loop visible.</strong>
                  </div>
                  <div className="flex gap-3 items-center">
                    <span className="text-[11px] font-mono text-text-secondary">
                      {world?.timestamp ? `Updated ${new Date(world.timestamp).toLocaleTimeString()}` : 'No snapshot yet'}
                    </span>
                    <button 
                      onClick={() => setPaused(!paused)}
                      className="bg-surface hover:bg-surface-sunken text-text-primary border border-border-default px-3 py-1.5 text-xs font-medium transition-colors rounded-sm"
                    >
                      {paused ? 'Resume feed' : 'Pause feed'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Right Column (35%) */}
            <div className="flex-1 flex flex-col gap-4 min-w-[320px] min-h-0">
              <div className="flex-1 min-h-0 border border-border-default bg-surface shadow-sm rounded-sm flex flex-col overflow-hidden">
                <RequestFeed memberB={memberB} />
              </div>
              <div className="shrink-0 border border-border-default bg-surface shadow-sm rounded-sm max-h-[60vh] flex flex-col">
                <div className="flex border-b border-border-default bg-surface-sunken">
                  <button 
                    onClick={() => setFormMode('multi')}
                    className={`flex-1 py-2 text-[11px] font-medium text-center ${formMode === 'multi' ? 'bg-surface text-brand border-b-[3px] border-brand' : 'text-text-secondary hover:text-text-primary border-b-[3px] border-transparent'}`}
                  >
                    ML Optimizer (Multi)
                  </button>
                  <button 
                    onClick={() => setFormMode('single')}
                    className={`flex-1 py-2 text-[11px] font-medium text-center ${formMode === 'single' ? 'bg-surface text-brand border-b-[3px] border-brand' : 'text-text-secondary hover:text-text-primary border-b-[3px] border-transparent'}`}
                  >
                    Simple Request (Single)
                  </button>
                </div>
                <div className="flex-1 overflow-hidden flex flex-col">
                  {formMode === 'multi' ? (
                    <OptimizerForm network={network} />
                  ) : (
                    <div className="overflow-y-auto">
                      <RaiseRequestForm network={network} world={world} raiseRequest={raiseRequest} />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : (
          // Member A World Console View
          <div className="flex-1 flex flex-col gap-5 min-h-0">
            <div className="flex-1 flex flex-col lg:flex-row gap-5 min-h-0">
              {/* Left Column: Map */}
              <div className="flex-[1.5] min-h-0 border border-border-default bg-surface shadow-sm rounded-sm">
                <MapView world={world} network={network} setSelectedDetail={setSelectedDetail} />
              </div>
              
              {/* Right Column: Tables */}
              <div className="flex-1 flex flex-col gap-5 min-h-0 border border-border-default bg-surface shadow-sm rounded-sm">
                <SectionTable world={world} />
              </div>
            </div>
            
            {/* Bottom Panel: Fault Injection */}
            <div className="shrink-0 border border-border-default bg-surface shadow-sm rounded-sm">
              <FaultInjectionPanel network={network} injectFault={injectFault} clearFault={clearFault} />
            </div>
          </div>
        )}

        {/* Raw Feed Drawer (always available at bottom) */}
        <div className="shrink-0 border border-border-default bg-surface shadow-sm rounded-sm z-10">
          <RawFeedDrawer rawWorld={rawWorld} />
        </div>
        
      </main>
    </div>
  );
}
