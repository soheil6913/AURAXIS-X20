import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import * as THREE from 'three';
import { RenderStyle } from '../types';
import {
  RotateCcw,
  ZoomIn,
  ZoomOut,
  Compass,
  Layers,
  Eye,
  Crosshair,
  Move,
  RefreshCw,
  AlertCircle,
  Flame,
  Activity
} from 'lucide-react';

export type DepthSliceMode = 'cut' | 'band' | 'plane';
export type HeatmapPalette = 'spectral' | 'inferno' | 'turbo' | 'jet';

interface ThreeVisualizerProps {
  gridData: number[];
  phaseData: number[];
  width: number;
  length: number;
  zScale: number;
  renderStyle: RenderStyle;
  colorThreshold: number;
  maxDepthMeters: number;
  selectedNodeIndex: number | null;
  onSelectNode: (idx: number, x: number, y: number, adc: number, phase: number, depth: number) => void;
  sliceX?: number | null; // 0 to width - 1
  sliceY?: number | null; // 0 to length - 1
  sliceZ?: number | null; // depth in meters (0.0 to maxDepthMeters)
  sliceZMode?: DepthSliceMode; // 'cut' | 'band' | 'plane'
  depthRange?: [number, number] | null; // [minDepth, maxDepth] in meters
  showDepthPlane?: boolean; // show glowing 3D depth laser plane
  autoRotate?: boolean;
  showHeatmap?: boolean;
  heatmapOpacity?: number; // semi-transparent overlay opacity (0.1 to 1.0)
  heatmapPalette?: HeatmapPalette; // 'spectral' | 'inferno' | 'turbo' | 'jet'
  onToggleHeatmap?: () => void;
}

// Convert ADC value (0 - 1024) to OKM Color Spectrum
export function getOkmSpectrumColor(adc: number, phase: number): THREE.Color {
  const norm = Math.min(Math.max(adc, 0), 1024) / 1024;

  let r = 0;
  let g = 0;
  let b = 0;

  if (norm < 0.28) {
    // Deep Cavity / Void (Blue / Dark Indigo)
    const t = norm / 0.28;
    r = 0.0;
    g = 0.08 + t * 0.35;
    b = 0.75 + t * 0.25;
  } else if (norm < 0.52) {
    // Normal Soil (Green / Turquoise)
    const t = (norm - 0.28) / 0.24;
    r = 0.0 + t * 0.25;
    g = 0.5 + t * 0.5;
    b = 0.6 - t * 0.6;
  } else if (norm < 0.72) {
    // Mineralization / Ferrous (Yellow / Orange)
    const t = (norm - 0.52) / 0.20;
    r = 0.25 + t * 0.75;
    g = 1.0 - t * 0.45;
    b = 0.0;
  } else {
    // High Metal / Gold Peak (Red / Gold)
    const t = (norm - 0.72) / 0.28;
    r = 1.0;
    g = 0.55 - t * 0.45;
    b = t * 0.2;
  }

  // Boost phase shift effect (Gold has high positive phase > 25)
  if (phase > 25) {
    r = Math.min(1.0, r + 0.25);
    g = Math.min(1.0, g + 0.15);
  }

  return new THREE.Color(r, g, b);
}

// Convert ADC value (magnetic intensity) to a high-contrast d3/recharts-style Thermal Heatmap Color Gradient
export function getD3HeatmapColor(
  adc: number,
  minAdc: number = 150,
  maxAdc: number = 950,
  palette: HeatmapPalette = 'spectral'
): THREE.Color {
  const range = Math.max(1, maxAdc - minAdc);
  const t = Math.min(Math.max((adc - minAdc) / range, 0), 1);

  let r = 0, g = 0, b = 0;

  if (palette === 'inferno') {
    if (t < 0.2) {
      r = 0.05 + t * 0.7; g = 0.01; b = 0.15 + t * 1.5;
    } else if (t < 0.5) {
      const k = (t - 0.2) / 0.3;
      r = 0.19 + k * 0.65; g = 0.01 + k * 0.2; b = 0.45 - k * 0.2;
    } else if (t < 0.8) {
      const k = (t - 0.5) / 0.3;
      r = 0.84 + k * 0.15; g = 0.21 + k * 0.55; b = 0.25 - k * 0.25;
    } else {
      const k = (t - 0.8) / 0.2;
      r = 0.99; g = 0.76 + k * 0.24; b = k * 0.9;
    }
  } else if (palette === 'turbo') {
    if (t < 0.25) {
      const k = t / 0.25;
      r = 0.18 + k * 0.02; g = 0.12 + k * 0.8; b = 0.88 + k * 0.12;
    } else if (t < 0.5) {
      const k = (t - 0.25) / 0.25;
      r = 0.2 + k * 0.6; g = 0.92 + k * 0.08; b = 1.0 - k * 0.9;
    } else if (t < 0.75) {
      const k = (t - 0.5) / 0.25;
      r = 0.8 + k * 0.2; g = 1.0 - k * 0.6; b = 0.1 - k * 0.1;
    } else {
      const k = (t - 0.75) / 0.25;
      r = 1.0 - k * 0.3; g = 0.4 - k * 0.35; b = k * 0.2;
    }
  } else if (palette === 'jet') {
    if (t < 0.25) {
      const k = t / 0.25;
      r = 0; g = k; b = 1.0;
    } else if (t < 0.5) {
      const k = (t - 0.25) / 0.25;
      r = 0; g = 1.0; b = 1.0 - k;
    } else if (t < 0.75) {
      const k = (t - 0.5) / 0.25;
      r = k; g = 1.0; b = 0;
    } else {
      const k = (t - 0.75) / 0.25;
      r = 1.0; g = 1.0 - k; b = 0;
    }
  } else {
    // Default High-Contrast Spectral Palette (Indigo -> Cyan -> Emerald -> Yellow -> Red -> White)
    if (t < 0.2) {
      const k = t / 0.2;
      r = 0.05 * (1 - k); g = 0.15 + 0.65 * k; b = 0.85 + 0.15 * k;
    } else if (t < 0.45) {
      const k = (t - 0.2) / 0.25;
      r = 0.15 * k; g = 0.8 + 0.2 * k; b = 1.0 - 0.9 * k;
    } else if (t < 0.7) {
      const k = (t - 0.45) / 0.25;
      r = 0.15 + 0.85 * k; g = 1.0 - 0.1 * k; b = 0.05 * (1 - k);
    } else if (t < 0.9) {
      const k = (t - 0.7) / 0.2;
      r = 1.0; g = 0.9 - 0.75 * k; b = 0.05 * k;
    } else {
      const k = (t - 0.9) / 0.1;
      r = 1.0; g = 0.15 + 0.85 * k; b = 0.1 + 0.9 * k;
    }
  }

  return new THREE.Color(r, g, b);
}

