import { XMLParser } from 'fast-xml-parser';
import { RawProjectTask } from './msproject';

/**
 * Parses ISO 8601 duration strings commonly used by MS Project XML:
 * e.g., "PT8H0M0S" -> 8, "PT4H30M0S" -> 4.5
 */
export function parseIsoDurationToHours(durationStr: string): number {
  if (!durationStr) return 0;
  const match = durationStr.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?/i);
  if (!match) {
    const num = parseFloat(durationStr);
    return isNaN(num) ? 0 : num;
  }
  const hours = parseInt(match[1] || '0', 10);
  const minutes = parseInt(match[2] || '0', 10);
  const seconds = parseFloat(match[3] || '0');
  return Number((hours + minutes / 60 + seconds / 3600).toFixed(2));
}

function extractTasksFromXmlProject(
  proj: any,
  defaultSubproject: string = 'Master Project'
): { projectName: string; tasks: RawProjectTask[] } {
  const projectName = proj.Title || proj.Name || defaultSubproject;
  const rawTasks = proj.Tasks?.Task;
  if (!rawTasks) {
    return { projectName, tasks: [] };
  }

  const taskList = Array.isArray(rawTasks) ? rawTasks : [rawTasks];
  const tasks: RawProjectTask[] = [];

  // Check if this project contains linked subprojects (<Task> with <Project> or <IsSubproject>1)
  const subprojectTasks = taskList.filter(
    (t: any) => t.Project || String(t.IsSubproject) === '1'
  );
  const isMasterWithSubprojects = subprojectTasks.length > 0;

  if (isMasterWithSubprojects) {
    for (const subprojTask of subprojectTasks) {
      const spUid = String(subprojTask.UID ?? subprojTask.ID ?? '');
      if (spUid === '0') continue;

      const subprojName = String(
        subprojTask.Name ||
        subprojTask.Project?.Title ||
        subprojTask.Project?.Name ||
        'Subproject'
      ).trim();

      const spId = subprojName.toLowerCase().replace(/[^a-z0-9]/g, '-');
      const isSiteInstallation =
        spId.includes('site-installation') || spId.includes('e-i');

      // 1. Add Tier 1 Subproject Container (OutlineLevel = 1)
      tasks.push({
        id: `sp_${spUid}`,
        projectId: spId,
        projectName,
        subprojectName: subprojName,
        wbs: String(subprojTask.WBS || subprojTask.OutlineNumber || '1'),
        outlineLevel: 1, // Tier 1!
        name: subprojName,
        isSummary: true,
        quotedHours: parseIsoDurationToHours(String(subprojTask.Work || '')),
        durationDays: subprojTask.Duration
          ? parseIsoDurationToHours(String(subprojTask.Duration)) / 8
          : 0,
        notes: subprojTask.Notes ? String(subprojTask.Notes) : '',
        percentComplete: parseInt(subprojTask.PercentComplete || '0', 10),
      });

      // 2. Process child tasks inside the linked subproject
      if (subprojTask.Project && subprojTask.Project.Tasks?.Task) {
        const nestedRaw = subprojTask.Project.Tasks.Task;
        const nestedList = Array.isArray(nestedRaw) ? nestedRaw : [nestedRaw];

        for (const t of nestedList) {
          const uid = String(t.UID ?? t.ID ?? '');
          if (uid === '0') continue;

          const rawLevel = parseInt(t.OutlineLevel || '1', 10);
          // Shift by +1 so subproject root is Level 1 (Tier 1), and its headings become Level 2 (Tier 2 tabs)!
          const outlineLevel = rawLevel + 1;
          const isSummary =
            String(t.Summary) === '1' || String(t.Summary) === 'true';
          const name = String(t.Name || 'Unnamed Task').trim();
          const wbs = String(t.WBS || t.OutlineNumber || uid).trim();
          const workStr = String(t.Work || '');
          const quotedHours = parseIsoDurationToHours(workStr);
          const percentComplete = parseInt(t.PercentComplete || '0', 10);

          // Preserve exact task_${uid} for Site Installation so existing DB progress records match,
          // while prefixing other subprojects to avoid UID collisions.
          const taskId = isSiteInstallation
            ? `task_${uid}`
            : `task_${spId.substring(0, 8)}_${uid}`;

          tasks.push({
            id: taskId,
            projectId: spId,
            projectName,
            subprojectName: subprojName,
            wbs,
            outlineLevel,
            name,
            isSummary,
            quotedHours,
            durationDays: t.Duration
              ? parseIsoDurationToHours(String(t.Duration)) / 8
              : 0,
            notes: t.Notes ? String(t.Notes) : '',
            percentComplete,
          });
        }
      }
    }
  } else {
    // Normal single project without linked subprojects
    let currentSubproject = projectName;

    for (const t of taskList) {
      const uid = String(t.UID ?? t.ID ?? '');
      if (uid === '0') continue;

      const outlineLevel = parseInt(t.OutlineLevel || '1', 10);
      const isSummary =
        String(t.Summary) === '1' || String(t.Summary) === 'true';
      const name = String(t.Name || 'Unnamed Task').trim();
      const wbs = String(t.WBS || t.OutlineNumber || uid).trim();

      if (outlineLevel === 1) {
        currentSubproject = name;
      }

      const subprojectName = t.Subproject || currentSubproject;
      const workStr = String(t.Work || '');
      const quotedHours = parseIsoDurationToHours(workStr);
      const percentComplete = parseInt(t.PercentComplete || '0', 10);

      tasks.push({
        id: uid,
        projectId: 'master',
        projectName,
        subprojectName,
        wbs,
        outlineLevel,
        name,
        isSummary,
        quotedHours,
        durationDays: t.Duration
          ? parseIsoDurationToHours(String(t.Duration)) / 8
          : 0,
        notes: t.Notes ? String(t.Notes) : '',
        percentComplete,
      });
    }
  }

  return { projectName, tasks };
}

/**
 * Parses an MS Project XML file string into our RawProjectTask model.
 * Fully supports master projects with nested linked subprojects.
 */
export function parseMsProjectXml(xmlContent: string): {
  projectName: string;
  tasks: RawProjectTask[];
} {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    textNodeName: '#text',
  });

  const parsed = parser.parse(xmlContent);
  const project = parsed.Project || parsed;

  return extractTasksFromXmlProject(project, 'Master Project');
}
