import { useLayoutEffect } from 'react';
import { blockLocalWorkOrderRemoval } from '../utils/localWorkOrderActivity';

export default function useLocalWorkOrderRemovalBlock(
  id: number,
  blocked: boolean
) {
  useLayoutEffect(() => {
    if (blocked) return blockLocalWorkOrderRemoval(id);
  }, [id, blocked]);
}
