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
