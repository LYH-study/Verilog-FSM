import React from 'react';
import { 
  BaseEdge, 
  EdgeProps, 
  getSmoothStepPath, 
  getBezierPath,
  EdgeLabelRenderer, 
  useReactFlow,
  Position
} from 'reactflow';

// --- MATH HELPERS ---
const NODE_RADIUS = 48; // Matches 96px Node Diameter

const normalize = (x: number, y: number) => {
    const len = Math.sqrt(x*x + y*y);
    return len === 0 ? {x:0, y:0} : {x: x/len, y: y/len};
};

// Calculate point on circle edge given center and target/direction point
const getPointOnCircle = (centerX: number, centerY: number, targetX: number, targetY: number) => {
    const dx = targetX - centerX;
    const dy = targetY - centerY;
    const {x: nx, y: ny} = normalize(dx, dy);
    return {
        x: centerX + nx * NODE_RADIUS,
        y: centerY + ny * NODE_RADIUS
    };
};

// Helper to get curvature offset for parallel edges
const getMultiEdgeCurvatureOffset = (index: number, count: number, spacing: number = 50) => {
    if (count <= 1) return 0;
    const centeredIndex = index - (count - 1) / 2;
    return centeredIndex * spacing;
};

// --- RADIAL EDGE (Hub & Spoke / Rim Logic) ---
export const RadialEdge = ({
    id,
    sourceX,
    sourceY,
    targetX,
    targetY,
    style = {},
    markerEnd,
    label,
    labelStyle,
    labelBgStyle,
    labelBgPadding,
    labelBgBorderRadius,
    selected,
    data
}: EdgeProps) => {
    
    if (sourceX === undefined || sourceY === undefined || targetX === undefined || targetY === undefined) {
        return null;
    }

    let path = '';
    let labelX = 0;
    let labelY = 0;

    const { 
        isSelfLoop, 
        siblingCount = 1, 
        siblingIndex = 0,
        isStraight = false 
    } = data || {};

    const curvatureOffset = getMultiEdgeCurvatureOffset(siblingIndex, siblingCount);

    // Dynamic Width Calculation
    // Use the strokeWidth from style, or default to 2
    const baseWidth = Number(style.strokeWidth ?? 2);
    // When selected, make it slightly thicker for visibility
    const displayWidth = selected ? baseWidth + 1.5 : baseWidth;

    if (isSelfLoop) {
        // --- SELF LOOP ---
        const {x: nx, y: ny} = normalize(sourceX, sourceY);
        const LOOP_SIZE = 70 + (siblingIndex * 15); 
        const OFFSET_ANGLE = 0.6; 

        const cosA = Math.cos(OFFSET_ANGLE);
        const sinA = Math.sin(OFFSET_ANGLE);
        
        const sx = nx * cosA + ny * sinA;
        const sy = -nx * sinA + ny * cosA;
        
        const ex = nx * cosA - ny * sinA;
        const ey = nx * sinA + ny * cosA;

        const startX = sourceX + sx * NODE_RADIUS;
        const startY = sourceY + sy * NODE_RADIUS;
        const endX = sourceX + ex * NODE_RADIUS;
        const endY = sourceY + ey * NODE_RADIUS;

        const c1x = startX + sx * LOOP_SIZE;
        const c1y = startY + sy * LOOP_SIZE;
        const c2x = endX + ex * LOOP_SIZE;
        const c2y = endY + ey * LOOP_SIZE;

        path = `M ${startX} ${startY} C ${c1x} ${c1y} ${c2x} ${c2y} ${endX} ${endY}`;
        
        // Label at t=0.5 of Cubic Bezier
        labelX = 0.125 * startX + 0.375 * c1x + 0.375 * c2x + 0.125 * endX;
        labelY = 0.125 * startY + 0.375 * c1y + 0.375 * c2y + 0.125 * endY;

    } else {
        // --- GENERAL CONNECTION ---
        const start = getPointOnCircle(sourceX, sourceY, targetX, targetY);
        const end = getPointOnCircle(targetX, targetY, sourceX, sourceY);
        
        if (isStraight) {
            // --- STRAIGHT ---
            path = `M ${start.x} ${start.y} L ${end.x} ${end.y}`;
            labelX = (start.x + end.x) / 2;
            labelY = (start.y + end.y) / 2;
        } else {
            // --- CURVED (Quadratic) ---
            const mx = (start.x + end.x) / 2;
            const my = (start.y + end.y) / 2;
            
            const dx = end.x - start.x;
            const dy = end.y - start.y;
            const len = Math.sqrt(dx*dx + dy*dy);
            
            const nx = -dy / len;
            const ny = dx / len;

            // Refined Curvature Logic
            let archHeight = Math.min(80, Math.max(30, len * 0.15));
            
            // Add spacing offset
            archHeight += curvatureOffset;

            const cx = mx + nx * archHeight;
            const cy = my + ny * archHeight;

            path = `M ${start.x} ${start.y} Q ${cx} ${cy} ${end.x} ${end.y}`;
            
            // Label at t=0.5 of Quadratic Bezier
            labelX = 0.25 * start.x + 0.5 * cx + 0.25 * end.x;
            labelY = 0.25 * start.y + 0.5 * cy + 0.25 * end.y;
        }
    }

    // Shadow Style (Depth) - adapts to width
    const shadowStyle: React.CSSProperties = {
        stroke: 'rgba(0,0,0,0.06)',
        strokeWidth: displayWidth + 6,
        fill: 'none',
        pointerEvents: 'none', // Shadow shouldn't block interaction
    };

    return (
        <>
            {/* 1. Shadow Layer for Depth */}
            <path d={path} style={shadowStyle} className="react-flow__edge-path" />
            
            {/* 2. Main Edge Layer */}
            <BaseEdge 
                path={path} 
                markerEnd={markerEnd} 
                style={{
                    ...style, 
                    strokeWidth: displayWidth, 
                    stroke: selected ? '#2563eb' : '#000000',
                    strokeLinecap: 'round' // Smoother ends
                }} 
                label={label}
                labelX={labelX}
                labelY={labelY}
                labelStyle={labelStyle}
                labelShowBg={true}
                labelBgStyle={labelBgStyle}
                labelBgPadding={labelBgPadding}
                labelBgBorderRadius={labelBgBorderRadius}
                interactionWidth={20} // Easier to click
            />
        </>
    );
};

