import { TaskNode, ProjectSummary } from './types';

/**
 * Calculates rollups across a flexible task tree:
 * Leaf tasks provide the actual hours and completion state.
 * Summary tasks roll up completed tasks and earned hours from their descendants.
 */
export function calculateTreeStats(tasks: TaskNode[]): {
  totalLeafTasks: number;
  completedLeafTasks: number;
  totalQuotedHours: number;
  earnedHours: number;
  hoursPct: number;
} {
  let totalLeafTasks = 0;
  let completedLeafTasks = 0;
  let totalQuotedHours = 0;
  let earnedHours = 0;

  function traverse(node: TaskNode) {
    if (!node.isSummary) {
      totalLeafTasks += 1;
      const hrs = Number(node.quotedHours) || 0;
      totalQuotedHours += hrs;
      if (node.isLocked) {
        completedLeafTasks += 1;
        earnedHours += hrs;
      }
    }
    if (node.children && node.children.length > 0) {
      for (const child of node.children) {
        traverse(child);
      }
    }
  }

  for (const t of tasks) {
    traverse(t);
  }

  const hoursPct = totalQuotedHours > 0 ? (earnedHours / totalQuotedHours) * 100 : 0;

  return {
    totalLeafTasks,
    completedLeafTasks,
    totalQuotedHours: Number(totalQuotedHours.toFixed(1)),
    earnedHours: Number(earnedHours.toFixed(1)),
    hoursPct: Number(hoursPct.toFixed(1)),
  };
}

/**
 * Groups flat tasks with WBS or outline levels into a nested tree structure.
 */
export function buildTaskTree(flatTasks: TaskNode[]): TaskNode[] {
  const rootNodes: TaskNode[] = [];
  const stack: TaskNode[] = [];

  for (const task of flatTasks) {
    const node: TaskNode = { ...task, children: [] };

    while (stack.length > 0 && stack[stack.length - 1].outlineLevel >= node.outlineLevel) {
      stack.pop();
    }

    if (stack.length === 0) {
      rootNodes.push(node);
    } else {
      const parent = stack[stack.length - 1];
      if (!parent.children) parent.children = [];
      parent.children.push(node);
    }

    if (node.isSummary) {
      stack.push(node);
    }
  }

  return rootNodes;
}

/**
 * Recursively collects all summary node IDs in a tree.
 */
export function getAllSummaryIds(nodes: TaskNode[]): Set<string> {
  const ids = new Set<string>();
  function traverse(node: TaskNode) {
    if (node.isSummary) {
      ids.add(node.id);
      if (node.children && node.children.length > 0) {
        for (const child of node.children) {
          traverse(child);
        }
      }
    }
  }
  for (const n of nodes) {
    traverse(n);
  }
  return ids;
}

/**
 * Filters a task tree based on a search term across task name, WBS, or technician name.
 * Preserves parent-child hierarchy and identifies parent IDs to auto-expand.
 */
export function filterTreeByQuery(
  nodes: TaskNode[],
  query: string
): {
  filteredNodes: TaskNode[];
  matchCount: number;
  autoExpandIds: Set<string>;
} {
  const q = query.trim().toLowerCase();
  if (!q) {
    return { filteredNodes: nodes, matchCount: 0, autoExpandIds: new Set() };
  }

  const autoExpandIds = new Set<string>();
  let matchCount = 0;

  function filterNode(node: TaskNode): TaskNode | null {
    const nameMatch = node.name.toLowerCase().includes(q);
    const wbsMatch = node.wbs ? node.wbs.toLowerCase().includes(q) : false;
    const doneByMatch = node.doneByName ? node.doneByName.toLowerCase().includes(q) : false;
    const notesMatch = node.notes ? node.notes.toLowerCase().includes(q) : false;
    const isSelfMatch = nameMatch || wbsMatch || doneByMatch || notesMatch;

    if (!node.isSummary) {
      if (isSelfMatch) {
        matchCount++;
        return { ...node };
      }
      return null;
    }

    // Filter children of summary
    const matchedChildren: TaskNode[] = [];
    if (node.children && node.children.length > 0) {
      for (const child of node.children) {
        const filteredChild = filterNode(child);
        if (filteredChild) {
          matchedChildren.push(filteredChild);
        }
      }
    }

    // Keep summary if it matches itself or any child matches
    if (isSelfMatch || matchedChildren.length > 0) {
      if (isSelfMatch) matchCount++;
      autoExpandIds.add(node.id);
      return {
        ...node,
        children: matchedChildren.length > 0 ? matchedChildren : (node.children || []),
      };
    }

    return null;
  }

  const filteredNodes: TaskNode[] = [];
  for (const node of nodes) {
    const filtered = filterNode(node);
    if (filtered) {
      filteredNodes.push(filtered);
    }
  }

  return { filteredNodes, matchCount, autoExpandIds };
}

/**
 * Recursively filters a task tree to hide completed tasks.
 * If hideCompleted is true:
 * - Leaf tasks that are completed (isLocked === true or pending in pendingTicks) are excluded.
 * - Summary tasks with no remaining pending children are also excluded.
 */
export function filterTreeByCompletion(
  nodes: TaskNode[],
  hideCompleted: boolean,
  pendingTicks?: Record<string, any>
): TaskNode[] {
  if (!hideCompleted) return nodes;

  function filterNode(node: TaskNode): TaskNode | null {
    const isDone = node.isLocked || (pendingTicks && !!pendingTicks[node.id]);

    if (!node.isSummary) {
      if (isDone) {
        return null;
      }
      return { ...node };
    }

    if (!node.children || node.children.length === 0) {
      return null;
    }

    const remainingChildren: TaskNode[] = [];
    for (const child of node.children) {
      const filtered = filterNode(child);
      if (filtered) {
        remainingChildren.push(filtered);
      }
    }

    if (remainingChildren.length === 0) {
      return null;
    }

    return {
      ...node,
      children: remainingChildren,
    };
  }

  const result: TaskNode[] = [];
  for (const node of nodes) {
    const filtered = filterNode(node);
    if (filtered) {
      result.push(filtered);
    }
  }

  return result;
}


