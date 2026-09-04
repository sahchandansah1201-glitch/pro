import {
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
} from "react";

interface PanGesture {
  pointerId: number;
  startX: number;
  startY: number;
  startScrollLeft: number;
  startScrollTop: number;
  moved: boolean;
}

export function useBodyMapViewportPan(enabled: boolean) {
  const gestureRef = useRef<PanGesture | null>(null);
  const suppressNextClickRef = useRef(false);
  const [isPanning, setIsPanning] = useState(false);

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    suppressNextClickRef.current = false;
    if (!enabled) return;
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
    if (!enabled || event.target !== event.currentTarget) return;
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

  return {
    isPanning,
    panViewportProps: {
      tabIndex: enabled ? 0 : -1,
      onPointerDown: handlePointerDown,
      onPointerMove: handlePointerMove,
      onPointerUp: finishPan,
      onPointerCancel: (event: PointerEvent<HTMLDivElement>) => finishPan(event, true),
      onClickCapture: handleClickCapture,
      onKeyDown: handleKeyDown,
      style: { touchAction: enabled ? "none" : "auto" },
    },
  };
}
