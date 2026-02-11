import { Node, Edge, Position, MarkerType } from 'reactflow';
import dagre from 'dagre';
import { FSMData, NodeType, FSMTransition } from '../types';

// --- HUB DETECTION & RADIAL LAYOUT ALGORITHM ---
// PDF Reference: Section 2 (Centralized Radial Layout)

const getDegree = (nodeId: string, transitions: FSMTransition[]) => {
    return transitions.filter(t => t.source === nodeId || t.target === nodeId).length;
};

export const getRadialLayoutElements = (fsmData: FSMData) => {
    // 1. Identify Hub (Step 1 in PDF)
    // Priority: Label Semantic (IDLE, RESET...) -> Degree Centrality
    let hubId = fsmData.states.find(s => 
        ['IDLE', 'RESET', 'WAIT', 'MAIN', 'ST_IDLE'].includes(s.label.toUpperCase())
    )?.id;

    if (!hubId) {
        const sortedByDegree = [...fsmData.states].sort((a, b) => {
            const degA = getDegree(a.id, fsmData.transitions);
            const degB = getDegree(b.id, fsmData.transitions);
            return degB - degA;
        });
        hubId = sortedByDegree[0]?.id;
    }

    // 2. Rim Sorting (Step 2 in PDF)
    // Extract Subgraph -> Find Longest Path -> Sort
    const rimNodes = fsmData.states.filter(s => s.id !== hubId);
    let sortedRimNodes: typeof rimNodes = [];

    if (rimNodes.length > 0) {
        const visited = new Set<string>();
        
        // Heuristic: Start with a node that the Hub transitions TO (Start of flow)
        const startCandidates = fsmData.transitions
            .filter(t => t.source === hubId && t.target !== hubId)
            .map(t => t.target);
        
        let currentId = startCandidates.find(id => rimNodes.some(n => n.id === id)) || rimNodes[0].id;

        // Greedy Chain Traversal
        while (visited.size < rimNodes.length) {
            // Add current
            if (!visited.has(currentId)) {
                visited.add(currentId);
                const node = rimNodes.find(n => n.id === currentId);
                if (node) sortedRimNodes.push(node);
            }

            // Find next unvisited neighbor (Outgoing preference)
            const neighbors = fsmData.transitions
                .filter(t => t.source === currentId && !visited.has(t.target) && t.target !== hubId)
                .map(t => t.target);
            
            if (neighbors.length > 0) {
                currentId = neighbors[0];
            } else {
                // If dead end, pick any unvisited node
                const unvisited = rimNodes.find(n => !visited.has(n.id));
                if (!unvisited) break;
                currentId = unvisited.id;
            }
        }
    }

    // 3. Positioning (Step 3 in PDF)
    // Hub at (0,0), Rim at Radius R
    // INCREASED RADIUS to 380 to fit 96px nodes better
    const RADIUS = 380;
    const layoutedNodes: Node[] = [];

    // Add Hub
    const hubNodeData = fsmData.states.find(s => s.id === hubId);
    if (hubNodeData) {
        layoutedNodes.push({
            id: hubNodeData.id,
            type: 'circular',
            data: { label: hubNodeData.label, description: hubNodeData.description, isInitial: hubNodeData.type === NodeType.INITIAL },
            position: { x: 0, y: 0 },
            sourcePosition: Position.Right,
            targetPosition: Position.Left,
        });
    }

    // Add Rim Nodes
    sortedRimNodes.forEach((state, index) => {
        const angle = (2 * Math.PI * index) / sortedRimNodes.length;
        // Start from -90deg (Top)
        const finalAngle = angle - (Math.PI / 2);

        layoutedNodes.push({
            id: state.id,
            type: 'circular',
            data: { label: state.label, description: state.description },
            position: { 
                x: RADIUS * Math.cos(finalAngle), 
                y: RADIUS * Math.sin(finalAngle) 
            },
        });
    });

    // 4. Edges with Routing Strategy
    // PRE-PROCESSING: Group edges by Source-Target pair to handle multi-edges
    const edgeGroups: Record<string, number> = {}; // key -> count
    const edgeIndices: Record<string, number> = {}; // edgeId -> index in group

    fsmData.transitions.forEach((trans, i) => {
        const key = `${trans.source}->${trans.target}`;
        if (!edgeGroups[key]) edgeGroups[key] = 0;
        
        // Assign temporary ID for tracking if not present
        const edgeId = `radial_${i}`;
        edgeIndices[edgeId] = edgeGroups[key];
        edgeGroups[key]++;
    });

    const layoutedEdges: Edge[] = fsmData.transitions.map((trans, i) => {
        const numericLabel = (i + 1).toString();
        const isSelfLoop = trans.source === trans.target;
        const isHubConnection = trans.source === hubId || trans.target === hubId;
        
        // Determine Adjacency for Rim-to-Rim
        let isNeighbor = false;
        if (!isHubConnection && !isSelfLoop) {
            const sIdx = sortedRimNodes.findIndex(n => n.id === trans.source);
            const tIdx = sortedRimNodes.findIndex(n => n.id === trans.target);
            if (sIdx !== -1 && tIdx !== -1) {
                const diff = Math.abs(sIdx - tIdx);
                const len = sortedRimNodes.length;
                // Adjacent if diff is 1 or they wrap around (0 and N-1)
                isNeighbor = diff === 1 || diff === len - 1;
            }
        }

        const key = `${trans.source}->${trans.target}`;
        const siblingCount = edgeGroups[key] || 1;
        const siblingIndex = edgeIndices[`radial_${i}`] || 0;

        return {
            id: `radial_${i}_${trans.source}_${trans.target}`,
            source: trans.source,
            target: trans.target,
            type: 'radial', 
            sourceHandle: 'center', // Use center handle for geometry calculation
            targetHandle: 'center-t',
            label: numericLabel,
            labelStyle: { fill: '#ffffff', fontWeight: 700, fontSize: 12 },
            labelBgStyle: { fill: '#000000', fillOpacity: 1, rx: 4, ry: 4 },
            labelBgPadding: [6, 4] as [number, number],
            labelBgBorderRadius: 4,
            style: { stroke: '#000000', strokeWidth: 2 },
            markerEnd: { type: MarkerType.ArrowClosed, color: '#000' },
            zIndex: 100,
            data: {
                isManual: true, // Treat as "permanent" wires
                id: numericLabel,
                sourceLabel: layoutedNodes.find(n => n.id === trans.source)?.data.label,
                targetLabel: layoutedNodes.find(n => n.id === trans.target)?.data.label,
                condition: trans.condition,
                action: trans.action,
                // Layout Logic Props
                isHubConnection,
                isSelfLoop,
                isNeighbor,
                hubId, // Pass hub for geometry
                // Multi-edge props
                siblingCount,
                siblingIndex
            }
        };
    });

    return { nodes: layoutedNodes, edges: layoutedEdges };
};


