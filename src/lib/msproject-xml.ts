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

  let currentSubproject = projectName;

  for (const t of taskList) {
    const uid = String(t.UID ?? t.ID ?? '');
    if (uid === '0') continue;

    // In MS Project XML, linked subprojects are embedded as nested <Project> inside a <Task>!
    if (t.Project) {
      const nested = extractTasksFromXmlProject(t.Project, t.Name || currentSubproject);
      tasks.push(...nested.tasks);
      continue;
    }

    const outlineLevel = parseInt(t.OutlineLevel || '1', 10);
    const isSummary = String(t.Summary) === '1' || String(t.Summary) === 'true';
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
      durationDays: t.Duration ? parseIsoDurationToHours(String(t.Duration)) / 8 : 0,
      notes: t.Notes ? String(t.Notes) : '',
      percentComplete,
    });
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
