import React from 'react';

interface CodeEditorProps {
  code: string;
  onChange: (code: string) => void;
  isProcessing: boolean;
}

const CodeEditor: React.FC<CodeEditorProps> = ({ code, onChange, isProcessing }) => {
  return (
    <div className="flex flex-col h-full bg-[#1e1e1e] text-gray-300">
      <div className="flex items-center justify-between px-4 py-3 bg-[#252526] border-b border-[#333]">
        <span className="text-sm font-medium text-gray-400 font-sans">INPUT SOURCE (VERILOG/SV)</span>
        <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-blue-500"></div>
            <span className="text-xs text-gray-500">Editor Active</span>
        </div>
      </div>
      
      <div className="relative flex-1 overflow-hidden">
        <textarea
            className="w-full h-full p-4 bg-[#1e1e1e] text-gray-200 font-mono-code text-sm resize-none focus:outline-none leading-6"
            value={code}
            onChange={(e) => onChange(e.target.value)}
            spellCheck={false}
            placeholder="// Paste your Verilog FSM module here..."
            disabled={isProcessing}
        />
        {isProcessing && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-10 backdrop-blur-sm">
                <div className="flex flex-col items-center gap-3">
                    <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full"></div>
                    <span className="text-white font-medium text-sm tracking-wide">Parsing Verilog Logic...</span>
                </div>
            </div>
        )}
      </div>
    </div>
  );
};

export default CodeEditor;
