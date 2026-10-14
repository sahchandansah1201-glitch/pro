import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  type WheelEvent,
} from "react";

interface PanGesture {
  pointerId: number;
  startX: number;
  startY: number;
  startScrollLeft: number;
  startScrollTop: number;
  moved: boolean;
}

interface BodyMapViewportOptions {
  panEnabled: boolean;
  zoomEnabled: boolean;
  zoom: number;
  zoomLevels: readonly number[];
  nativeImageWidth: number;
  onZoom: (zoom: number) => void;
}

const WHEEL_ZOOM_DELTA_THRESHOLD = 80;
const WHEEL_ZOOM_STEP = 0.1;
const BODY_MAP_DESKTOP_BREAKPOINT = 1024;
const BODY_MAP_MOBILE_BASE_WIDTH = 320;

function stepZoom(current: number, direction: -1 | 1, levels: readonly number[]) {
  if (direction > 0) return levels.find((level) => level > current) ?? levels.at(-1) ?? current;
  return [...levels].reverse().find((level) => level < current) ?? levels[0] ?? current;
}

function stepWheelZoom(current: number, direction: -1 | 1, levels: readonly number[]) {
  const minimum = levels[0] ?? current;
  const maximum = levels.at(-1) ?? current;
  return Number(Math.min(maximum, Math.max(minimum, current + direction * WHEEL_ZOOM_STEP)).toFixed(2));
}

