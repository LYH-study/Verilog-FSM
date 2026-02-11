import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNodesState, useEdgesState, addEdge, Connection, Edge, MarkerType, OnSelectionChangeParams, Node } from 'reactflow';
import { Play, RotateCcw, Trash2, MousePointer2, Network, Wand2, Undo, Redo, Spline, Minus, BoxSelect, Ungroup, HelpCircle } from 'lucide-react';
import CodeEditor from './components/CodeEditor';
import FSMCanvas from './components/FSMCanvas';
import TransitionTable from './components/TransitionTable';
import { PropertiesPanel } from './components/PropertiesPanel';
import WelcomeGuide from './components/WelcomeGuide';
import { parseVerilogWithGemini } from './services/geminiService';
import { getRadialLayoutElements } from './utils/layout';
import { INITIAL_VERILOG_CODE } from './constants';
import { FSMData } from './types';

// Storage Keys
const STORAGE_KEY_CODE = 'verilog_fsm_code';
const STORAGE_KEY_EDGES_PREFIX = 'verilog_fsm_manual_edges_';

function App() {
  const [code, setCode] = useState<string>(INITIAL_VERILOG_CODE);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Connect Mode state
  const [isConnectMode, setIsConnectMode] = useState(true);
  
  // Edge Style State (Curved vs Straight) - Defaults to Curved
  const [isCurved, setIsCurved] = useState(true);

  // Default Edge Width for new edges and global resets
  const [defaultEdgeWidth, setDefaultEdgeWidth] = useState(2);

  // Click-to-Connect State (Specific Handles)
  const [sourceSelection, setSourceSelection] = useState<{ nodeId: string, handleId: string } | null>(null);

  // Track selected items
  const [selectedEdgeIds, setSelectedEdgeIds] = useState<string[]>([]);
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);

  // INTERACTION STATE
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  // --- HISTORY STATE (UNDO/REDO) ---
  const [past, setPast] = useState<{nodes: Node[], edges: Edge[]}[]>([]);
  const [future, setFuture] = useState<{nodes: Node[], edges: Edge[]}[]>([]);

  const [currentFSMData, setCurrentFSMData] = useState<FSMData | null>(null);

  // --- WELCOME GUIDE STATE ---
  const [showWelcome, setShowWelcome] = useState(false);

  useEffect(() => {
    const hasSeenGuide = localStorage.getItem('verilog_fsm_guide_seen');
    if (!hasSeenGuide) {
        setShowWelcome(true);
    }
  }, []);

  useEffect(() => {
    const savedCode = localStorage.getItem(STORAGE_KEY_CODE);
    if (savedCode) {
        setCode(savedCode);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_CODE, code);
  }, [code]);

  // Persist Manual Edges whenever they change
  useEffect(() => {
    if (currentFSMData?.moduleName) {
        // Save manual edges to local storage
        const manualEdges = edges.filter(e => e.data?.isManual && e.type !== 'radial'); // Don't save auto-radial edges as manual
        const key = `${STORAGE_KEY_EDGES_PREFIX}${currentFSMData.moduleName}`;
        localStorage.setItem(key, JSON.stringify(manualEdges));
    }
  }, [edges, currentFSMData]);

  // Clear click-connection state when switching modes
  useEffect(() => {
    if (!isConnectMode) {
        setSourceSelection(null);
    }
  }, [isConnectMode]);

  // --- UNDO / REDO LOGIC ---

  const takeSnapshot = useCallback(() => {
    setPast((prev) => [...prev, { nodes, edges }]);
    setFuture([]); // Clear future on new action
  }, [nodes, edges]);

  const undo = useCallback(() => {
    if (past.length === 0) return;

    const previousState = past[past.length - 1];
    const newPast = past.slice(0, past.length - 1);

    setFuture((prev) => [{ nodes, edges }, ...prev]);
    setPast(newPast);

    setNodes(previousState.nodes);
    setEdges(previousState.edges);
  }, [past, nodes, edges, setNodes, setEdges]);

  const redo = useCallback(() => {
    if (future.length === 0) return;

    const nextState = future[0];
    const newFuture = future.slice(1);

    setPast((prev) => [...prev, { nodes, edges }]);
    setFuture(newFuture);

    setNodes(nextState.nodes);
    setEdges(nextState.edges);
  }, [future, nodes, edges, setNodes, setEdges]);

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        // Ignore if focus is on inputs
        if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) return;

        if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
            e.preventDefault();
            if (e.shiftKey) {
                redo();
            } else {
                undo();
            }
        }
        
        if ((e.metaKey || e.ctrlKey) && (e.key === 'y')) {
            e.preventDefault();
            redo();
        }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]);


  // --- GROUPING LOGIC ---
  const handleGroupNodes = useCallback(() => {
      // Filter out existing groups from selection
      const nodesToGroup = nodes.filter(n => selectedNodeIds.includes(n.id) && n.type !== 'group' && !n.parentNode);
      
      if (nodesToGroup.length < 2) return; // Need at least 2 nodes

      takeSnapshot();

      // 1. Calculate Bounding Box
      const minX = Math.min(...nodesToGroup.map(n => n.position.x));
      const maxX = Math.max(...nodesToGroup.map(n => n.position.x + (n.width || 96)));
      const minY = Math.min(...nodesToGroup.map(n => n.position.y));
      const maxY = Math.max(...nodesToGroup.map(n => n.position.y + (n.height || 96)));

      const PADDING = 40;
      const groupX = minX - PADDING;
      const groupY = minY - PADDING;
      const groupWidth = (maxX - minX) + (PADDING * 2);
      const groupHeight = (maxY - minY) + (PADDING * 2);

      const groupId = `group-${Date.now()}`;

      // 2. Create Group Node
      const groupNode: Node = {
          id: groupId,
          type: 'group',
          position: { x: groupX, y: groupY },
          data: { label: 'Cluster' },
          style: { width: groupWidth, height: groupHeight, zIndex: -1 },
      };

      // 3. Update Children (Make relative to parent)
      const updatedChildren = nodesToGroup.map(node => ({
          ...node,
          parentNode: groupId,
          extent: 'parent' as const,
          position: {
              x: node.position.x - groupX,
              y: node.position.y - groupY
          },
          selected: false // Deselect children so we see the group
      }));

      // 4. Update State
      const otherNodes = nodes.filter(n => !selectedNodeIds.includes(n.id));
      setNodes([...otherNodes, groupNode, ...updatedChildren]);
      
  }, [nodes, selectedNodeIds, takeSnapshot, setNodes]);

  const handleUngroupNodes = useCallback(() => {
      // Find selected groups
      const selectedGroups = nodes.filter(n => selectedNodeIds.includes(n.id) && n.type === 'group');
      if (selectedGroups.length === 0) return;

      takeSnapshot();

      let newNodes = [...nodes];

      selectedGroups.forEach(group => {
          // Find children
          const children = newNodes.filter(n => n.parentNode === group.id);
          
          // Convert children back to absolute positions
          const restoredChildren = children.map(child => ({
              ...child,
              parentNode: undefined,
              extent: undefined,
              position: {
                  x: group.position.x + child.position.x,
                  y: group.position.y + child.position.y
              }
          }));

          // Remove group and old children, add restored children
          newNodes = newNodes.filter(n => n.id !== group.id && n.parentNode !== group.id);
          newNodes.push(...restoredChildren);
      });

      setNodes(newNodes);

  }, [nodes, selectedNodeIds, takeSnapshot, setNodes]);


  // --- EDGE STYLE MANAGEMENT ---
  const handleSetEdgeStyle = (useCurve: boolean) => {
    setIsCurved(useCurve);
    if (selectedEdgeIds.length > 0) {
        takeSnapshot();
        setEdges((eds) => eds.map(e => {
            if (!selectedEdgeIds.includes(e.id)) return e;
            if (e.type === 'radial') {
                return { ...e, data: { ...e.data, isStraight: !useCurve } };
            }
            if (e.data?.isManual && e.type !== 'radial' && e.type !== 'draggable' && e.type !== 'stub') {
                return { ...e, type: useCurve ? 'default' : 'straight' };
            }
            return e;
        }));
    }
  };

  const handleSetEdgeWidth = (width: number) => {
    takeSnapshot();
    if (selectedEdgeIds.length > 0) {
        // Update selected only
        setEdges((eds) => eds.map(e => {
            if (selectedEdgeIds.includes(e.id)) {
                return { 
                    ...e, 
                    style: { ...e.style, strokeWidth: width } 
                };
            }
            return e;
        }));
    } else {
        // Update global default AND all existing edges (Global mode)
        setDefaultEdgeWidth(width);
        setEdges((eds) => eds.map(e => ({
            ...e,
            style: { ...e.style, strokeWidth: width }
        })));
    }
  };


  // --- DYNAMIC VISUAL CALCULATIONS ---
  const { displayNodes, displayEdges } = useMemo(() => {
    if (!hoveredNodeId) {
        const updatedNodes = nodes.map((node) => ({
            ...node,
            style: { ...node.style, opacity: 1 },
            data: {
                ...node.data,
                isConnectMode: isConnectMode,
                onHandleClick: handleHandleClick,
                selectedHandleId: (sourceSelection?.nodeId === node.id) ? sourceSelection.handleId : null
            }
        }));
        
        const updatedEdges = edges.map(edge => ({
            ...edge,
            style: { ...edge.style, opacity: 1, stroke: edge.selected ? '#2563eb' : '#000000' },
            animated: false
        }));

        return { displayNodes: updatedNodes, displayEdges: updatedEdges };
    }

    const neighborIds = new Set<string>();
    const connectedEdgeIds = new Set<string>();

    edges.forEach(edge => {
        if (edge.source === hoveredNodeId) {
            neighborIds.add(edge.target);
            connectedEdgeIds.add(edge.id);
        } else if (edge.target === hoveredNodeId) {
            neighborIds.add(edge.source);
            connectedEdgeIds.add(edge.id);
        }
    });

    const updatedNodes = nodes.map((node) => {
        const isHighlight = node.id === hoveredNodeId || neighborIds.has(node.id) || node.type === 'group'; // Keep groups visible
        return {
            ...node,
            style: { 
                ...node.style, 
                opacity: isHighlight ? 1 : 0.2, 
                transition: 'opacity 0.2s ease-in-out'
            },
            data: {
                ...node.data,
                isConnectMode: isConnectMode,
                onHandleClick: handleHandleClick,
                selectedHandleId: (sourceSelection?.nodeId === node.id) ? sourceSelection.handleId : null
            }
        };
    });

    const updatedEdges = edges.map(edge => {
        const isConnected = connectedEdgeIds.has(edge.id);
        const currentWidth = Number(edge.style?.strokeWidth ?? 2);
        const highlightWidth = currentWidth + 1; // Slightly thicker on hover highlight

        return {
            ...edge,
            style: { 
                ...edge.style, 
                opacity: isConnected ? 1 : 0.1, 
                stroke: isConnected ? '#2563eb' : '#000000', 
                strokeWidth: isConnected ? highlightWidth : 1, // Dimmed edges become thin
                transition: 'all 0.2s ease-in-out'
            },
            animated: isConnected && edge.source === hoveredNodeId,
            zIndex: isConnected ? 999 : 0
        };
    });

    return { displayNodes: updatedNodes, displayEdges: updatedEdges };

  }, [nodes, edges, hoveredNodeId, isConnectMode, sourceSelection]);


  // Handler Definitions
  function handleHandleClick(nodeId: string, handleId: string, type: 'source' | 'target') {
    if (!isConnectMode) return;
    if (sourceSelection === null) {
        setSourceSelection({ nodeId, handleId });
    } else {
        const sourceNode = nodes.find(n => n.id === sourceSelection.nodeId);
        const targetNode = nodes.find(n => n.id === nodeId);

        if (sourceNode && targetNode) {
            const targetHandleId = `${handleId}-t`;
            takeSnapshot();
            createManualEdge(
                sourceSelection.nodeId, 
                nodeId, 
                sourceSelection.handleId, 
                targetHandleId, 
                sourceNode, 
                targetNode
            );
        }
        setSourceSelection(null);
    }
  }

  const updateGraph = (data: FSMData) => {
    setCurrentFSMData(data);
    const { nodes: layoutedNodes, edges: layoutedEdges } = getRadialLayoutElements(data);
    const processedEdges = layoutedEdges.map(e => {
        if (e.type === 'radial') {
             return { 
                 ...e, 
                 style: { ...e.style, strokeWidth: defaultEdgeWidth }, // Use user preferred default
                 data: { ...e.data, isStraight: false }
             };
        }
        return e;
    });
    setIsCurved(true);
    const preparedNodes = layoutedNodes.map(n => ({
        ...n,
        data: { ...n.data, isConnectMode: true, onHandleClick: handleHandleClick }
    }));
    setPast([]);
    setFuture([]);
    setNodes(preparedNodes);
    setEdges(processedEdges); 
    setIsConnectMode(false); 
  };

  const handleVisualize = async () => {
    if (!code.trim()) return;
    setIsProcessing(true);
    setError(null);
    try {
      const data = await parseVerilogWithGemini(code);
      updateGraph(data);
    } catch (err) {
      setError("Parsing Failed. Check your API Key or Network.");
      console.error(err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAutoWire = useCallback(() => {
    if (!currentFSMData) return;
    takeSnapshot();
    const { nodes: autoNodes, edges: autoEdges } = getRadialLayoutElements(currentFSMData);
    const processedEdges = autoEdges.map(e => {
        if (e.type === 'radial') {
             return { 
                 ...e, 
                 style: { ...e.style, strokeWidth: defaultEdgeWidth },
                 data: { ...e.data, isStraight: false }
             };
        }
        return e;
    });
    setIsCurved(true);
    const nodesWithHandlers = autoNodes.map(n => ({
        ...n,
        data: {
            ...n.data,
            isConnectMode: isConnectMode,
            onHandleClick: handleHandleClick,
            selectedHandleId: null
        }
    }));
    setNodes(nodesWithHandlers);
    setEdges(processedEdges);
    setIsConnectMode(false); 
  }, [currentFSMData, isConnectMode, takeSnapshot, defaultEdgeWidth, setNodes, setEdges]);


  const handleDeleteSelected = useCallback(() => {
    if (selectedEdgeIds.length === 0 && selectedNodeIds.length === 0) return;
    takeSnapshot();
    setEdges((eds) => eds.filter((e) => !selectedEdgeIds.includes(e.id)));
    setNodes((nds) => nds.filter((n) => !selectedNodeIds.includes(n.id)));

    setSelectedEdgeIds([]);
    setSelectedNodeIds([]); 
  }, [selectedEdgeIds, selectedNodeIds, setEdges, setNodes, takeSnapshot]);

  const handleEdgeUpdate = useCallback((edgeId: string, field: string, value: any) => {
    setEdges((eds) => eds.map((e) => {
      if (e.id === edgeId) {
        if (field === 'label') {
             return { ...e, label: value, data: { ...e.data, id: value } };
        }
        if (field === 'strokeWidth') {
            return { ...e, style: { ...e.style, strokeWidth: value } };
        }
        return { ...e, data: { ...e.data, [field]: value } };
      }
      return e;
    }));
  }, [setEdges]);

  const handleNodeUpdate = useCallback((nodeId: string, field: string, value: any) => {
      setNodes((nds) => nds.map((n) => {
          if (n.id === nodeId) {
              return { 
                  ...n, 
                  data: { ...n.data, [field]: value }
              };
          }
          return n;
      }));
  }, [setNodes]);

  const onSelectionChange = useCallback((params: OnSelectionChangeParams) => {
    setSelectedEdgeIds(params.edges.map((e) => e.id));
    setSelectedNodeIds(params.nodes.map((n) => n.id));
  }, []);

  const createManualEdge = (sourceId: string, targetId: string, sourceHandle: string | null, targetHandle: string | null, sourceNode: any, targetNode: any) => {
    const newEdge: Edge = {
        id: `manual_${Date.now()}`,
        source: sourceId,
        target: targetId,
        sourceHandle: sourceHandle,
        targetHandle: targetHandle,
        type: isCurved ? 'default' : 'straight', 
        animated: false, 
        label: '?', 
        style: { stroke: '#000000', strokeWidth: defaultEdgeWidth },
        markerEnd: { type: MarkerType.ArrowClosed, color: '#000000', width: 12, height: 12 },
        zIndex: 10, 
        data: { 
            id: '?',
            isManual: true,
            sourceLabel: sourceNode?.data?.label,
            targetLabel: targetNode?.data?.label,
            condition: '?', 
            action: '-',
            offset: 0 
        }
    };
    setEdges((eds) => addEdge(newEdge, eds));
  };

  const onConnect = useCallback((params: Connection) => {
    const sourceNode = nodes.find(n => n.id === params.source);
    const targetNode = nodes.find(n => n.id === params.target);
    takeSnapshot();
    createManualEdge(params.source!, params.target!, params.sourceHandle!, params.targetHandle!, sourceNode, targetNode);
  }, [setEdges, nodes, takeSnapshot, isCurved, defaultEdgeWidth]);


  const handlePaneClick = useCallback(() => {
    if (sourceSelection) {
        setSourceSelection(null);
    }
  }, [sourceSelection]);

  const onNodeMouseEnter = useCallback((event: React.MouseEvent, node: Node) => {
    setHoveredNodeId(node.id);
  }, []);

  const onNodeMouseLeave = useCallback((event: React.MouseEvent, node: Node) => {
    setHoveredNodeId(null);
  }, []);

  // Determine if we can group or ungroup
  const canGroup = selectedNodeIds.length >= 2 && !selectedNodeIds.some(id => nodes.find(n => n.id === id)?.type === 'group');
  const canUngroup = selectedNodeIds.some(id => nodes.find(n => n.id === id)?.type === 'group');
  
  const activeWidth = useMemo(() => {
    if (selectedEdgeIds.length > 0) {
        const firstSelected = edges.find(e => e.id === selectedEdgeIds[0]);
        if (firstSelected && firstSelected.style?.strokeWidth) {
            return Number(firstSelected.style.strokeWidth);
        }
        return null;
    }
    return defaultEdgeWidth;
  }, [selectedEdgeIds, edges, defaultEdgeWidth]);
  
  const selectedSingleNode = useMemo(() => {
      if (selectedNodeIds.length === 1) return nodes.find(n => n.id === selectedNodeIds[0]);
      return undefined;
  }, [selectedNodeIds, nodes]);

  const selectedSingleEdge = useMemo(() => {
      if (selectedEdgeIds.length === 1) return edges.find(e => e.id === selectedEdgeIds[0]);
      return undefined;
  }, [selectedEdgeIds, edges]);

  const showInspector = selectedSingleNode || selectedSingleEdge;

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-gray-50">
      <WelcomeGuide isOpen={showWelcome} onClose={() => setShowWelcome(false)} />
      
      <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-6 shrink-0 z-20 relative shadow-sm">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 bg-black flex items-center justify-center rounded text-white font-serif-academic font-bold text-lg">
            V
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900 leading-tight">Verilog FSM Visualizer</h1>
            <p className="text-[10px] text-gray-500 uppercase tracking-widest font-medium">Blueprint Workshop</p>
          </div>
        </div>

        {/* Center: Mode Toggle Switch */}
        <div className="absolute left-1/2 transform -translate-x-1/2 flex items-center gap-4">
             <div className="flex items-center bg-gray-100 p-1 rounded-lg border border-gray-200">
                <button
                    onClick={() => setIsConnectMode(true)}
                    className={`
                        flex items-center gap-2 px-4 py-1.5 rounded-md text-xs font-bold transition-all
                        ${isConnectMode 
                            ? 'bg-blue-600 text-white shadow-sm' 
                            : 'text-gray-500 hover:text-gray-900'
                        }
                    `}
                >
                    <Network size={14} />
                    Connect
                </button>
                <button
                    onClick={() => setIsConnectMode(false)}
                    className={`
                        flex items-center gap-2 px-4 py-1.5 rounded-md text-xs font-bold transition-all
                        ${!isConnectMode 
                            ? 'bg-white text-black shadow-sm' 
                            : 'text-gray-500 hover:text-gray-900'
                        }
                    `}
                >
                    <MousePointer2 size={14} />
                    Move
                </button>
            </div>
        </div>

        <div className="flex items-center gap-4">
             {error && (
                <span className="text-red-600 text-xs font-medium bg-red-50 px-3 py-1 rounded border border-red-200">
                    {error}
                </span>
            )}
            
            {/* Help Button */}
            <button
                onClick={() => setShowWelcome(true)}
                className="text-gray-400 hover:text-gray-700 transition-colors"
                title="Help Guide"
            >
                <HelpCircle size={18} />
            </button>

            {nodes.length > 0 && (
                <div className="flex items-center bg-gray-100 rounded p-1 gap-1">
                     <button
                        onClick={undo}
                        disabled={past.length === 0}
                        className={`
                            flex items-center justify-center w-8 h-8 rounded hover:bg-white hover:shadow-sm transition-all
                            ${past.length === 0 ? 'text-gray-300' : 'text-gray-700'}
                        `}
                        title="Undo (Ctrl+Z)"
                     >
                        <Undo size={14} />
                     </button>
                     <button
                        onClick={redo}
                        disabled={future.length === 0}
                        className={`
                            flex items-center justify-center w-8 h-8 rounded hover:bg-white hover:shadow-sm transition-all
                            ${future.length === 0 ? 'text-gray-300' : 'text-gray-700'}
                        `}
                        title="Redo (Ctrl+Y)"
                     >
                        <Redo size={14} />
                     </button>

                     <div className="w-px h-4 bg-gray-300 mx-1"></div>
                     
                     {/* GROUPING BUTTONS */}
                     <button
                        onClick={handleGroupNodes}
                        disabled={!canGroup}
                        className={`
                            flex items-center justify-center w-8 h-8 rounded hover:bg-white hover:shadow-sm transition-all
                            ${!canGroup ? 'text-gray-300' : 'text-blue-600'}
                        `}
                        title="Group Selected Nodes (Cluster)"
                     >
                         <BoxSelect size={14} />
                     </button>
                     <button
                        onClick={handleUngroupNodes}
                        disabled={!canUngroup}
                        className={`
                            flex items-center justify-center w-8 h-8 rounded hover:bg-white hover:shadow-sm transition-all
                            ${!canUngroup ? 'text-gray-300' : 'text-blue-600'}
                        `}
                        title="Ungroup Selected"
                     >
                         <Ungroup size={14} />
                     </button>

                     <div className="w-px h-4 bg-gray-300 mx-1"></div>

                     {/* EDGE STYLE TOGGLE GROUP */}
                     <div className="flex items-center bg-gray-200 rounded p-0.5">
                         <button
                            onClick={() => handleSetEdgeStyle(true)}
                            className={`
                                flex items-center justify-center w-7 h-7 rounded transition-all
                                ${isCurved 
                                    ? 'bg-white text-blue-600 shadow-sm' 
                                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                                }
                            `}
                            title="Curved Lines"
                         >
                            <Spline size={16} />
                         </button>
                         <button
                            onClick={() => handleSetEdgeStyle(false)}
                            className={`
                                flex items-center justify-center w-7 h-7 rounded transition-all
                                ${!isCurved 
                                    ? 'bg-white text-blue-600 shadow-sm' 
                                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                                }
                            `}
                            title="Straight Lines"
                         >
                            <Minus size={16} className="rotate-[-45deg]" />
                         </button>
                     </div>

                     <div className="w-px h-4 bg-gray-300 mx-1"></div>

                     {/* EDGE WIDTH CONTROLS (Global / Selection) */}
                     <div className="flex items-center bg-gray-200 rounded p-0.5 gap-0.5">
                         <button 
                            onClick={() => handleSetEdgeWidth(1)} 
                            title="Thin (1px)" 
                            className={`
                                w-7 h-7 flex items-center justify-center rounded transition-all 
                                ${activeWidth === 1 ? 'bg-white shadow-sm ring-1 ring-gray-200' : 'hover:bg-gray-100 text-gray-400'}
                            `}
                         >
                            <div className={`w-3 h-[1px] ${activeWidth === 1 ? 'bg-blue-600' : 'bg-gray-600'}`}></div>
                         </button>
                         <button 
                            onClick={() => handleSetEdgeWidth(2)} 
                            title="Normal (2px)" 
                            className={`
                                w-7 h-7 flex items-center justify-center rounded transition-all 
                                ${activeWidth === 2 ? 'bg-white shadow-sm ring-1 ring-gray-200' : 'hover:bg-gray-100 text-gray-400'}
                            `}
                         >
                            <div className={`w-3 h-[2px] ${activeWidth === 2 ? 'bg-blue-600' : 'bg-gray-600'}`}></div>
                         </button>
                         <button 
                            onClick={() => handleSetEdgeWidth(4)} 
                            title="Thick (4px)" 
                            className={`
                                w-7 h-7 flex items-center justify-center rounded transition-all 
                                ${activeWidth === 4 ? 'bg-white shadow-sm ring-1 ring-gray-200' : 'hover:bg-gray-100 text-gray-400'}
                            `}
                         >
                            <div className={`w-3 h-[4px] ${activeWidth === 4 ? 'bg-blue-600' : 'bg-gray-600'}`}></div>
                         </button>
                     </div>

                     <div className="w-px h-4 bg-gray-300 mx-1"></div>

                     <button
                        onClick={handleDeleteSelected}
                        disabled={selectedEdgeIds.length === 0 && selectedNodeIds.length === 0}
                        className={`
                            flex items-center gap-2 px-3 py-1.5 text-xs font-bold uppercase tracking-wider rounded border transition-all
                            ${selectedEdgeIds.length > 0 || selectedNodeIds.length > 0
                                ? 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100 cursor-pointer'
                                : 'bg-transparent text-gray-400 border-transparent cursor-default'
                            }
                        `}
                        title="Delete Selected"
                    >
                        <Trash2 size={14} />
                        <span>Delete</span>
                    </button>

                    <div className="w-px h-4 bg-gray-300 mx-1"></div>

                    {/* AUTO WIRE: RADIAL LAYOUT */}
                    <button
                        onClick={handleAutoWire}
                        className="flex items-center gap-2 px-3 py-1.5 text-xs font-bold uppercase tracking-wider rounded border border-purple-200 bg-purple-50 text-purple-700 hover:bg-purple-100 transition-all"
                        title="Reset to Auto Layout (Default: Curved)"
                    >
                        <Wand2 size={14} />
                        <span>Auto</span>
                    </button>
                </div>
            )}
            
            <button
                onClick={() => setCode(INITIAL_VERILOG_CODE)}
                className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-gray-600 hover:text-gray-900 transition-colors"
                title="Reset to Example"
            >
                <RotateCcw size={14} />
                <span>Reset</span>
            </button>

            <button
                onClick={handleVisualize}
                disabled={isProcessing}
                className={`
                    flex items-center gap-2 px-5 py-2 text-sm font-bold tracking-wide uppercase transition-all
                    ${isProcessing 
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed border-2 border-gray-200' 
                        : 'bg-black text-white hover:bg-gray-800 shadow-[3px_3px_0px_0px_rgba(0,0,0,0.2)] hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,0.2)] hover:translate-x-[1px] hover:translate-y-[1px]'
                    }
                `}
            >
                <Play size={16} fill={isProcessing ? "none" : "currentColor"} />
                {isProcessing ? 'Thinking...' : 'Generate'}
            </button>
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden">
        <div className="w-[35%] h-full border-r border-gray-200 flex flex-col shrink-0">
          <CodeEditor 
            code={code} 
            onChange={setCode} 
            isProcessing={isProcessing} 
          />
        </div>

        {/* RIGHT SIDE CONTAINER: Canvas + Table + Inspector */}
        <div className="w-[65%] h-full bg-white relative flex flex-row">
            
            {/* CANVAS + TABLE COLUMN */}
            <div className="flex-1 flex flex-col h-full relative min-w-0">
                <div className="flex-1 w-full relative border-b border-gray-200">
                     {/* CLICK TO CONNECT OVERLAY INSTRUCTION */}
                     {isConnectMode && sourceSelection && (
                        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-50 pointer-events-none">
                            <div className="bg-blue-600 text-white px-4 py-2 rounded-full shadow-lg flex items-center gap-2 animate-bounce">
                                <MousePointer2 size={16} />
                                <span className="text-xs font-bold tracking-wide">
                                    Select Target Point
                                </span>
                            </div>
                            <div className="text-center mt-2">
                                <span className="text-[10px] text-gray-500 bg-white/80 px-2 py-0.5 rounded border">Click background to cancel</span>
                            </div>
                        </div>
                     )}
                     
                     <FSMCanvas 
                        nodes={displayNodes} 
                        edges={displayEdges} 
                        onNodesChange={onNodesChange} 
                        onEdgesChange={onEdgesChange} 
                        onConnect={onConnect}
                        onSelectionChange={onSelectionChange}
                        isConnectMode={isConnectMode}
                        onPaneClick={handlePaneClick}
                        onNodeMouseEnter={onNodeMouseEnter}
                        onNodeMouseLeave={onNodeMouseLeave}
                    />
                </div>
                
                <div className="h-[35%] w-full overflow-hidden shrink-0">
                    <TransitionTable edges={edges} onUpdateEdge={handleEdgeUpdate} />
                </div>
            </div>

            {/* INSPECTOR COLUMN (Conditional) */}
            {showInspector && (
                <div className="w-80 h-full border-l border-gray-200 shrink-0 bg-white z-20 shadow-[-4px_0px_15px_-3px_rgba(0,0,0,0.1)]">
                    <PropertiesPanel 
                        selectedNode={selectedSingleNode} 
                        selectedEdge={selectedSingleEdge} 
                        onUpdateNode={handleNodeUpdate} 
                        onUpdateEdge={handleEdgeUpdate}
                    />
                </div>
            )}
        </div>
      </main>
    </div>
  );
}

export default App;