// --- Helper: Custom Bus Path Generator ---
const getBusPath = ({
    sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, offset, borderRadius = 15
}: any): [string, number, number] => {
    
    if (sourceX === undefined || targetX === undefined) return ['', 0, 0];

    if (sourcePosition === Position.Right && targetPosition === Position.Left) {
        const res = getBezierPath({
            sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition
        });
        if (Array.isArray(res)) {
            const [path, labelX, labelY] = res;
            return [path, labelX, labelY];
        }
        return [res as string, (sourceX + targetX)/2, (sourceY + targetY)/2];
    }

    if ((sourcePosition === Position.Top && targetPosition === Position.Top) || 
        (sourcePosition === Position.Bottom && targetPosition === Position.Bottom)) {
        
        const busY = sourceY + offset;
        const dirY = busY < sourceY ? -1 : 1;
        
        const width = Math.abs(targetX - sourceX);
        const r = Math.min(borderRadius, width / 2, Math.abs(busY - sourceY) / 2);
        
        const isLeftToRight = sourceX < targetX;
        const xDir = isLeftToRight ? 1 : -1;
        const safeR = isNaN(r) ? 5 : r;

        const p = [
            `M ${sourceX} ${sourceY}`,
            `L ${sourceX} ${busY - (dirY * safeR)}`, 
            `Q ${sourceX} ${busY} ${sourceX + (xDir * safeR)} ${busY}`,
            `L ${targetX - (xDir * safeR)} ${busY}`,
            `Q ${targetX} ${busY} ${targetX} ${busY - (dirY * safeR)}`,
            `L ${targetX} ${targetY}`
        ];

        const path = p.join(' ');
        const labelX = (sourceX + targetX) / 2;
        const labelY = busY;

        return [path, labelX, labelY];
    }

    const res = getSmoothStepPath({
        sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, borderRadius
    });
    if (Array.isArray(res)) {
        const [path, labelX, labelY] = res;
        return [path, labelX, labelY];
    }
    return [res as string, (sourceX + targetX)/2, (sourceY + targetY)/2];
};

