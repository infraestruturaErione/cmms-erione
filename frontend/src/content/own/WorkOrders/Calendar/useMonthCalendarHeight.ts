import { RefObject, useEffect, useState } from 'react';

export default function useMonthCalendarHeight(
  gridRef: RefObject<HTMLDivElement>,
  enabled: boolean,
  mobileBreakpoint: number
) {
  const [height, setHeight] = useState(840);

  useEffect(() => {
    const grid = gridRef.current;
    if (!enabled || !grid) return undefined;

    let frame = 0;
    const measure = () => {
      // Document coordinates keep page scrolling from changing the grid height.
      const top = grid.getBoundingClientRect().top + window.scrollY;
      const minimum = window.innerWidth < mobileBreakpoint ? 720 : 840;
      setHeight(Math.max(minimum, Math.floor(window.innerHeight - top - 24)));
    };
    const scheduleMeasure = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(measure);
    };

    measure();
    window.addEventListener('resize', scheduleMeasure);
    // Re-measure when controls wrap or the empty-state banner changes height.
    const observer = new ResizeObserver(scheduleMeasure);
    observer.observe(grid.parentElement.parentElement);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('resize', scheduleMeasure);
      observer.disconnect();
    };
  }, [enabled, gridRef, mobileBreakpoint]);

  return enabled ? height : 660;
}
