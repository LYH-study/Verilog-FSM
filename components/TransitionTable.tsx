import React from 'react';
import { Edge } from 'reactflow';

interface TransitionTableProps {
  edges: Edge[];
  onUpdateEdge: (edgeId: string, field: string, value: string) => void;
}

const TransitionTable: React.FC<TransitionTableProps> = ({ edges, onUpdateEdge }) => {
  // Filter edges to show: Must have logic OR be a manual wire
  const displayEdges = edges
    .filter(e => e.data?.condition || e.data?.action || e.data?.isManual) 
    .sort((a, b) => {
      // Try to parse ID/Label as number for sorting
      const idA = parseInt(a.label as string || a.data?.id || '999');
      const idB = parseInt(b.label as string || b.data?.id || '999');
      return idA - idB;
    });

  return (
    <div className="flex flex-col h-full bg-white border-t border-gray-200">
      <div className="px-6 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between sticky top-0">
        <h3 className="text-xs font-bold uppercase tracking-widest text-gray-700 font-sans">
            Logic Table (Condition Map)
        </h3>
        <span className="text-[10px] text-gray-500">
            {displayEdges.length} Transitions
        </span>
      </div>
      
      <div className="overflow-auto flex-1 p-0">
        <table className="w-full text-left border-collapse">
          <thead className="bg-white sticky top-0 z-10 shadow-sm text-[10px] font-bold text-gray-500 uppercase tracking-wider">
            <tr>
              <th className="py-2 px-4 border-b w-[80px] text-center">ID</th>
              <th className="py-2 px-4 border-b w-1/5">Source State</th>
              <th className="py-2 px-4 border-b w-1/5">Target State</th>
              <th className="py-2 px-4 border-b">Condition (Next Clk Logic)</th>
              <th className="py-2 px-4 border-b w-1/4">Action (Outputs)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 font-mono-code text-xs">
            {displayEdges.map((edge) => {
                const label = edge.label as string || edge.data?.id || '?';
                const condition = edge.data?.condition || '';
                const action = edge.data?.action || '';
                const isAlways = condition.toLowerCase().trim() === 'always';

                return (
                  <tr key={edge.id} className="hover:bg-blue-50 transition-colors group">
                    {/* ID Badge - Editable */}
                    <td className="py-2 px-4 text-center align-middle">
                        <input 
                            className="w-10 text-center rounded bg-black text-white font-bold text-[10px] focus:outline-none focus:ring-2 focus:ring-blue-400"
                            value={label}
                            onChange={(e) => onUpdateEdge(edge.id, 'label', e.target.value)}
                        />
                    </td>

                    {/* Source */}
                    <td className="py-2 px-4 font-bold text-gray-800 align-middle">
                        {edge.data?.sourceLabel}
                    </td>

                    {/* Target */}
                    <td className="py-2 px-4 font-bold text-gray-800 align-middle">
                         {edge.data?.targetLabel}
                    </td>

                    {/* Logic Condition - Editable */}
                    <td className="py-2 px-4 align-middle">
                        <div className="flex items-center w-full">
                             {!isAlways && (
                                <span className="text-gray-400 select-none mr-1.5 font-sans italic text-[10px]">if</span> 
                             )}
                             <input 
                                className={`
                                    bg-transparent w-full focus:outline-none focus:bg-white focus:ring-1 focus:ring-blue-200 rounded px-1 py-0.5
                                    ${isAlways ? 'text-gray-500 italic font-sans' : 'text-blue-700 font-bold'}
                                `}
                                value={isAlways ? '(Next Clock - Unconditional)' : condition}
                                placeholder="Enter condition..."
                                onChange={(e) => onUpdateEdge(edge.id, 'condition', e.target.value)}
                                // If it is "always", clear it on focus to let user type, or handle special rendering
                                onFocus={(e) => {
                                    if(isAlways) onUpdateEdge(edge.id, 'condition', '');
                                }}
                             />
                        </div>
                    </td>

                    {/* Action - Editable */}
                    <td className="py-2 px-4 align-middle">
                        <div className="flex items-center w-full">
                            {action && action !== '-' && (
                                <span className="text-gray-400 select-none mr-1.5 font-sans italic text-[10px]">do</span>
                            )}
                            <input 
                                className="bg-transparent w-full focus:outline-none focus:bg-white focus:ring-1 focus:ring-blue-200 rounded px-1 py-0.5 text-green-700 font-medium"
                                value={action}
                                placeholder="-"
                                onChange={(e) => onUpdateEdge(edge.id, 'action', e.target.value)}
                            />
                        </div>
                    </td>
                  </tr>
                );
            })}
            
            {displayEdges.length === 0 && (
                <tr>
                    <td colSpan={5} className="py-8 text-center text-gray-400 text-sm font-sans">
                        No transitions found. Generate the graph or manually add connections.
                    </td>
                </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default TransitionTable;