export function useBodyMapViewportPan({
  panEnabled,
  zoomEnabled,
  zoom,
  zoomLevels,
  nativeImageWidth,
  onZoom,
}: BodyMapViewportOptions) {
  const gestureRef = useRef<PanGesture | null>(null);
  const suppressNextClickRef = useRef(false);
  const wheelDeltaRef = useRef(0);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const pendingZoomFocusRef = useRef<{
    x: number;
    y: number;
    viewportX: number;
    viewportY: number;
  } | null>(null);
  const [maximumZoom, setMaximumZoom] = useState(zoomLevels.at(-1) ?? zoom);
  const [isPanning, setIsPanning] = useState(false);

  const changeZoom = (nextZoom: number, focalClient?: { x: number; y: number }) => {
    const boundedZoom = Math.min(nextZoom, maximumZoom);
    if (boundedZoom === zoom) return;
    wheelDeltaRef.current = 0;
    const viewport = viewportRef.current;
    if (viewport) {
      const bounds = viewport.getBoundingClientRect();
      const viewportX = focalClient
        ? Math.min(viewport.clientWidth, Math.max(0, focalClient.x - bounds.left))
        : viewport.clientWidth / 2;
      const viewportY = focalClient
        ? Math.min(viewport.clientHeight, Math.max(0, focalClient.y - bounds.top))
        : viewport.clientHeight / 2;
      pendingZoomFocusRef.current = {
        x: (viewport.scrollLeft + viewportX) / Math.max(viewport.scrollWidth, 1),
        y: (viewport.scrollTop + viewportY) / Math.max(viewport.scrollHeight, 1),
        viewportX,
        viewportY,
      };
    }
    onZoom(boundedZoom);
  };

  const resetViewport = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    viewport.scrollLeft = 0;
    viewport.scrollTop = 0;
  }, []);

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    const focus = pendingZoomFocusRef.current;
    if (!viewport || !focus) return;
    viewport.scrollLeft = Math.max(0, focus.x * viewport.scrollWidth - focus.viewportX);
    viewport.scrollTop = Math.max(0, focus.y * viewport.scrollHeight - focus.viewportY);
    pendingZoomFocusRef.current = null;
  }, [zoom]);

  useLayoutEffect(() => {
    const updateMaximumZoom = () => {
      const viewport = viewportRef.current;
      if (!viewport) return;
      const computedStyle = window.getComputedStyle(viewport);
      const horizontalPadding = Number.parseFloat(computedStyle.paddingLeft || "0")
        + Number.parseFloat(computedStyle.paddingRight || "0");
      const desktopBaseWidth = Math.max(0, viewport.clientWidth - horizontalPadding);
      const baseWidth = window.innerWidth >= BODY_MAP_DESKTOP_BREAKPOINT
        ? Math.min(desktopBaseWidth, nativeImageWidth)
        : BODY_MAP_MOBILE_BASE_WIDTH;
      if (!baseWidth) return;
      const nativeLimit = nativeImageWidth / baseWidth;
      const nextMaximum = [...zoomLevels].reverse()
        .find((level) => level <= nativeLimit) ?? zoomLevels[0] ?? zoom;
      setMaximumZoom(nextMaximum);
      if (zoom > nextMaximum) onZoom(nextMaximum);
    };

    updateMaximumZoom();
    const resizeObserver = typeof ResizeObserver === "undefined"
      ? null
      : new ResizeObserver(updateMaximumZoom);
    const observedViewport = viewportRef.current;
    if (observedViewport) resizeObserver?.observe(observedViewport);
    window.addEventListener("resize", updateMaximumZoom);
    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener("resize", updateMaximumZoom);
    };
  }, [nativeImageWidth, onZoom, zoom, zoomLevels]);

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    suppressNextClickRef.current = false;
    if (!panEnabled) return;
    const target = event.target as Element | null;
    if (target?.closest("button, a, input, select, textarea")) return;
    gestureRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startScrollLeft: event.currentTarget.scrollLeft,
      startScrollTop: event.currentTarget.scrollTop,
      moved: false,
    };
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const gesture = gestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    const deltaX = event.clientX - gesture.startX;
    const deltaY = event.clientY - gesture.startY;
    if (!gesture.moved && Math.hypot(deltaX, deltaY) < 5) return;
    if (!gesture.moved) {
      gesture.moved = true;
      event.currentTarget.setPointerCapture?.(event.pointerId);
      setIsPanning(true);
    }
    event.preventDefault();
    event.currentTarget.scrollLeft = gesture.startScrollLeft - deltaX;
    event.currentTarget.scrollTop = gesture.startScrollTop - deltaY;
  };

  const finishPan = (event: PointerEvent<HTMLDivElement>, cancelled = false) => {
    const gesture = gestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    suppressNextClickRef.current = !cancelled && gesture.moved;
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    gestureRef.current = null;
    setIsPanning(false);
  };

  const handleClickCapture = (event: MouseEvent<HTMLDivElement>) => {
    if (!suppressNextClickRef.current) return;
    suppressNextClickRef.current = false;
    if (event.detail === 0) return;
    event.preventDefault();
    event.stopPropagation();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!panEnabled || event.target !== event.currentTarget) return;
    const stepX = Math.max(80, Math.round(event.currentTarget.clientWidth / 4));
    const stepY = Math.max(80, Math.round(event.currentTarget.clientHeight / 4));
    const movement = {
      ArrowLeft: { x: -stepX, y: 0 },
      ArrowRight: { x: stepX, y: 0 },
      ArrowUp: { x: 0, y: -stepY },
      ArrowDown: { x: 0, y: stepY },
    }[event.key];
    if (!movement) return;
    event.preventDefault();
    event.currentTarget.scrollLeft = Math.max(
      0,
      Math.min(
        event.currentTarget.scrollWidth - event.currentTarget.clientWidth,
        event.currentTarget.scrollLeft + movement.x,
      ),
    );
    event.currentTarget.scrollTop = Math.max(
      0,
      Math.min(
        event.currentTarget.scrollHeight - event.currentTarget.clientHeight,
        event.currentTarget.scrollTop + movement.y,
      ),
    );
  };

  const handleWheel = (event: WheelEvent<HTMLDivElement>) => {
    if (!zoomEnabled || event.deltaY === 0) return;
    const direction = event.deltaY < 0 ? 1 : -1;
    const nextZoom = stepWheelZoom(zoom, direction, [zoomLevels[0] ?? zoom, maximumZoom]);
    if (nextZoom === zoom) {
      wheelDeltaRef.current = 0;
      return;
    }
    if (Math.sign(wheelDeltaRef.current) !== Math.sign(event.deltaY)) {
      wheelDeltaRef.current = 0;
    }
    event.preventDefault();
    wheelDeltaRef.current += event.deltaY;
    if (Math.abs(wheelDeltaRef.current) < WHEEL_ZOOM_DELTA_THRESHOLD) return;
    changeZoom(nextZoom, { x: event.clientX, y: event.clientY });
  };

  const changeZoomByStep = (direction: -1 | 1) => {
    const availableLevels = zoomLevels.filter((level) => level <= maximumZoom);
    changeZoom(stepZoom(zoom, direction, availableLevels));
  };

  return {
    isPanning,
    maximumZoom,
    viewportRef,
    changeZoom,
    changeZoomByStep,
    resetViewport,
    panViewportProps: {
      tabIndex: panEnabled ? 0 : -1,
      onPointerDown: handlePointerDown,
      onPointerMove: handlePointerMove,
      onPointerUp: finishPan,
      onPointerCancel: (event: PointerEvent<HTMLDivElement>) => finishPan(event, true),
      onClickCapture: handleClickCapture,
      onKeyDown: handleKeyDown,
      onWheel: handleWheel,
      style: { touchAction: panEnabled ? "none" : "auto" },
    },
  };
}
