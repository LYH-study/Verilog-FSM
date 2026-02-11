import React from 'react';
import { Node, Edge } from 'reactflow';
import { Settings2, Type, Activity, MousePointerClick, AlignLeft, ArrowRightLeft } from 'lucide-react';

interface PropertiesPanelProps {
  selectedNode: Node | undefined;
  selectedEdge: Edge | undefined;
  onUpdateNode: (id: string, field: string, value: any) => void;
  onUpdateEdge: (id: string, field: string, value: any) => void;
}

export const PropertiesPanel: React.FC<PropertiesPanelProps> = ({ 
    selectedNode, 
    selectedEdge,
    onUpdateNode, 
    onUpdateEdge 
}) => {
    // If nothing selected, or multiple items (complex), we could show a placeholder or handle it.
    // For now, App.tsx only renders this if exactly one item is selected, 
    // but we safeguard here just in case.
    if (!selectedNode && !selectedEdge) return null;

    return (
        <div className="h-full flex flex-col bg-white">
            {/* Header */}
            <div className="h-10 border-b border-gray-100 flex items-center px-4 bg-gray-50/80 backdrop-blur-sm shrink-0">
                <Settings2 size={14} className="text-gray-500 mr-2" />
                <span className="text-xs font-bold uppercase tracking-widest text-gray-700">Inspector</span>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
                {selectedNode && (
                    <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-right-4 duration-300">
                         {/* Header Badge */}
                         <div className="flex items-center gap-3 pb-2 border-b border-gray-100">
                            <div className="w-10 h-10 rounded-full bg-gray-100 border-2 border-gray-200 flex items-center justify-center text-gray-400 font-serif-academic font-bold">
                                {selectedNode.data.label ? selectedNode.data.label.substring(0,2).toUpperCase() : '??'}
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-gray-900">State Properties</h3>
                                <p className="text-[10px] text-gray-400 font-mono-code">{selectedNode.id}</p>
                            </div>
                         </div>

                         {/* Node Identity */}
                         <div className="space-y-4">
                            <h4 className="text-[10px] font-bold text-blue-600 uppercase tracking-wider flex items-center gap-1.5">
                                <Type size={12} /> Identity
                            </h4>
                            <div>
                                <label className="block text-[10px] font-bold text-gray-500 mb-1.5 uppercase tracking-wide">State Name (Label)</label>
                                <input 
                                    className="w-full text-sm p-2 bg-gray-50 border border-gray-200 rounded focus:border-blue-500 focus:ring-1 focus:ring-blue-200 outline-none font-mono-code font-bold text-gray-800 transition-all"
                                    value={selectedNode.data.label}
                                    onChange={(e) => onUpdateNode(selectedNode.id, 'label', e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-gray-500 mb-1.5 uppercase tracking-wide">Description (Local)</label>
                                <div className="relative">
                                    <AlignLeft size={12} className="absolute top-2.5 left-2.5 text-gray-400" />
                                    <input 
                                        className="w-full text-xs p-2 pl-8 border border-gray-200 rounded focus:border-blue-500 focus:ring-1 focus:ring-blue-200 outline-none transition-all"
                                        value={selectedNode.data.description || ''}
                                        onChange={(e) => onUpdateNode(selectedNode.id, 'description', e.target.value)}
                                        placeholder="e.g. Idle / Waiting"
                                    />
                                </div>
                            </div>
                         </div>

                         <div className="w-full h-px bg-gray-100" />

                         {/* Node Configuration */}
                         <div className="space-y-4">
                            <h4 className="text-[10px] font-bold text-blue-600 uppercase tracking-wider flex items-center gap-1.5">
                                <Activity size={12} /> Configuration
                            </h4>
                            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100">
                                <div>
                                    <span className="text-xs font-bold text-gray-700 block">Initial State</span>
                                    <span className="text-[10px] text-gray-400">Entry point on Reset</span>
                                </div>
                                <button 
                                    onClick={() => onUpdateNode(selectedNode.id, 'isInitial', !selectedNode.data.isInitial)}
                                    className={`relative w-10 h-6 rounded-full transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${selectedNode.data.isInitial ? 'bg-black' : 'bg-gray-200'}`}
                                >
                                    <span 
                                        className={`inline-block w-4 h-4 transform bg-white rounded-full shadow transition duration-200 ease-in-out mt-1 ml-1 ${selectedNode.data.isInitial ? 'translate-x-4' : 'translate-x-0'}`} 
                                    />
                                </button>
                            </div>
                         </div>
                    </div>
                )}

                {selectedEdge && (
                    <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-right-4 duration-300">
                         {/* Header Badge */}
                         <div className="flex items-center gap-3 pb-2 border-b border-gray-100">
                            <div className="w-10 h-10 rounded-full bg-blue-50 border-2 border-blue-100 flex items-center justify-center text-blue-500">
                                <ArrowRightLeft size={18} />
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-gray-900">Transition</h3>
                                <p className="text-[10px] text-gray-400 font-mono-code truncate w-32">{selectedEdge.id}</p>
                            </div>
                         </div>

                         {/* Edge Logic */}
                         <div className="space-y-4">
                            <h4 className="text-[10px] font-bold text-blue-600 uppercase tracking-wider flex items-center gap-1.5">
                                <Activity size={12} /> Logic
                            </h4>
                            <div>
                                <label className="block text-[10px] font-bold text-gray-500 mb-1.5 uppercase tracking-wide">Condition</label>
                                <textarea 
                                    className="w-full text-xs p-3 border border-gray-200 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-200 outline-none font-mono-code bg-gray-50 min-h-[80px] leading-relaxed resize-none transition-all"
                                    value={selectedEdge.data?.condition || ''}
                                    onChange={(e) => onUpdateEdge(selectedEdge.id, 'condition', e.target.value)}
                                    placeholder="e.g. (req == 1) & (ready)"
                                />
                                <div className="text-[9px] text-gray-400 mt-1 text-right italic">Verilog syntax supported</div>
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-gray-500 mb-1.5 uppercase tracking-wide">Mealy Action</label>
                                <input 
                                    className="w-full text-xs p-2 border border-gray-200 rounded focus:border-blue-500 focus:ring-1 focus:ring-blue-200 outline-none font-mono-code text-green-700 transition-all"
                                    value={selectedEdge.data?.action || ''}
                                    onChange={(e) => onUpdateEdge(selectedEdge.id, 'action', e.target.value)}
                                    placeholder="e.g. ack = 1"
                                />
                            </div>
                         </div>

                         <div className="w-full h-px bg-gray-100" />

                         {/* Visual Style */}
                         <div className="space-y-4">
                            <h4 className="text-[10px] font-bold text-blue-600 uppercase tracking-wider flex items-center gap-1.5">
                                <Settings2 size={12} /> Appearance
                            </h4>
                            <div>
                                <label className="block text-[10px] font-bold text-gray-500 mb-2 uppercase tracking-wide">Line Weight</label>
                                <div className="flex gap-2">
                                    {[1, 2, 4].map(width => {
                                        const isActive = Number(selectedEdge.style?.strokeWidth ?? 2) === width;
                                        return (
                                            <button
                                                key={width}
                                                onClick={() => onUpdateEdge(selectedEdge.id, 'strokeWidth', width)}
                                                className={`
                                                    flex-1 py-2 border rounded-md flex items-center justify-center transition-all duration-200
                                                    ${isActive 
                                                        ? 'border-blue-600 bg-blue-50 text-blue-600 shadow-sm ring-1 ring-blue-100' 
                                                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50 text-gray-400'
                                                    }
                                                `}
                                                title={`${width}px`}
                                            >
                                                <div className="bg-current rounded-full" style={{ width: '60%', height: width }} />
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                         </div>
                    </div>
                )}
            </div>
        </div>
    );
}