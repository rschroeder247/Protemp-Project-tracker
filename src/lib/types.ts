export type UserRole = 'owner' | 'staff' | 'contractor' | 'viewer';

export interface UserProfile {
  user_id: string;
  username: string;
  display_name: string;
  role: UserRole;
  active: boolean;
}

export interface TaskNode {
  id: string;
  projectId: string;
  projectName: string;
  subprojectName: string;
  wbs: string;
  outlineLevel: number;
  name: string;
  isSummary: boolean;
  quotedHours: number;
  durationDays?: number;
  notes?: string;
  
  // Progress state
  isLocked?: boolean;
  doneByName?: string;
  tickedAt?: string;
  savedAt?: string;
  savedBy?: string;
  
  // Tree hierarchy
  children?: TaskNode[];
}

export interface ProjectSummary {
  id: string;
  name: string;
  totalTasks: number;
  completedTasks: number;
  totalQuotedHours: number;
  earnedHours: number;
  progressPct: number;
  subprojects: string[];
}

export interface PendingChange {
  taskId: string;
  kind: 'tick' | 'untick' | 'unlock' | 'notes';
  doneByName: string;
  tickedAt: string;
  notes?: string;
}