export function getMagneticHeatmapColor(adc: number, minAdc: number = 150, maxAdc: number = 950): THREE.Color {
  return getD3HeatmapColor(adc, minAdc, maxAdc, 'spectral');
}

export const ThreeVisualizer: React.FC<ThreeVisualizerProps> = ({
  gridData,
  phaseData,
  width,
  length,
  zScale,
  renderStyle,
  colorThreshold,
  maxDepthMeters,
  selectedNodeIndex,
  onSelectNode,
  sliceX = null,
  sliceY = null,
  sliceZ = null,
  sliceZMode = 'cut',
  depthRange = null,
  showDepthPlane = true,
  autoRotate = false,
  showHeatmap = false,
  heatmapOpacity = 0.72,
  heatmapPalette = 'spectral',
  onToggleHeatmap
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const fallbackCanvasRef = useRef<HTMLCanvasElement>(null);

  const [hoveredNodeInfo, setHoveredNodeInfo] = useState<{
    x: number;
    y: number;
    adc: number;
    phase: number;
    depth: number;
  } | null>(null);

  const [webGlSupported, setWebGlSupported] = useState<boolean>(true);
  const [isContextLost, setIsContextLost] = useState<boolean>(false);
  const [rebuildTrigger, setRebuildTrigger] = useState<number>(0);
  const [activeViewPreset, setActiveViewPreset] = useState<'3d' | 'top' | 'side' | 'target'>('3d');

  // Compute dynamic min and max ADC for optimal heatmap contrast
  const { minAdc, maxAdc } = useMemo(() => {
    let minV = 1024;
    let maxV = 0;
    gridData.forEach((v) => {
      if (v < minV) minV = v;
      if (v > maxV) maxV = v;
    });
    return {
      minAdc: Math.min(minV, 300),
      maxAdc: Math.max(maxV, 750)
    };
  }, [gridData]);

  // Keep references to Three.js scene objects
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const meshGroupRef = useRef<THREE.Group | null>(null);
  const animationFrameIdRef = useRef<number | null>(null);

  // Auto rotate ref to avoid tearing down scene
  const autoRotateRef = useRef<boolean>(autoRotate);
  useEffect(() => {
    autoRotateRef.current = autoRotate;
  }, [autoRotate]);

  // Camera Orbit State
  const defaultDistance = Math.max(width, length) * 1.7;
  const cameraRotationRef = useRef({
    yaw: Math.PI / 4,
    pitch: Math.PI / 6,
    distance: defaultDistance,
    panX: 0,
    panY: 0
  });

  // Unified Multi-Pointer & Touch Interaction Tracking
  const isInteractingRef = useRef(false);
  const interactionModeRef = useRef<'rotate' | 'pan'>('rotate');
  const lastPointerRef = useRef({ x: 0, y: 0 });
  const activePointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchStartDistanceRef = useRef<number | null>(null);
  const pinchStartCameraDistRef = useRef<number>(defaultDistance);
  const twoFingerCenterRef = useRef<{ x: number; y: number } | null>(null);
  const dragDistanceMovedRef = useRef<number>(0);
  const velocityRef = useRef<{ yaw: number; pitch: number }>({ yaw: 0, pitch: 0 });

  // Update Camera transformation
  const updateCamera = useCallback(() => {
    const camera = cameraRef.current;
    if (!camera) return;

    const { yaw, pitch, distance, panX, panY } = cameraRotationRef.current;
    const x = distance * Math.cos(pitch) * Math.sin(yaw) + panX;
    const y = distance * Math.sin(pitch) + panY;
    const z = distance * Math.cos(pitch) * Math.cos(yaw);

    camera.position.set(x, y, z);
    camera.lookAt(panX, panY, 0);
  }, []);

  // Set Camera View Presets
  const setPresetView = (preset: '3d' | 'top' | 'side' | 'target') => {
    setActiveViewPreset(preset);
    if (preset === '3d') {
      cameraRotationRef.current.yaw = Math.PI / 4;
      cameraRotationRef.current.pitch = Math.PI / 6;
      cameraRotationRef.current.distance = Math.max(width, length) * 1.7;
      cameraRotationRef.current.panX = 0;
      cameraRotationRef.current.panY = 0;
    } else if (preset === 'top') {
      cameraRotationRef.current.yaw = 0;
      cameraRotationRef.current.pitch = Math.PI / 2 - 0.01;
      cameraRotationRef.current.distance = Math.max(width, length) * 1.8;
      cameraRotationRef.current.panX = 0;
      cameraRotationRef.current.panY = 0;
    } else if (preset === 'side') {
      cameraRotationRef.current.yaw = 0;
      cameraRotationRef.current.pitch = 0.08;
      cameraRotationRef.current.distance = Math.max(width, length) * 1.6;
      cameraRotationRef.current.panX = 0;
      cameraRotationRef.current.panY = 0;
    } else if (preset === 'target') {
      let maxIdx = 0;
      let maxV = 0;
      gridData.forEach((v, i) => {
        if (v > maxV) {
          maxV = v;
          maxIdx = i;
        }
      });
      const px = (maxIdx % width) - width / 2;
      cameraRotationRef.current.yaw = Math.PI / 4;
      cameraRotationRef.current.pitch = Math.PI / 5;
      cameraRotationRef.current.distance = Math.max(width, length) * 0.95;
      cameraRotationRef.current.panX = px * 0.5;
      cameraRotationRef.current.panY = 0;
    }
    updateCamera();
  };

  const handleZoom = (delta: number) => {
    cameraRotationRef.current.distance = Math.max(
      2,
      Math.min(100, cameraRotationRef.current.distance * delta)
    );
    updateCamera();
  };

  const handleResetCamera = () => {
    setPresetView('3d');
  };

  // 1. Initial WebGL Scene Setup
  useEffect(() => {
    if (!mountRef.current) return;
    const container = mountRef.current;

    const rect = container.getBoundingClientRect();
    const containerW = Math.max(rect.width || container.clientWidth || 800, 100);
    const containerH = Math.max(rect.height || container.clientHeight || 480, 100);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0d14);
    scene.fog = new THREE.FogExp2(0x0a0d14, 0.012);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, containerW / containerH, 0.1, 1000);
    cameraRef.current = camera;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true
      });
      renderer.setSize(containerW, containerH, false);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      rendererRef.current = renderer;
      setWebGlSupported(true);
      setIsContextLost(false);
    } catch (e) {
      console.error('WebGL initialization failed in ThreeVisualizer:', e);
      setWebGlSupported(false);
      return;
    }

    container.innerHTML = '';
    const dom = renderer.domElement;
    dom.style.width = '100%';
    dom.style.height = '100%';
    dom.style.display = 'block';
    dom.style.touchAction = 'none';
    container.appendChild(dom);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.95);
    scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0xffd700, 0.9);
    dirLight1.position.set(30, 50, 30);
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0x00e5ff, 0.65);
    dirLight2.position.set(-30, 30, -30);
    scene.add(dirLight2);

    const pointLight = new THREE.PointLight(0xffffff, 0.6, 60);
    pointLight.position.set(0, 15, 0);
    scene.add(pointLight);

    const meshGroup = new THREE.Group();
    scene.add(meshGroup);
    meshGroupRef.current = meshGroup;

    updateCamera();

    let lastTime = performance.now();
    const animate = () => {
      animationFrameIdRef.current = requestAnimationFrame(animate);

      const now = performance.now();
      const delta = (now - lastTime) / 1000;
      lastTime = now;

      if (autoRotateRef.current && !isInteractingRef.current) {
        cameraRotationRef.current.yaw += delta * 0.35;
        updateCamera();
      } else if (!isInteractingRef.current) {
        // Inertia Damping when gesture ends
        if (Math.abs(velocityRef.current.yaw) > 0.0001 || Math.abs(velocityRef.current.pitch) > 0.0001) {
          cameraRotationRef.current.yaw += velocityRef.current.yaw;
          cameraRotationRef.current.pitch = Math.max(
            0.02,
            Math.min(Math.PI / 2 - 0.02, cameraRotationRef.current.pitch + velocityRef.current.pitch)
          );
          velocityRef.current.yaw *= 0.88;
          velocityRef.current.pitch *= 0.88;
          updateCamera();
        }
      }

      if (rendererRef.current && sceneRef.current && cameraRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }
    };
    animate();

    const onContextLost = (e: Event) => {
      e.preventDefault();
      console.warn('ThreeVisualizer: WebGL context lost.');
      setIsContextLost(true);
    };

    const onContextRestored = () => {
      console.log('ThreeVisualizer: WebGL context restored.');
      setIsContextLost(false);
      setRebuildTrigger((p) => p + 1);
    };

    dom.addEventListener('webglcontextlost', onContextLost, false);
    dom.addEventListener('webglcontextrestored', onContextRestored, false);

    // ==========================================
    // UNIFIED MULTI-POINTER INTERACTION ENGINE
    // ==========================================
    const activePointers = activePointersRef.current;

    const getPointersArray = (): { x: number; y: number }[] => Array.from(activePointers.values());

    const getPointersDistance = () => {
      const pts = getPointersArray();
      if (pts.length < 2) return 0;
      return Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
    };

    const getPointersCenter = () => {
      const pts = getPointersArray();
      if (pts.length < 2) return { x: 0, y: 0 };
      return {
        x: (pts[0].x + pts[1].x) / 2,
        y: (pts[0].y + pts[1].y) / 2
      };
    };

    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== undefined && e.button > 2) return;

      try {
        (e.target as HTMLElement)?.setPointerCapture?.(e.pointerId);
      } catch (_) {}

      activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      isInteractingRef.current = true;
      dragDistanceMovedRef.current = 0;

      if (activePointers.size === 1) {
        interactionModeRef.current = e.button === 2 || e.shiftKey ? 'pan' : 'rotate';
        lastPointerRef.current = { x: e.clientX, y: e.clientY };
        pinchStartDistanceRef.current = null;
        twoFingerCenterRef.current = null;
        velocityRef.current = { yaw: 0, pitch: 0 };
      } else if (activePointers.size === 2) {
        pinchStartDistanceRef.current = getPointersDistance();
        pinchStartCameraDistRef.current = cameraRotationRef.current.distance;
        twoFingerCenterRef.current = getPointersCenter();
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!activePointers.has(e.pointerId)) return;
      if (e.cancelable) e.preventDefault();

      const prevPos = activePointers.get(e.pointerId);
      activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (activePointers.size === 1 && prevPos) {
        const dx = e.clientX - prevPos.x;
        const dy = e.clientY - prevPos.y;
        dragDistanceMovedRef.current += Math.hypot(dx, dy);

        if (interactionModeRef.current === 'rotate') {
          const yawDelta = -dx * 0.007;
          const pitchDelta = dy * 0.007;

          cameraRotationRef.current.yaw += yawDelta;
          cameraRotationRef.current.pitch = Math.max(
            0.02,
            Math.min(Math.PI / 2 - 0.02, cameraRotationRef.current.pitch + pitchDelta)
          );

          velocityRef.current = { yaw: yawDelta, pitch: pitchDelta };
        } else {
          cameraRotationRef.current.panX -= dx * 0.02;
          cameraRotationRef.current.panY += dy * 0.02;
        }

        updateCamera();
      } else if (activePointers.size === 2) {
        const currentDist = getPointersDistance();
        const currentCenter = getPointersCenter();

        if (pinchStartDistanceRef.current && pinchStartDistanceRef.current > 0 && currentDist > 0) {
          const scale = pinchStartDistanceRef.current / currentDist;
          cameraRotationRef.current.distance = Math.max(
            2,
            Math.min(100, pinchStartCameraDistRef.current * scale)
          );
        }

        if (twoFingerCenterRef.current) {
          const cdx = currentCenter.x - twoFingerCenterRef.current.x;
          const cdy = currentCenter.y - twoFingerCenterRef.current.y;
          cameraRotationRef.current.panX -= cdx * 0.012;
          cameraRotationRef.current.panY += cdy * 0.012;
          twoFingerCenterRef.current = currentCenter;
        }

        updateCamera();
      }
    };

    const onPointerUpOrCancel = (e: PointerEvent) => {
      try {
        (e.target as HTMLElement)?.releasePointerCapture?.(e.pointerId);
      } catch (_) {}

      activePointers.delete(e.pointerId);

      if (activePointers.size === 0) {
        isInteractingRef.current = false;
        pinchStartDistanceRef.current = null;
        twoFingerCenterRef.current = null;
      } else if (activePointers.size === 1) {
        const [remainingPt] = getPointersArray();
        if (remainingPt) {
          lastPointerRef.current = { x: remainingPt.x, y: remainingPt.y };
        }
        pinchStartDistanceRef.current = null;
        twoFingerCenterRef.current = null;
        interactionModeRef.current = 'rotate';
      }
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const zoomFactor = e.deltaY > 0 ? 1.08 : 0.92;
      cameraRotationRef.current.distance = Math.max(
        2,
        Math.min(100, cameraRotationRef.current.distance * zoomFactor)
      );
      updateCamera();
    };

    const onContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    dom.addEventListener('pointerdown', onPointerDown, { passive: false });
    window.addEventListener('pointermove', onPointerMove, { passive: false });
    window.addEventListener('pointerup', onPointerUpOrCancel);
    window.addEventListener('pointercancel', onPointerUpOrCancel);
    dom.addEventListener('wheel', onWheel, { passive: false });
    dom.addEventListener('contextmenu', onContextMenu);

    const handleResize = () => {
      if (!mountRef.current || !rendererRef.current || !cameraRef.current) return;
      const r = mountRef.current.getBoundingClientRect();
      const w = Math.max(r.width || mountRef.current.clientWidth || 800, 100);
      const h = Math.max(r.height || mountRef.current.clientHeight || 480, 100);

      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(w, h, false);
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);

    return () => {
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
      }
      resizeObserver.disconnect();

      dom.removeEventListener('webglcontextlost', onContextLost);
      dom.removeEventListener('webglcontextrestored', onContextRestored);

      dom.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUpOrCancel);
      window.removeEventListener('pointercancel', onPointerUpOrCancel);
      dom.removeEventListener('wheel', onWheel);
      dom.removeEventListener('contextmenu', onContextMenu);

      if (container.contains(dom)) {
        container.removeChild(dom);
      }
      renderer.dispose();
    };
  }, [width, length, updateCamera, rebuildTrigger]);

  // 2. Rebuild Ground Geometry when data, style, scales, or slices change
  useEffect(() => {
    const meshGroup = meshGroupRef.current;
    if (!meshGroup) return;

    while (meshGroup.children.length > 0) {
      const obj = meshGroup.children[0];
      meshGroup.remove(obj);
      if ((obj as THREE.Mesh).geometry) {
        (obj as THREE.Mesh).geometry.dispose();
      }
    }

    const groundGroup = new THREE.Group();
    groundGroup.name = 'groundModel';

    const halfW = width / 2;
    const halfL = length / 2;

    // 1. Grid Floor Bounding Box & Guide Grid
    const boxGeo = new THREE.BoxGeometry(width, 0.1, length);
    const boxMat = new THREE.LineBasicMaterial({
      color: showHeatmap ? 0x475569 : 0x334155,
      transparent: true,
      opacity: 0.6
    });
    const boxEdges = new THREE.EdgesGeometry(boxGeo);
    const boxLine = new THREE.LineSegments(boxEdges, boxMat);
    boxLine.position.set(0, -0.05, 0);
    groundGroup.add(boxLine);

    const gridHelper = new THREE.GridHelper(
      Math.max(width, length),
      Math.max(width, length),
      showHeatmap ? 0xf97316 : 0xeab308,
      0x1e293b
    );
    gridHelper.position.y = -0.08;
    groundGroup.add(gridHelper);

    // Coordinates Axis Markers (X in Red, Z in Cyan)
    const axisGroup = new THREE.Group();
    const xLineGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-halfW, 0.05, -halfL),
      new THREE.Vector3(halfW, 0.05, -halfL)
    ]);
    const xLineMat = new THREE.LineBasicMaterial({ color: 0xef4444, linewidth: 2 });
    axisGroup.add(new THREE.Line(xLineGeo, xLineMat));

    const zLineGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-halfW, 0.05, -halfL),
      new THREE.Vector3(-halfW, 0.05, halfL)
    ]);
    const zLineMat = new THREE.LineBasicMaterial({ color: 0x06b6d4, linewidth: 2 });
    axisGroup.add(new THREE.Line(zLineGeo, zLineMat));
    groundGroup.add(axisGroup);

    // Find highest peak for anomaly beacon
    let maxAdcValue = 0;
    let maxAdcIndex = 0;
    gridData.forEach((val, idx) => {
      if (val > maxAdcValue) {
        maxAdcValue = val;
        maxAdcIndex = idx;
      }
    });

    // Helper to check depth slice visibility
    const isPointDepthVisible = (adc: number): boolean => {
      if (sliceZ === null && depthRange === null) return true;

      const ptDepth = maxDepthMeters * (1 - Math.min(Math.max(adc, 0), 1024) / 1024);

      if (sliceZMode === 'cut' && sliceZ !== null) {
        return ptDepth >= sliceZ;
      }
      if (sliceZMode === 'plane' && sliceZ !== null) {
        return Math.abs(ptDepth - sliceZ) <= 0.45;
      }
      if (sliceZMode === 'band' && depthRange !== null) {
        return ptDepth >= depthRange[0] && ptDepth <= depthRange[1];
      }
      return true;
    };

    // 2. Build 3D Terrain depending on render style
    if (renderStyle === '3d-mesh' || renderStyle === 'wireframe' || renderStyle === 'contour') {
      const segW = Math.max(1, width - 1);
      const segL = Math.max(1, length - 1);
      const geometry = new THREE.PlaneGeometry(width, length, segW, segL);
      geometry.rotateX(-Math.PI / 2);

      const posAttr = geometry.attributes.position;
      const count = posAttr.count;
      const colors: number[] = [];

      for (let i = 0; i < count; i++) {
        const x = i % width;
        const y = Math.floor(i / width);
        const idx = y * width + x;

        const adc = gridData[idx] ?? 380;
        const phase = phaseData[idx] ?? 0;

        const normAdc = (adc - 380) / 400;
        let yHeight = normAdc * zScale * 1.6;

        let isSliceVisible = true;
        if (sliceX !== null && x !== sliceX) isSliceVisible = false;
        if (sliceY !== null && y !== sliceY) isSliceVisible = false;
        if (!isPointDepthVisible(adc)) isSliceVisible = false;

        if (!isSliceVisible) {
          yHeight = 0;
        }

        posAttr.setY(i, yHeight);

        // Color Spectrum (Standard OKM Spectrum vs D3 Heatmap Interpolation)
        const color = showHeatmap
          ? getD3HeatmapColor(adc, minAdc, maxAdc, heatmapPalette as HeatmapPalette)
          : getOkmSpectrumColor(adc, phase);

        if (isSliceVisible) {
          colors.push(color.r, color.g, color.b);
        } else {
          colors.push(0.08, 0.1, 0.15);
        }
      }

      posAttr.needsUpdate = true;
      geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
      geometry.computeVertexNormals();
      geometry.computeBoundingBox();
      geometry.computeBoundingSphere();

      if (renderStyle === 'wireframe') {
        const wireMat = new THREE.MeshBasicMaterial({
          vertexColors: true,
          wireframe: true
        });
        const mesh = new THREE.Mesh(geometry, wireMat);
        groundGroup.add(mesh);
      } else {
        const meshMat = new THREE.MeshStandardMaterial({
          vertexColors: true,
          roughness: showHeatmap ? 0.22 : 0.35,
          metalness: showHeatmap ? 0.25 : 0.15,
          side: THREE.DoubleSide
        });
        const mesh = new THREE.Mesh(geometry, meshMat);
        groundGroup.add(mesh);

        // Semi-transparent D3 Heatmap Intensity Overlay Layer on 3D Model
        if (showHeatmap) {
          const overlayGeo = geometry.clone();
          const overlayColors: number[] = [];

          for (let i = 0; i < count; i++) {
            const x = i % width;
            const y = Math.floor(i / width);
            const idx = y * width + x;
            const adc = gridData[idx] ?? 380;

            let isSliceVisible = true;
            if (sliceX !== null && x !== sliceX) isSliceVisible = false;
            if (sliceY !== null && y !== sliceY) isSliceVisible = false;
            if (!isPointDepthVisible(adc)) isSliceVisible = false;

            const hColor = getD3HeatmapColor(adc, minAdc, maxAdc, heatmapPalette as HeatmapPalette);

            if (isSliceVisible) {
              overlayColors.push(hColor.r, hColor.g, hColor.b);
            } else {
              overlayColors.push(0, 0, 0);
            }
          }

          overlayGeo.setAttribute('color', new THREE.Float32BufferAttribute(overlayColors, 3));

          const overlayMat = new THREE.MeshStandardMaterial({
            vertexColors: true,
            transparent: true,
            opacity: heatmapOpacity,
            roughness: 0.15,
            metalness: 0.35,
            emissive: 0xffffff,
            emissiveIntensity: 0.25,
            side: THREE.DoubleSide,
            polygonOffset: true,
            polygonOffsetFactor: -1,
            polygonOffsetUnits: -1
          });

          const overlayMesh = new THREE.Mesh(overlayGeo, overlayMat);
          groundGroup.add(overlayMesh);
        }

        // Subtle wireframe overlay
        const wireOverlayMat = new THREE.MeshBasicMaterial({
          color: showHeatmap ? 0x000000 : 0xffffff,
          wireframe: true,
          transparent: true,
          opacity: showHeatmap ? 0.25 : 0.14
        });
        const wireOverlay = new THREE.Mesh(geometry, wireOverlayMat);
        groundGroup.add(wireOverlay);
      }
    } else if (renderStyle === 'point-cloud') {
      const positions: number[] = [];
      const colors: number[] = [];

      for (let y = 0; y < length; y++) {
        for (let x = 0; x < width; x++) {
          if (sliceX !== null && x !== sliceX) continue;
          if (sliceY !== null && y !== sliceY) continue;

          const idx = y * width + x;
          const adc = gridData[idx] ?? 380;
          const phase = phaseData[idx] ?? 0;

          if (!isPointDepthVisible(adc)) continue;

          const posX = x - halfW + 0.5;
          const posZ = y - halfL + 0.5;
          const posY = ((adc - 380) / 400) * zScale * 1.6;

          positions.push(posX, posY, posZ);

          const col = showHeatmap
            ? getD3HeatmapColor(adc, minAdc, maxAdc, heatmapPalette as HeatmapPalette)
            : getOkmSpectrumColor(adc, phase);

          colors.push(col.r, col.g, col.b);
        }
      }

      const pointsGeo = new THREE.BufferGeometry();
      pointsGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      pointsGeo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
      pointsGeo.computeBoundingSphere();

      const pointsMat = new THREE.PointsMaterial({
        size: showHeatmap ? 0.55 : 0.45,
        vertexColors: true,
        transparent: true,
        opacity: 0.95
      });

      const pointCloud = new THREE.Points(pointsGeo, pointsMat);
      groundGroup.add(pointCloud);
    } else if (renderStyle === 'voxel') {
      for (let y = 0; y < length; y++) {
        for (let x = 0; x < width; x++) {
          if (sliceX !== null && x !== sliceX) continue;
          if (sliceY !== null && y !== sliceY) continue;

          const idx = y * width + x;
          const adc = gridData[idx] ?? 380;
          const phase = phaseData[idx] ?? 0;

          if (!isPointDepthVisible(adc)) continue;

          const heightFactor = Math.max(0.12, Math.abs((adc - 380) / 300) * zScale + 0.2);
          const voxelGeo = new THREE.BoxGeometry(0.88, heightFactor, 0.88);

          const col = showHeatmap
            ? getD3HeatmapColor(adc, minAdc, maxAdc, heatmapPalette as HeatmapPalette)
            : getOkmSpectrumColor(adc, phase);

          const voxelMat = new THREE.MeshStandardMaterial({
            color: col,
            roughness: 0.3,
            metalness: 0.2
          });

          const voxelMesh = new THREE.Mesh(voxelGeo, voxelMat);
          const isNegative = adc < 380;
          voxelMesh.position.set(
            x - halfW + 0.5,
            isNegative ? -heightFactor / 2 : heightFactor / 2,
            y - halfL + 0.5
          );

          groundGroup.add(voxelMesh);
        }
      }
    }

    // 3. Render 3D Illuminated Laser Depth Slice Plane if sliceZ is active
    if (sliceZ !== null && showDepthPlane) {
      const targetAdc = 1024 * (1 - Math.min(Math.max(sliceZ, 0), maxDepthMeters) / maxDepthMeters);
      const normPlaneAdc = (targetAdc - 380) / 400;
      const planeY = normPlaneAdc * zScale * 1.6;

      const slicePlaneGeo = new THREE.PlaneGeometry(width * 1.12, length * 1.12);
      slicePlaneGeo.rotateX(-Math.PI / 2);

      const slicePlaneMat = new THREE.MeshStandardMaterial({
        color: showHeatmap ? 0xff5500 : 0x00f0ff,
        emissive: showHeatmap ? 0xff2200 : 0x0099dd,
        emissiveIntensity: 0.5,
        transparent: true,
        opacity: 0.38,
        side: THREE.DoubleSide,
        roughness: 0.15,
        metalness: 0.75
      });

      const slicePlaneMesh = new THREE.Mesh(slicePlaneGeo, slicePlaneMat);
      slicePlaneMesh.position.set(0, planeY, 0);
      groundGroup.add(slicePlaneMesh);

      const planeEdges = new THREE.EdgesGeometry(slicePlaneGeo);
      const planeLineMat = new THREE.LineBasicMaterial({
        color: showHeatmap ? 0xffcc00 : 0x00ffff,
        linewidth: 2,
        transparent: true,
        opacity: 0.85
      });
      const planeLineMesh = new THREE.LineSegments(planeEdges, planeLineMat);
      planeLineMesh.position.set(0, planeY + 0.01, 0);
      groundGroup.add(planeLineMesh);

      // Target anomaly rings intersecting current depth plane
      for (let y = 0; y < length; y++) {
        for (let x = 0; x < width; x++) {
          const idx = y * width + x;
          const adc = gridData[idx] ?? 380;
          const ptDepth = maxDepthMeters * (1 - Math.min(Math.max(adc, 0), 1024) / 1024);

          if (Math.abs(ptDepth - sliceZ) <= 0.4 && (adc > 620 || adc < 250)) {
            const rx = x - halfW + 0.5;
            const rz = y - halfL + 0.5;

            const targetRingGeo = new THREE.RingGeometry(0.25, 0.42, 24);
            targetRingGeo.rotateX(-Math.PI / 2);
            const targetRingMat = new THREE.MeshBasicMaterial({
              color: adc > 620 ? 0xffd700 : 0x00f0ff,
              side: THREE.DoubleSide,
              transparent: true,
              opacity: 0.95
            });
            const targetMesh = new THREE.Mesh(targetRingGeo, targetRingMat);
            targetMesh.position.set(rx, planeY + 0.02, rz);
            groundGroup.add(targetMesh);
          }
        }
      }
    }

    // 3. High Peak Target Anomaly Beacon
    if (maxAdcValue > 700) {
      const peakX = (maxAdcIndex % width) - halfW + 0.5;
      const peakY = Math.floor(maxAdcIndex / width) - halfL + 0.5;
      const peakHeight = ((maxAdcValue - 380) / 400) * zScale * 1.6;

      const ringGeo = new THREE.RingGeometry(0.35, 0.55, 32);
      ringGeo.rotateX(-Math.PI / 2);
      const ringMat = new THREE.MeshBasicMaterial({
        color: showHeatmap ? 0xff0055 : 0xffd700,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.9
      });
      const ringMesh = new THREE.Mesh(ringGeo, ringMat);
      ringMesh.position.set(peakX, peakHeight + 0.06, peakY);
      groundGroup.add(ringMesh);

      const beamGeo = new THREE.CylinderGeometry(0.04, 0.08, 1.8, 16);
      const beamMat = new THREE.MeshBasicMaterial({
        color: showHeatmap ? 0xff3366 : 0xffd700,
        transparent: true,
        opacity: 0.8
      });
      const beamMesh = new THREE.Mesh(beamGeo, beamMat);
      beamMesh.position.set(peakX, peakHeight + 0.9, peakY);
      groundGroup.add(beamMesh);
    }

    // 4. Highlight Pin on Selected Node
    if (selectedNodeIndex !== null && selectedNodeIndex < width * length) {
      const selX = selectedNodeIndex % width;
      const selY = Math.floor(selectedNodeIndex / width);
      const selAdc = gridData[selectedNodeIndex] ?? 380;

      const pinGeo = new THREE.ConeGeometry(0.28, 1.0, 16);
      pinGeo.rotateX(Math.PI);
      const pinMat = new THREE.MeshStandardMaterial({
        color: 0x00e5ff,
        emissive: 0x00aacc,
        emissiveIntensity: 0.9
      });
      const pinMesh = new THREE.Mesh(pinGeo, pinMat);

      const posY = ((selAdc - 380) / 400) * zScale * 1.6 + 0.8;
      pinMesh.position.set(selX - halfW + 0.5, posY, selY - halfL + 0.5);

      groundGroup.add(pinMesh);
    }

    meshGroup.add(groundGroup);
  }, [
    gridData,
    phaseData,
    width,
    length,
    zScale,
    renderStyle,
    colorThreshold,
    selectedNodeIndex,
    sliceX,
    sliceY,
    rebuildTrigger,
    showHeatmap,
    heatmapOpacity,
    heatmapPalette,
    sliceZ,
    sliceZMode,
    depthRange,
    showDepthPlane,
    maxDepthMeters,
    minAdc,
    maxAdc
  ]);

  // 3. Fallback Canvas 2D Renderer when WebGL is unavailable
  useEffect(() => {
    if (webGlSupported && !isContextLost) return;
    const canvas = fallbackCanvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const cw = (canvas.width = canvas.parentElement?.clientWidth || 800);
    const ch = (canvas.height = canvas.parentElement?.clientHeight || 480);

    ctx.fillStyle = '#0a0d14';
    ctx.fillRect(0, 0, cw, ch);

    const cx = cw / 2;
    const cy = ch / 2 - 30;
    const cellW = Math.min(cw, ch) / (Math.max(width, length) * 1.8);

    for (let y = 0; y < length - 1; y++) {
      for (let x = 0; x < width - 1; x++) {
        const idx = y * width + x;
        const adc = gridData[idx] ?? 380;
        const phase = phaseData[idx] ?? 0;
        const norm = (adc - 380) / 400;
        const elevation = norm * zScale * 25;

        const px0 = cx + (x - y) * cellW * 0.9;
        const py0 = cy + (x + y) * cellW * 0.45 - elevation;

        const px1 = cx + (x + 1 - y) * cellW * 0.9;
        const py1 = cy + (x + 1 + y) * cellW * 0.45 - elevation;

        const px2 = cx + (x + 1 - (y + 1)) * cellW * 0.9;
        const py2 = cy + (x + 1 + y + 1) * cellW * 0.45 - elevation;

        const px3 = cx + (x - (y + 1)) * cellW * 0.9;
        const py3 = cy + (x + y + 1) * cellW * 0.45 - elevation;

        const col = showHeatmap
          ? getMagneticHeatmapColor(adc, minAdc, maxAdc)
          : getOkmSpectrumColor(adc, phase);

        ctx.fillStyle = `rgb(${Math.round(col.r * 255)}, ${Math.round(col.g * 255)}, ${Math.round(col.b * 255)})`;
        ctx.strokeStyle = showHeatmap ? 'rgba(0, 0, 0, 0.3)' : 'rgba(255, 255, 255, 0.2)';
        ctx.lineWidth = 1;

        ctx.beginPath();
        ctx.moveTo(px0, py0);
        ctx.lineTo(px1, py1);
        ctx.lineTo(px2, py2);
        ctx.lineTo(px3, py3);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
    }
  }, [webGlSupported, isContextLost, gridData, phaseData, width, length, zScale, showHeatmap, minAdc, maxAdc]);

  // Handle Raycasting click on canvas
  const handleCanvasPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragDistanceMovedRef.current > 6) return;
    if (!mountRef.current || !cameraRef.current || !meshGroupRef.current) return;

    const rect = mountRef.current.getBoundingClientRect();
    const mouse = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1
    );

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, cameraRef.current);

    const intersects = raycaster.intersectObjects(meshGroupRef.current.children, true);
    if (intersects.length > 0) {
      const hit = intersects[0].point;
      const halfW = width / 2;
      const halfL = length / 2;

      const x = Math.min(width - 1, Math.max(0, Math.floor(hit.x + halfW)));
      const y = Math.min(length - 1, Math.max(0, Math.floor(hit.z + halfL)));
      const idx = y * width + x;

      const adc = gridData[idx] ?? 380;
      const phase = phaseData[idx] ?? 0;
      const depth = Math.round(maxDepthMeters * (1 - adc / 1024) * 10) / 10;

      onSelectNode(idx, x, y, adc, phase, depth);
      setHoveredNodeInfo({ x, y, adc, phase, depth });
    }
  };

  return (
    <div className="relative w-full h-full min-h-[460px] rounded-2xl overflow-hidden border border-slate-800 bg-slate-950 shadow-2xl select-none">
      {/* Primary 3D WebGL Canvas Layer */}
      {webGlSupported && !isContextLost ? (
        <div
          ref={mountRef}
          onPointerUp={handleCanvasPointerUp}
          className="absolute inset-0 w-full h-full cursor-grab active:cursor-grabbing touch-none"
        />
      ) : (
        /* Seamless 2D Isometric Topographic Canvas Fallback */
        <div className="absolute inset-0 w-full h-full flex flex-col items-center justify-center bg-slate-950">
          <canvas ref={fallbackCanvasRef} className="w-full h-full" />
          <div className="absolute bottom-4 left-4 bg-slate-900/90 border border-amber-500/40 rounded-xl p-3 text-xs text-slate-300 flex items-center gap-2 shadow-xl">
            <AlertCircle className="w-4 h-4 text-amber-400" />
            <span>نمای ایزومتریک جایگزین (WebGL فعال نیست)</span>
            <button
              onClick={() => setRebuildTrigger((p) => p + 1)}
              className="ml-2 px-2.5 py-1 bg-amber-400 text-slate-950 font-bold rounded-lg hover:bg-amber-300 text-[11px] flex items-center gap-1"
            >
              <RefreshCw className="w-3 h-3" />
              تلاش مجدد
            </button>
          </div>
        </div>
      )}

      {/* Top Floating Status & Legend Badge */}
      <div className="absolute top-3 left-3 bg-slate-900/90 backdrop-blur-md border border-slate-700/70 rounded-xl p-2.5 text-xs text-white flex items-center gap-3 shadow-xl pointer-events-auto">
        <div className="flex items-center gap-1.5 font-bold text-amber-400">
          <span className={`w-2.5 h-2.5 rounded-full ${showHeatmap ? 'bg-orange-500 animate-pulse' : 'bg-amber-400 animate-ping'}`} />
          <span className="text-xs font-mono">
            {showHeatmap ? 'اورلی نقشه حرارتی مغناطیسی (Heatmap)' : (webGlSupported && !isContextLost ? 'موتور ۳بعدی OKM WebGL' : 'موتور ایزومتریک ۲بعدی')}
          </span>
        </div>
        <div className="h-3 w-px bg-slate-700" />
        <div className="text-slate-300 text-[11px] font-mono">
          بازه شدت: <span className="font-bold text-orange-400">{minAdc} - {maxAdc}</span> ADC
        </div>
      </div>

      {/* Top Right Quick Compass, Heatmap & Preset Views Bar */}
      <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-slate-900/90 backdrop-blur-md border border-slate-700/70 rounded-xl p-1.5 shadow-xl pointer-events-auto">
        {/* Heatmap Toggle Button in 3D HUD */}
        {onToggleHeatmap && (
          <button
            onClick={onToggleHeatmap}
            title={showHeatmap ? 'خاموش کردن نقشه حرارتی (طیف OKM)' : 'روشن کردن نقشه حرارتی مغناطیسی (Thermal Heatmap)'}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
              showHeatmap
                ? 'bg-gradient-to-r from-orange-500 via-rose-500 to-red-600 text-white shadow-lg shadow-orange-500/30'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Flame className={`w-3.5 h-3.5 ${showHeatmap ? 'text-yellow-200 animate-bounce' : 'text-orange-400'}`} />
            <span>هیت‌مپ</span>
          </button>
        )}

        <div className="h-4 w-px bg-slate-800" />

        <button
          onClick={() => setPresetView('3d')}
          title="دید پرسپکتیو ۳بعدی"
          className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
            activeViewPreset === '3d'
              ? 'bg-amber-400 text-slate-950 shadow'
              : 'text-slate-300 hover:text-white hover:bg-slate-800'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>۳بعدی</span>
        </button>

        <button
          onClick={() => setPresetView('top')}
          title="دید از بالا (شبکه مسطح ۲بعدی)"
          className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
            activeViewPreset === 'top'
              ? 'bg-cyan-400 text-slate-950 shadow'
              : 'text-slate-300 hover:text-white hover:bg-slate-800'
          }`}
        >
          <Compass className="w-3.5 h-3.5" />
          <span>از بالا</span>
        </button>

        <button
          onClick={() => setPresetView('side')}
          title="دید از پهلو (پروفایل عمقی)"
          className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
            activeViewPreset === 'side'
              ? 'bg-emerald-400 text-slate-950 shadow'
              : 'text-slate-300 hover:text-white hover:bg-slate-800'
          }`}
        >
          <Eye className="w-3.5 h-3.5" />
          <span>مقطع</span>
        </button>

        <button
          onClick={() => setPresetView('target')}
          title="تمرکز مستقیم روی قوی‌ترین آنومالی"
          className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
            activeViewPreset === 'target'
              ? 'bg-red-500 text-white shadow'
              : 'text-slate-300 hover:text-white hover:bg-slate-800'
          }`}
        >
          <Crosshair className="w-3.5 h-3.5 text-amber-400" />
          <span>هدف</span>
        </button>
      </div>

      {/* Right Floating Zoom and Navigation Controls */}
      <div className="absolute top-16 right-3 flex flex-col gap-1.5 bg-slate-900/90 backdrop-blur-md border border-slate-700/70 rounded-xl p-1.5 shadow-xl pointer-events-auto">
        <button
          onClick={() => handleZoom(0.85)}
          title="بزرگنمایی (Zoom In)"
          className="p-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition"
        >
          <ZoomIn className="w-4 h-4 text-cyan-400" />
        </button>

        <button
          onClick={() => handleZoom(1.18)}
          title="کوچک‌نمایی (Zoom Out)"
          className="p-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition"
        >
          <ZoomOut className="w-4 h-4 text-cyan-400" />
        </button>

        <div className="h-px w-full bg-slate-800" />

        <button
          onClick={handleResetCamera}
          title="بازنشانی زاویه دید (Reset View)"
          className="p-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition"
        >
          <RotateCcw className="w-4 h-4 text-amber-400" />
        </button>
      </div>

      {/* Selected Node Tooltip Overlay */}
      {hoveredNodeInfo && (
        <div className="absolute bottom-4 left-4 bg-slate-900/95 backdrop-blur-md border border-amber-500/50 rounded-xl p-3.5 text-xs text-white shadow-2xl max-w-xs space-y-2 pointer-events-auto animate-fade-in">
          <div className="font-bold text-amber-400 border-b border-slate-800 pb-1.5 flex justify-between items-center">
            <span className="flex items-center gap-1.5">
              <Crosshair className="w-3.5 h-3.5 text-cyan-400" />
              مختصات: X:{hoveredNodeInfo.x + 1} | Y:{hoveredNodeInfo.y + 1}
            </span>
            <button
              onClick={() => setHoveredNodeInfo(null)}
              className="text-slate-400 hover:text-white p-0.5 rounded"
            >
              ✕
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
            <div className="bg-slate-950/80 p-1.5 rounded-lg border border-slate-800">
              <span className="text-slate-400 block text-[10px]">شدت مغناطیسی ADC:</span>
              <span className="text-orange-400 font-bold">{hoveredNodeInfo.adc}</span>
            </div>
            <div className="bg-slate-950/80 p-1.5 rounded-lg border border-slate-800">
              <span className="text-slate-400 block text-[10px]">فاز Phase:</span>
              <span className="text-emerald-400 font-bold">{hoveredNodeInfo.phase}°</span>
            </div>
            <div className="col-span-2 bg-slate-950/80 p-1.5 rounded-lg border border-slate-800 flex justify-between items-center">
              <span className="text-slate-400">عمق تخمینی:</span>
              <span className="text-amber-400 font-bold">{hoveredNodeInfo.depth} متر</span>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Hint Banner */}
      <div className="absolute bottom-3 right-3 bg-slate-900/80 backdrop-blur-md border border-slate-700/60 rounded-xl px-3 py-1.5 text-[10px] text-slate-400 flex items-center gap-2 pointer-events-none">
        <Move className="w-3 h-3 text-cyan-400" />
        <span>چرخش با درگ ماوس / لمس صفحه | زوم با اسکرول یا پینچ</span>
      </div>
    </div>
  );
};
