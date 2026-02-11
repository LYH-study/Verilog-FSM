import React, { memo } from 'react';
import { Handle, Position, NodeProps, NodeResizer } from 'reactflow';

interface CustomNodeData {
  label: string;
  description?: string;
  isInitial?: boolean;
  // New props for handle interaction
  isConnectMode?: boolean;
  onHandleClick?: (nodeId: string, handleId: string, type: 'source' | 'target') => void;
  selectedHandleId?: string | null; 
}

// Geometry constants for 96px circle (Size increased from 80px)
const SIZE = 96;
const R = SIZE / 2; // Radius = 48
const C = SIZE / 2; // Center = 48

// Helper to calculate position styles for handles at specific angles
const getPos = (angleDeg: number, type: 'source' | 'target') => {
  const rad = (angleDeg * Math.PI) / 180;
  const x = C + R * Math.cos(rad);
  const y = C + R * Math.sin(rad);
  return { left: x, top: y };
};

const CircularNode = memo(({ id, data, isConnectable }: NodeProps<CustomNodeData>) => {
  
  const onHandleClick = (e: React.MouseEvent, handleId: string, type: 'source' | 'target') => {
    e.stopPropagation();
    if (data.isConnectMode && data.onHandleClick) {
        data.onHandleClick(id, handleId, type);
    }
  };

  const getHandleStyle = (handleId: string, x: number | string, y: number | string) => {
    const isSelected = data.selectedHandleId === handleId;
    const isCenter = handleId === 'center';
    
    // Base style
    const style: React.CSSProperties = {
        position: 'absolute',
        left: typeof x === 'number' ? `${x}px` : x,
        top: typeof y === 'number' ? `${y}px` : y,
        transform: 'translate(-50%, -50%)',
        zIndex: 50,
        width: '12px', // Slightly larger hit area
        height: '12px',
        background: 'transparent',
        border: 'none',
        pointerEvents: isCenter ? 'none' : 'all',
        cursor: 'crosshair'
    };

    // Visual dot style (inner div)
    let dotClass = "w-2.5 h-2.5 rounded-full border border-black transition-all duration-300 ";
    
    if (isSelected) {
        dotClass += "bg-blue-600 border-blue-600 scale-150 shadow-[0_0_8px_rgba(37,99,235,0.8)] opacity-100";
    } else if (isCenter) {
        dotClass = "hidden";
    } else {
        // Handles are invisible until hovered or near hover
        dotClass += "bg-white opacity-0 group-hover:opacity-100 hover:bg-blue-200 hover:scale-125 shadow-sm";
    }

    return { style, dotClass };
  };

  // Visual Styles
  const isInitial = data.isInitial;
  
  // Outer Container Style (The main shape)
  // We use a double border effect for Initial states
  const containerStyle = isInitial 
    ? "bg-white border-[3px] border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,0.15)] ring-4 ring-white ring-inset" // Ring creates the double border gap
    : "bg-white border-[2px] border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,0.1)]"; // Standard node

  const nodeSelectedStyle = data.selectedHandleId 
    ? "ring-2 ring-blue-400 ring-offset-2 border-blue-600 shadow-none translate-y-[2px] translate-x-[2px]" // Pressed effect when active
    : "group-hover:-translate-y-0.5 group-hover:-translate-x-0.5 transition-transform"; // Hover lift effect

  const handles = [
      { id: 'top-0', angle: -110, pos: Position.Top },
      { id: 'top',   angle: -90,  pos: Position.Top },
      { id: 'top-1', angle: -70,  pos: Position.Top },
      { id: 'right-0', angle: -20, pos: Position.Right },
      { id: 'right',   angle: 0,   pos: Position.Right },
      { id: 'right-1', angle: 20,  pos: Position.Right },
      { id: 'bottom-0', angle: 70,  pos: Position.Bottom },
      { id: 'bottom',   angle: 90,  pos: Position.Bottom },
      { id: 'bottom-1', angle: 110, pos: Position.Bottom },
      { id: 'left-0', angle: 160, pos: Position.Left },
      { id: 'left',   angle: 180, pos: Position.Left },
      { id: 'left-1', angle: 200, pos: Position.Left },
  ];

  return (
    <div className={`relative group w-24 h-24`}> {/* w-24 = 96px */}
      
      {/* Main Node Body */}
      <div 
        className={`
          absolute inset-0 flex flex-col items-center justify-center text-center
          rounded-full z-10 
          ${containerStyle}
          ${nodeSelectedStyle}
        `}
      >
        <div className="flex flex-col items-center justify-center overflow-hidden w-full px-2 gap-0.5">
            {/* Main Label (IDLE, etc) */}
            <span className="font-serif-academic font-black text-sm text-gray-900 leading-tight break-words max-w-full select-none pointer-events-none uppercase tracking-tight">
                {data.label}
            </span>
            
            {/* Description (Chinese) - Now inside the circle, visually separated */}
            {data.description && (
                <span className="text-[10px] text-gray-500 font-sans font-medium tracking-wide leading-none select-none pointer-events-none mt-1 border-t border-gray-100 pt-0.5 w-3/4">
                    {data.description}
                </span>
            )}
        </div>
      </div>

      {/* Initial State Marker (Triangle or similar) - Optional, but Double Border is usually enough. 
          Let's add a small 'Reset' indicator if it's initial for extra clarity 
      */}
      {isInitial && (
          <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-black text-white text-[8px] px-1.5 py-0.5 rounded-full font-bold tracking-wider shadow-sm z-20 pointer-events-none">
              RST
          </div>
      )}

      {/* CENTER HANDLES FOR AUTOMATIC LAYOUT */}
      <Handle 
        type="source" 
        id="center" 
        position={Position.Right} 
        style={getHandleStyle('center', '50%', '50%').style}
        isConnectable={false}
      />
      <Handle 
        type="target" 
        id="center-t" 
        position={Position.Left} 
        style={getHandleStyle('center', '50%', '50%').style}
        isConnectable={false}
      />

      {/* RIM HANDLES FOR MANUAL */}
      {handles.map(h => {
          const { left, top } = getPos(h.angle, 'source');
          const { style, dotClass } = getHandleStyle(h.id, left, top);
          const targetId = `${h.id}-t`;

          return (
            <React.Fragment key={h.id}>
                <Handle 
                    type="source" 
                    position={h.pos} 
                    id={h.id} 
                    isConnectable={isConnectable}
                    style={style}
                    onClick={(e) => onHandleClick(e, h.id, 'source')}
                >
                    <div className={dotClass} />
                </Handle>
                <Handle 
                    type="target" 
                    position={h.pos} 
                    id={targetId} 
                    isConnectable={isConnectable}
                    style={{ ...style, visibility: 'hidden', pointerEvents: 'none' }} 
                />
            </React.Fragment>
          );
      })}
    </div>
  );
});

const GroupNode = memo(({ id, data, selected }: NodeProps<CustomNodeData>) => {
    return (
        <>
            <NodeResizer 
                isVisible={selected} 
                minWidth={100} 
                minHeight={100} 
                lineStyle={{ border: '1px solid #2563eb' }}
                handleStyle={{ width: 8, height: 8, borderRadius: 2 }}
            />
            <div className={`
                h-full w-full rounded-lg border-2 border-dashed transition-colors
                ${selected ? 'border-blue-400 bg-blue-50/30' : 'border-gray-300 bg-gray-50/30'}
            `}>
                <div className="absolute -top-6 left-0 px-2 py-1 bg-gray-100 rounded text-[10px] font-bold text-gray-500 uppercase tracking-widest border border-gray-200">
                    {data.label || 'Group'}
                </div>
            </div>
        </>
    );
});

export const nodeTypes = {
  circular: CircularNode,
  group: GroupNode,
};