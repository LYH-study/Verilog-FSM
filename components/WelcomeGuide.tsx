import React, { useState, useEffect } from 'react';
import { X, Play, MousePointer2, Settings2, FileImage, Cpu } from 'lucide-react';

interface WelcomeGuideProps {
  isOpen: boolean;
  onClose: () => void;
}

const WelcomeGuide: React.FC<WelcomeGuideProps> = ({ isOpen, onClose }) => {
  const [dontShowAgain, setDontShowAgain] = useState(false);

  const handleClose = () => {
    if (dontShowAgain) {
      localStorage.setItem('verilog_fsm_guide_seen', 'true');
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-2xl rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-gray-50 border-b border-gray-100 p-6 flex items-start justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <div className="w-8 h-8 bg-black text-white flex items-center justify-center rounded text-sm font-serif-academic">V</div>
              Verilog FSM Visualizer
            </h2>
            <p className="text-sm text-gray-500 mt-1">Turn hardware code into publication-ready diagrams.</p>
          </div>
          <button 
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-700 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="p-8 overflow-y-auto space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            
            <div className="flex gap-4">
              <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                <Cpu size={20} />
              </div>
              <div>
                <h3 className="font-bold text-gray-900 mb-1">1. Input Verilog</h3>
                <p className="text-sm text-gray-600 leading-relaxed">
                  Paste your Verilog/SystemVerilog FSM module into the left editor. The AI extracts states, transitions, and Mealy actions automatically.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="w-10 h-10 rounded-full bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
                <Play size={20} />
              </div>
              <div>
                <h3 className="font-bold text-gray-900 mb-1">2. Generate Graph</h3>
                <p className="text-sm text-gray-600 leading-relaxed">
                  Click <strong>GENERATE</strong> to build the diagram. The layout engine organizes nodes radially or logically based on data flow.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="w-10 h-10 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                <MousePointer2 size={20} />
              </div>
              <div>
                <h3 className="font-bold text-gray-900 mb-1">3. Interactive Editing</h3>
                <p className="text-sm text-gray-600 leading-relaxed">
                  <strong>Drag</strong> nodes to rearrange. <strong>Click</strong> lines or states to edit logic conditions in the Inspector panel. Use <strong>Connect Mode</strong> to add manual wires.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="w-10 h-10 rounded-full bg-green-50 text-green-600 flex items-center justify-center shrink-0">
                <FileImage size={20} />
              </div>
              <div>
                <h3 className="font-bold text-gray-900 mb-1">4. Export</h3>
                <p className="text-sm text-gray-600 leading-relaxed">
                  Download high-res <strong>PNG, SVG, or PDF</strong> images for documentation. Use the <strong>TXT Report</strong> for a logic summary.
                </p>
              </div>
            </div>

          </div>

          <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 text-xs text-gray-600 flex gap-3">
             <Settings2 className="shrink-0 text-gray-400" size={16} />
             <div>
                <span className="font-bold text-gray-700">Pro Tip:</span> Use the <span className="font-mono bg-gray-200 px-1 rounded">Inspector</span> on the right to rename states or refine complex logic conditions (e.g., simplifying "cnt==0 | cnt==1" to "cnt &lt; 2"). Changes update instantly.
             </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-gray-50 p-4 border-t border-gray-200 flex items-center justify-between">
          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
            <input 
              type="checkbox" 
              checked={dontShowAgain}
              onChange={(e) => setDontShowAgain(e.target.checked)}
              className="rounded border-gray-300 text-black focus:ring-gray-400"
            />
            Don't show this again
          </label>
          <button 
            onClick={handleClose}
            className="bg-black text-white px-8 py-2.5 rounded-lg font-bold hover:bg-gray-800 transition-all shadow-lg hover:shadow-xl active:scale-95"
          >
            Get Started
          </button>
        </div>
      </div>
    </div>
  );
};

export default WelcomeGuide;