import React, { useState } from 'react';
import { useDemoState } from './hooks/useDemoState';
import MapView from './components/MapView';
import RequestFeed from './components/RequestFeed';
import SectionTable from './components/SectionTable';
import FaultInjectionPanel from './components/FaultInjectionPanel';
import RaiseRequestForm from './components/RaiseRequestForm';
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
  const [selectedDetail, setSelectedDetail] = useState(null); // Not fully implemented side-panel per prompt but placeholder ready

  return (
    <div className="min-h-screen bg-[#081216] text-[#e8eef1] font-sans flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 p-5 md:px-7 md:py-5 bg-[#081216]/95 backdrop-blur border-b border-[#26383e]">
        <div>
          <span className="text-[10px] font-mono tracking-widest text-[#55e6a5] uppercase">
            RAILNEXUS / DEMO CONTROL
          </span>
          <h1 className="text-[21px] font-[650] tracking-[0.01em] mt-1 mb-0">
            Southern Railway live operations
          </h1>
          <p className="text-[11px] font-mono text-[#91a1a8] mt-1 mb-0">
            {network?.corridor || 'AJJ–JTJ trained corridor'}
          </p>
        </div>
        
        <div className="flex items-center gap-4 flex-wrap justify-end">
          <span className={`text-[10px] font-mono tracking-[0.11em] px-2.5 py-1.5 border rounded ${error ? 'text-[#e5484d] border-[#e5484d]' : 'text-[#55e6a5] border-[#2f785d]'}`}>
            {error ? 'OFFLINE' : 'LIVE'}
          </span>
          
          <span className="text-[11px] font-mono text-[#91a1a8] flex items-center gap-2">
            TICK <strong className="text-[16px] text-[#e8eef1]">{world?.tick || '--'}</strong>
          </span>
          
          <div className="flex border border-[#26383e] rounded-full p-1 bg-[#101d22]">
            <button 
              onClick={() => setMode('coa')}
              className={`px-3 py-1.5 text-xs rounded-full transition-colors ${mode === 'coa' ? 'bg-[#1d343b] text-[#e8eef1]' : 'text-[#91a1a8] hover:text-[#e8eef1]'}`}
            >
              COA dashboard
            </button>
            <button 
              onClick={() => setMode('world')}
              className={`px-3 py-1.5 text-xs rounded-full transition-colors ${mode === 'world' ? 'bg-[#1d343b] text-[#e8eef1]' : 'text-[#91a1a8] hover:text-[#e8eef1]'}`}
            >
              Member A console
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-5 md:px-7 md:py-6 flex flex-col gap-5">
        
        {mode === 'coa' ? (
          // COA View
          <div className="flex flex-col lg:flex-row gap-5">
            {/* Left Column (65%) */}
            <div className="flex-[2] flex flex-col gap-5">
              <MapView world={world} network={network} setSelectedDetail={setSelectedDetail} />
              
              <div className="flex flex-col gap-2 p-3 bg-[#101d22]/95 border border-[#26383e] rounded-lg shadow-[0_16px_35px_rgba(0,0,0,0.14)]">
                <div className="flex justify-between items-center">
                  <div>
                    <span className="text-[10px] font-mono text-[#55e6a5] uppercase tracking-widest">Presenter Controls</span>
                    <strong className="block text-xs mt-1">Keep the loop visible.</strong>
                  </div>
                  <div className="flex gap-3 items-center">
                    <span className="text-[11px] font-mono text-[#91a1a8]">
                      {world?.timestamp ? `Updated ${new Date(world.timestamp).toLocaleTimeString()}` : 'No snapshot yet'}
                    </span>
                    <button 
                      onClick={() => setPaused(!paused)}
                      className="bg-[#19383e] hover:bg-[#255158] text-[#e8eef1] border border-[#3c6265] px-3 py-1.5 text-xs transition-colors"
                    >
                      {paused ? 'Resume feed' : 'Pause feed'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Right Column (35%) */}
            <div className="flex-1 flex flex-col gap-5 min-w-[320px]">
              <div className="flex-1 min-h-[300px]">
                <RequestFeed memberB={memberB} />
              </div>
              <div className="shrink-0">
                <RaiseRequestForm network={network} world={world} raiseRequest={raiseRequest} />
              </div>
            </div>
          </div>
        ) : (
          // Member A World Console View
          <div className="flex flex-col gap-5">
            <div className="flex flex-col lg:flex-row gap-5">
              {/* Left Column: Map */}
              <div className="flex-[1.5]">
                <MapView world={world} network={network} setSelectedDetail={setSelectedDetail} />
              </div>
              
              {/* Right Column: Tables */}
              <div className="flex-1 flex flex-col gap-5">
                <div className="flex-1 min-h-[250px]">
                  <SectionTable world={world} />
                </div>
              </div>
            </div>
            
            {/* Bottom Panel: Fault Injection */}
            <div className="w-full">
              <FaultInjectionPanel network={network} injectFault={injectFault} clearFault={clearFault} />
            </div>
          </div>
        )}

        {/* Raw Feed Drawer (always available at bottom) */}
        <RawFeedDrawer rawWorld={rawWorld} />
        
      </main>
    </div>
  );
}