// --- LEGACY HIERARCHICAL LAYOUT (Sugiyama) ---
export const getAutoLayoutedElements = (fsmData: FSMData) => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));

  dagreGraph.setGraph({ 
    rankdir: 'TB', 
    ranksep: 100, 
    nodesep: 120, 
    edgesep: 50,
  });

  fsmData.states.forEach((state) => {
    dagreGraph.setNode(state.id, { width: 150, height: 100 });
  });

  fsmData.transitions.forEach((trans) => {
    dagreGraph.setEdge(trans.source, trans.target);
  });

  dagre.layout(dagreGraph);

  const layoutedNodes: Node[] = fsmData.states.map((state) => {
    const nodeWithPosition = dagreGraph.node(state.id);
    const x = nodeWithPosition.x - 40; 
    const y = nodeWithPosition.y - 40;

    return {
      id: state.id,
      type: 'circular',
      data: {
        label: state.label || state.id,
        description: state.description,
        isInitial: state.type === NodeType.INITIAL
      },
      position: { x, y },
      targetPosition: Position.Top,
      sourcePosition: Position.Bottom,
    };
  });

  const layoutedEdges: Edge[] = fsmData.transitions.map((trans, i) => {
    const numericLabel = (i + 1).toString();
    const isSelfLoop = trans.source === trans.target;

    let edgeType = 'default';
    let sourceHandle = 'bottom';
    let targetHandle = 'top';
    
    if (isSelfLoop) {
        edgeType = 'default';
        sourceHandle = 'right-0';
        targetHandle = 'top-1-t'; 
    }

    return {
      id: `auto_${i}_${trans.source}_${trans.target}`,
      source: trans.source,
      target: trans.target,
      sourceHandle: sourceHandle,
      targetHandle: targetHandle,
      type: edgeType, 
      label: numericLabel,
      labelStyle: { fill: '#ffffff', fontWeight: 700, fontSize: 12 },
      labelBgStyle: { fill: '#000000', fillOpacity: 1, rx: 4, ry: 4 },
      labelBgPadding: [6, 4] as [number, number],
      labelBgBorderRadius: 4,
      style: { stroke: '#000000', strokeWidth: 2 },
      markerEnd: { type: MarkerType.ArrowClosed, color: '#000' },
      zIndex: 100,
      data: {
          isManual: true, 
          id: numericLabel,
          sourceLabel: layoutedNodes.find(n => n.id === trans.source)?.data.label,
          targetLabel: layoutedNodes.find(n => n.id === trans.target)?.data.label,
          condition: trans.condition,
          action: trans.action,
      }
    };
  });

  return { nodes: layoutedNodes, edges: layoutedEdges };
};

export const getLayoutedElements = (fsmData: FSMData) => {
  const layoutedNodes: Node[] = fsmData.states.map((state, i) => {
    return {
      id: state.id,
      type: 'circular',
      data: { label: state.label, description: state.description, isInitial: state.type === NodeType.INITIAL },
      position: { x: 100 + (i * 250), y: 300 },
    };
  });

  const layoutedEdges = fsmData.transitions.map((trans, i) => ({
      id: `stub_${i}`,
      source: trans.source,
      target: trans.target,
      sourceHandle: 'right',
      targetHandle: 'left-t',
      type: 'stub',
      label: (i+1).toString(),
      data: { id: (i+1).toString(), condition: trans.condition, action: trans.action }
  }));

  return { nodes: layoutedNodes, edges: layoutedEdges };
};