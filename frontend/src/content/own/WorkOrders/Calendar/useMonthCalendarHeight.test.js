import React, { useRef } from 'react';
import ReactDOM from 'react-dom';
import { act } from 'react-dom/test-utils';
import useMonthCalendarHeight from './useMonthCalendarHeight';

function CalendarHeightProbe({ enabled = true }) {
  const ref = useRef(null);
  const height = useMonthCalendarHeight(ref, enabled, 600);
  return (
    <div>
      <div>
        <div ref={ref} data-height={height} />
      </div>
    </div>
  );
}

describe('monthly calendar viewport height', () => {
  let container;
  let top;
  let observerCallback;
  let disconnect;
  const originalObserver = window.ResizeObserver;
  const originalViewport = {
    innerWidth: window.innerWidth,
    innerHeight: window.innerHeight,
    scrollY: window.scrollY
  };

  const render = (enabled = true) => {
    act(() => {
      ReactDOM.render(<CalendarHeightProbe enabled={enabled} />, container);
    });
  };
  const height = () =>
    Number(container.querySelector('[data-height]').dataset.height);
  const resize = (width, viewportHeight) => {
    window.innerWidth = width;
    window.innerHeight = viewportHeight;
    act(() => {
      window.dispatchEvent(new Event('resize'));
      jest.runOnlyPendingTimers();
    });
  };

  beforeEach(() => {
    jest.useFakeTimers();
    container = document.createElement('div');
    document.body.appendChild(container);
    top = 260;
    window.innerWidth = 1440;
    window.innerHeight = 900;
    window.scrollY = 0;
    disconnect = jest.fn();
    window.ResizeObserver = jest.fn().mockImplementation((callback) => {
      observerCallback = callback;
      return { observe: jest.fn(), disconnect };
    });
    jest
      .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
      .mockImplementation(() => ({ top }));
  });

  afterEach(() => {
    act(() => {
      ReactDOM.unmountComponentAtNode(container);
    });
    container.remove();
    jest.restoreAllMocks();
    jest.useRealTimers();
    window.ResizeObserver = originalObserver;
    Object.assign(window, originalViewport);
  });

  it.each([
    [1366, 768],
    [1440, 900],
    [1920, 1080]
  ])(
    'keeps comfortable day rows at %ix%i, allowing page scrolling',
    (width, viewportHeight) => {
      render();
      resize(width, viewportHeight);
      expect(height()).toBe(840);
    }
  );

  it('fills the remaining viewport on a tall desktop rather than staying fixed', () => {
    render();
    resize(2560, 1440);
    expect(height()).toBe(1156);
  });

  it('uses a smaller minimum on narrow screens and updates on resizing', () => {
    render();
    resize(390, 844);
    expect(height()).toBe(720);
    resize(1440, 900);
    expect(height()).toBe(840);
  });

  it('re-measures header changes but does not grow as the page scrolls', () => {
    window.innerHeight = 1440;
    render();
    top = 300;
    act(() => {
      observerCallback();
      jest.runOnlyPendingTimers();
    });
    expect(height()).toBe(1116);
    window.scrollY = 100;
    top = 200;
    act(() => {
      observerCallback();
      jest.runOnlyPendingTimers();
    });
    expect(height()).toBe(1116);
  });

  it('preserves 660px for other views and disconnects the monthly observer', () => {
    render();
    render(false);
    expect(height()).toBe(660);
    expect(disconnect).toHaveBeenCalledTimes(1);
    resize(2560, 1440);
    expect(height()).toBe(660);
    render(true);
    expect(height()).toBe(1156);
  });
});
