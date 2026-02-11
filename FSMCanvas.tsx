import React, { useCallback, useMemo } from 'react';
import ReactFlow, {
  Background,
  Controls,
  Panel,
  Node,
  Edge,
  ConnectionMode,
  OnConnect,
  OnSelectionChangeFunc,
  NodeMouseHandler,
  MiniMap,
  ConnectionLineType
} from 'reactflow';
import { ImageDown, Info, FileImage, FileType, FileCode, FileText } from 'lucide-react';
import { toPng, toSvg } from 'html-to-image';
import { jsPDF } from 'jspdf';
import { nodeTypes } from './CustomNodes';
import { StubEdge, DraggableStepEdge, RadialEdge } from './CustomEdges';

interface FSMCanvasProps {
  nodes: Node[];
  edges: Edge[];
  onNodesChange: any; 
  onEdgesChange: any;
  onConnect: OnConnect;
  onSelectionChange: OnSelectionChangeFunc;
  isConnectMode: boolean;
  onNodeClick?: NodeMouseHandler;
  onPaneClick?: () => void;
  // NEW: Hover Handlers
  onNodeMouseEnter?: NodeMouseHandler;
  onNodeMouseLeave?: NodeMouseHandler;
}

const FSMCanvas: React.FC<FSMCanvasProps> = ({ 
    nodes, 
    edges, 
    onNodesChange, 
    onEdgesChange, 
    onConnect,
    onSelectionChange,
    isConnectMode,
    onNodeClick,
    onPaneClick,
    onNodeMouseEnter,
    onNodeMouseLeave
}) => {
  
  const handleExport = useCallback((format: 'png' | 'svg' | 'pdf' | 'txt') => {
    
    // --- TXT EXPORT LOGIC ---
    if (format === 'txt') {
        const timestamp = new Date().toLocaleString();
        let content = `Verilog FSM Logic Report\nGenerated: ${timestamp}\n\n`;
        
        content += `========================================\n`;
        content += `              STATES (${nodes.length})\n`;
        content += `========================================\n`;
        nodes.forEach(n => {
            const label = n.data.label || n.id;
            const desc = n.data.description ? ` // ${n.data.description}` : '';
            const init = n.data.isInitial ? ' [INITIAL]' : '';
            content += `- ${label.padEnd(15)} ${init}${desc}\n`;
        });

        const logicEdges = edges.filter(e => e.data?.condition || e.data?.action || e.data?.isManual);
        
        content += `\n========================================\n`;
        content += `           TRANSITIONS (${logicEdges.length})\n`;
        content += `========================================\n`;
        
        // Sort for readability
        logicEdges.sort((a, b) => {
             const sA = a.data?.sourceLabel || '';
             const sB = b.data?.sourceLabel || '';
             return sA.localeCompare(sB);
        });

        logicEdges.forEach((e, i) => {
            const src = e.data?.sourceLabel || 'Unknown';
            const tgt = e.data?.targetLabel || 'Unknown';
            const cond = e.data?.condition || 'always';
            const act = e.data?.action || '-';
            const id = (i + 1).toString().padStart(2, '0');
            
            content += `[${id}] ${src} -> ${tgt}\n`;
            content += `     Condition: ${cond}\n`;
            if(act !== '-') content += `     Action:    ${act}\n`;
            content += `----------------------------------------\n`;
        });

        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.download = `fsm-logic-${Date.now()}.txt`;
        link.href = url;
        link.click();
        URL.revokeObjectURL(url);
        return;
    }

    // --- VISUAL EXPORT LOGIC (PNG/SVG/PDF) ---
    const flowElement = document.querySelector('.react-flow') as HTMLElement;
    
    if (flowElement) {
        // Options for clean, black-and-white publication export
        const options = {
            backgroundColor: '#ffffff',
            filter: (node: HTMLElement) => {
                const classList = node.classList;
                if (!classList) return true;
                
                // 1. Hide UI Controls
                if (classList.contains('react-flow__controls')) return false;
                if (classList.contains('react-flow__panel')) return false;
                if (classList.contains('react-flow__minimap')) return false; // Hide MiniMap
                
                // 2. Hide Background (Optional - keeping grid for context if needed, but B&W filter handles it)
                // if (classList.contains('react-flow__background')) return false;

                // 3. HIDE INTERACTION HANDLES (The small dots around circles)
                if (classList.contains('react-flow__handle')) return false;

                // 4. HIDE EDGE LABELS (The sequence numbers)
                if (classList.contains('react-flow__edge-textwrapper')) return false;
                if (classList.contains('react-flow__edge-textbg')) return false; 
                if (classList.contains('react-flow__edge-text')) return false;

                return true;
            },
            style: { 
                transform: 'scale(1)',
                // CRITICAL: Force Grayscale for pure Black & White output
                filter: 'grayscale(100%) contrast(150%)'
            }
        };

        const fileName = `fsm-diagram-${Date.now()}`;

        if (format === 'png') {
            toPng(flowElement, options)
                .then((dataUrl) => {
                    const link = document.createElement('a');
                    link.download = `${fileName}.png`;
                    link.href = dataUrl;
                    link.click();
                });
        } else if (format === 'svg') {
            toSvg(flowElement, options)
                .then((dataUrl) => {
                    const link = document.createElement('a');
                    link.download = `${fileName}.svg`;
                    link.href = dataUrl;
                    link.click();
                });
        } else if (format === 'pdf') {
            // Use 2x pixel ratio for crisper PDF
            toPng(flowElement, { ...options, pixelRatio: 2 })
                .then((dataUrl) => {
                    const width = flowElement.offsetWidth;
                    const height = flowElement.offsetHeight;
                    
                    const orientation = width > height ? 'l' : 'p';
                    
                    // @ts-ignore - jsPDF types from esm.sh might be loose
                    const pdf = new jsPDF({
                        orientation,
                        unit: 'px',
                        format: [width, height]
                    });
                    
                    pdf.addImage(dataUrl, 'PNG', 0, 0, width, height);
                    pdf.save(`${fileName}.pdf`);
                });
        }
    }
  }, [nodes, edges]);

  const nodeTypesMemo = useMemo(() => nodeTypes, []);
  
  // Register the new draggable edge and radial edge
  const edgeTypesMemo = useMemo(() => ({
    stub: StubEdge,
    draggable: DraggableStepEdge,
    radial: RadialEdge 
  }), []);

  const btnClass = "flex items-center justify-center w-8 h-8 bg-white border border-black hover:bg-gray-100 transition-colors shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[1px] hover:translate-x-[1px] hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]";

  return (
    <div className={`h-full w-full bg-[#f8f9fa] relative font-serif-academic group ${isConnectMode ? 'cursor-crosshair' : ''}`}>
       <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect} 
        onSelectionChange={onSelectionChange}
        nodeTypes={nodeTypesMemo}
        edgeTypes={edgeTypesMemo}
        connectionMode={ConnectionMode.Loose}
        
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        onNodeMouseEnter={onNodeMouseEnter}
        onNodeMouseLeave={onNodeMouseLeave}

        // Default connection visual
        connectionLineType={ConnectionLineType.SmoothStep}
        connectionLineStyle={{ stroke: '#000000', strokeWidth: 3 }}
        
        fitView
        minZoom={0.5}
        maxZoom={2}
        deleteKeyCode={['Backspace', 'Delete']}
        
        // CRITICAL: Lock nodes when in Connect Mode
        nodesDraggable={!isConnectMode}
        panOnDrag={true} 
      >
        <Background color="#e5e7eb" gap={40} size={1} />
        
        <Controls style={{ borderColor: '#ddd', borderRadius: 4 }} showInteractive={false} />
        
        <MiniMap 
            nodeColor={(n) => {
                if (n.type === 'group') return '#eff6ff'; // Light blue for groups
                return '#fff';
            }}
            nodeStrokeWidth={3} 
            zoomable 
            pannable 
            style={{ border: '1px solid #ddd', borderRadius: 4, marginBottom: 40 }}
        />

        <Panel position="top-right" className="m-4 flex flex-col gap-3 items-end">
            <div className="flex flex-col items-end gap-1">
                <span className="text-[9px] font-bold uppercase tracking-wider text-gray-500">Export (B&W)</span>
                <div className="flex gap-2">
                    <button 
                        onClick={() => handleExport('png')}
                        className={btnClass}
                        title="Download PNG"
                    >
                        <FileImage size={14} />
                    </button>
                    <button 
                        onClick={() => handleExport('svg')}
                        className={btnClass}
                        title="Download SVG"
                    >
                        <FileCode size={14} />
                    </button>
                    <button 
                        onClick={() => handleExport('pdf')}
                        className={btnClass}
                        title="Download PDF"
                    >
                        <FileType size={14} />
                    </button>
                    <button 
                        onClick={() => handleExport('txt')}
                        className={btnClass}
                        title="Download Report (TXT)"
                    >
                        <FileText size={14} />
                    </button>
                </div>
            </div>

            <div className="bg-white border border-black p-2 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                <h4 className="font-bold text-[10px] uppercase tracking-wider mb-1">Legend</h4>
                <div className="flex items-center gap-2 mb-1">
                    <div className="w-6 h-0.5 bg-black"></div>
                    <span className="text-[9px] text-black font-bold">Your Wire</span>
                </div>
                 <div className="text-[9px] text-gray-500 italic mt-1">
                        Hover Node &rarr; Highlight Logic           
            </div>
        </Panel>

        <Panel position="bottom-center" className="mb-4">
             <div className={`
                flex items-center gap-3 px-5 py-2 rounded-full border shadow-lg backdrop-blur-sm transition-colors
                ${isConnectMode ? 'bg-blue-50/90 border-blue-200 text-blue-800' : 'bg-white/90 border-gray-200 text-gray-700'}
             `}>
                 <Info size={16} />
                 <div className="text-xs font-sans tracking-wide">
                    {isConnectMode ? (
                        <span><span className="font-bold">CONNECT:</span> Click handles to wire manually.</span>
                    ) : (
                        <span><span className="font-bold">VIEW MODE:</span> <span className="text-blue-600 font-bold">Hover nodes</span> to trace paths. Drag to rearrange.</span>
                    )}
                 </div>
             </div>
        </Panel>
      </ReactFlow>
    </div>
  );
};

export default FSMCanvas;