export const StubEdge = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
}: EdgeProps) => {
  const stubLength = 20;

  let sEx = sourceX;
  let sEy = sourceY;
  if (typeof sourceX === 'number' && typeof sourceY === 'number') {
      switch (sourcePosition) {
        case 'right': sEx += stubLength; break;
        case 'left': sEx -= stubLength; break;
        case 'top': sEy -= stubLength; break;
        case 'bottom': sEy += stubLength; break;
      }
  }

  let tSx = targetX;
  let tSy = targetY;
  if (typeof targetX === 'number' && typeof targetY === 'number') {
      switch (targetPosition) {
        case 'right': tSx += stubLength; break;
        case 'left': tSx -= stubLength; break;
        case 'top': tSy -= stubLength; break;
        case 'bottom': tSy += stubLength; break;
      }
  }
  
  return (
    <>
      <path
        id={`${id}_source`}
        style={style}
        className="react-flow__edge-path"
        d={`M ${sourceX},${sourceY} L ${sEx},${sEy}`}
        markerEnd={markerEnd} 
      />
      <path
        id={`${id}_target`}
        style={style}
        className="react-flow__edge-path"
        d={`M ${tSx},${tSy} L ${targetX},${targetY}`}
        markerEnd={markerEnd}
      />
    </>
  );
};

export const DraggableStepEdge = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  label,
  labelStyle,
  labelBgStyle,
  labelBgPadding,
  labelBgBorderRadius,
  data,
  selected
}: EdgeProps) => {
  const { setEdges } = useReactFlow();
  
  const offset = data?.offset ?? 0;

  const [edgePath, labelX, labelY] = getBusPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    offset,
  });

  const handleMouseDown = (event: React.MouseEvent) => {
    event.stopPropagation();
    const startY = event.clientY;
    const startOffset = offset;
    
    const isBus = (sourcePosition === 'top' && targetPosition === 'top') || 
                  (sourcePosition === 'bottom' && targetPosition === 'bottom');

    if (!isBus) return;

    const onMouseMove = (moveEvent: MouseEvent) => {
       const deltaY = moveEvent.clientY - startY;
       setEdges((eds) => eds.map((e) => {
         if (e.id === id) {
           return { ...e, data: { ...e.data, offset: startOffset + deltaY } };
         }
         return e;
       }));
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const showHandle = (sourcePosition === 'top' && targetPosition === 'top') || 
                     (sourcePosition === 'bottom' && targetPosition === 'bottom');

  if (!edgePath) return null;

  // Dynamic Width
  const baseWidth = Number(style.strokeWidth ?? 2);
  const displayWidth = selected ? baseWidth + 1.5 : baseWidth;

  // Shadow Style
  const shadowStyle: React.CSSProperties = {
      stroke: 'rgba(0,0,0,0.06)',
      strokeWidth: displayWidth + 6,
      fill: 'none',
      pointerEvents: 'none',
  };

  return (
    <>
      {/* Shadow Layer */}
      <path d={edgePath} style={shadowStyle} className="react-flow__edge-path" />

      {/* Main Layer */}
      <BaseEdge 
        path={edgePath} 
        markerEnd={markerEnd} 
        style={{...style, strokeWidth: displayWidth, stroke: selected ? '#2563eb' : '#000000'}} 
        label={label}
        labelX={labelX}
        labelY={labelY}
        labelStyle={labelStyle}
        labelShowBg={true}
        labelBgStyle={labelBgStyle}
        labelBgPadding={labelBgPadding}
        labelBgBorderRadius={labelBgBorderRadius}
        interactionWidth={20}
      />
      
      {showHandle && (
        <EdgeLabelRenderer>
            <div
                style={{
                    position: 'absolute',
                    transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
                    pointerEvents: 'all',
                    cursor: 'row-resize',
                    zIndex: 100,
                }}
                className="nodrag nopan group w-8 h-8 flex items-center justify-center"
                onMouseDown={handleMouseDown}
            >
                <div 
                    className={`
                        w-2.5 h-2.5 rounded-full border border-black shadow-sm transition-all duration-200
                        ${selected ? 'bg-blue-600 opacity-100 scale-125' : 'bg-white opacity-0 group-hover:opacity-100 group-hover:bg-blue-200'}
                    `} 
                />
            </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
};