import { renderHook, fireEvent } from '@testing-library/react';
import { useSwipe } from '../useSwipe';

describe('touch song navigation', () => {
  let container: HTMLDivElement;
  let now = 0;
  const onNext = vi.fn();
  const onPrev = vi.fn();
  beforeEach(() => {
    vi.clearAllMocks();
    now = 1000;
    vi.spyOn(Date, 'now').mockImplementation(() => now);
    container = document.createElement('div');
    document.body.append(container);
  });
  afterEach(() => { container.remove(); vi.restoreAllMocks(); });

  const setup = (enabled = true) => {
    const { result } = renderHook(() => useSwipe({ onNext, onPrev, enabled }));
    result.current(container);
  };
  // `at` advances the clock, since jsdom stamps events with Date.now().
  const pointer = (pointerType = 'touch', target: Element = container) => {
    const init = (x: number, y: number) => ({ pointerId: 1, pointerType, button: 0, clientX: x, clientY: y });
    return {
      down: (x: number, y = 0) => fireEvent.pointerDown(target, init(x, y)),
      move: (x: number, y = 0, at = 20) => { now += at; fireEvent.pointerMove(target, init(x, y)); },
      up: (x: number, y = 0, at = 20) => { now += at; fireEvent.pointerUp(target, init(x, y)); },
      cancel: (x: number, y = 0) => fireEvent.pointerCancel(target, init(x, y)),
    };
  };

  it('a left swipe goes to the next song and a right swipe to the previous one', () => {
    setup();
    const p = pointer();
    p.down(200); p.move(150, 0, 200); p.move(110, 0, 200); p.up(110, 0, 200);
    expect(onNext).toHaveBeenCalledOnce();
    p.down(100); p.move(150, 0, 200); p.move(190, 0, 200); p.up(190, 0, 200);
    expect(onPrev).toHaveBeenCalledOnce();
  });

  it('a short fast flick navigates but a short slow drag does not', () => {
    setup();
    const p = pointer();
    p.down(100); p.move(85, 0, 10); p.move(75, 0, 10); p.up(75, 0, 10);
    expect(onNext).toHaveBeenCalledOnce();
    p.down(100); p.move(90, 0, 200); p.move(80, 0, 200); p.up(80, 0, 200);
    expect(onNext).toHaveBeenCalledOnce();
  });

  it('a tiny quick wobble is not a flick', () => {
    setup();
    const p = pointer();
    p.down(100); p.move(94, 0, 5); p.up(94, 0, 5);
    expect(onNext).not.toHaveBeenCalled();
  });

  it('keeps vertical scrolling separate from horizontal navigation', () => {
    setup();
    const p = pointer();
    p.down(0); p.move(5, 70); p.move(20, 150); p.up(20, 150);
    expect(onPrev).not.toHaveBeenCalled();
  });

  it('does not navigate after a canceled gesture', () => {
    setup();
    const p = pointer();
    p.down(0); p.move(60); p.move(100); p.cancel(100);
    expect(onPrev).not.toHaveBeenCalled();
  });

  it('does not swipe when touching a control or a no-swipe area', () => {
    container.innerHTML = '<button><span>Fit</span></button><div data-no-swipe><p>dock</p></div>';
    setup();
    for (const target of [container.querySelector('span')!, container.querySelector('p')!]) {
      const p = pointer('touch', target);
      p.down(0); p.move(60); p.move(100); p.up(100);
    }
    expect(onPrev).not.toHaveBeenCalled();
  });

  it('ignores the mouse but accepts a pen', () => {
    setup();
    const mouse = pointer('mouse');
    mouse.down(0); mouse.move(60); mouse.move(100); mouse.up(100);
    expect(onPrev).not.toHaveBeenCalled();
    const pen = pointer('pen');
    pen.down(0); pen.move(60); pen.move(100); pen.up(100);
    expect(onPrev).toHaveBeenCalledOnce();
  });

  it('does nothing while disabled', () => {
    setup(false);
    const p = pointer();
    p.down(0); p.move(60); p.move(100); p.up(100);
    expect(onPrev).not.toHaveBeenCalled();
  });
});
