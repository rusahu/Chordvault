import { useDrag } from '@mantine/hooks';

const SWIPE_DISTANCE = 50;
const SWIPE_SPEED = 0.3; // px/ms averaged over the whole gesture
const MIN_FLICK = 10;
const NOT_SWIPEABLE = 'button, a, input, label, textarea, select, [role="button"], [data-no-swipe]';

interface SwipeOptions {
  onNext: () => void;
  onPrev: () => void;
  enabled: boolean;
}

/** Horizontal touch or pen swipe between songs; returns the ref for the swipe area. */
export function useSwipe({ onNext, onPrev, enabled }: SwipeOptions) {
  const { ref } = useDrag(({ first, last, canceled, cancel, movement: [dx], elapsedTime, event }) => {
    if (first && (event.pointerType === 'mouse' || (event.target instanceof Element && event.target.closest(NOT_SWIPEABLE)))) {
      cancel();
      return;
    }
    if (!last || canceled) return;
    const distance = Math.abs(dx);
    if (distance > SWIPE_DISTANCE || (distance >= MIN_FLICK && distance / Math.max(1, elapsedTime) > SWIPE_SPEED)) {
      if (dx < 0) onNext();
      else onPrev();
    }
  }, { axis: 'lock', axisThreshold: 8, threshold: 5, enabled });
  return ref;
}
