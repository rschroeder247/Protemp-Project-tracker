const fs = require('fs');
const { XMLParser } = require('fast-xml-parser');

const xmlPath = "C:\\Users\\RolandSchroeder\\OneDrive - Protemp\\Protemp Operations\\MS Project\\Master Project.xml";
console.log("Reading:", xmlPath);
const xml = fs.readFileSync(xmlPath, 'utf-8');
console.log("Size:", xml.length, "bytes");

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
});

const parsed = parser.parse(xml);
const project = parsed.Project || parsed;
console.log("Project Title:", project.Title || project.Name);

const rawTasks = project.Tasks?.Task;
console.log("Tasks found:", Array.isArray(rawTasks) ? rawTasks.length : typeof rawTasks);

if (Array.isArray(rawTasks)) {
  const sample = rawTasks.slice(0, 10).map(t => ({
    UID: t.UID,
    ID: t.ID,
    Name: t.Name,
    WBS: t.WBS,
    OutlineLevel: t.OutlineLevel,
    Summary: t.Summary,
    Work: t.Work,
    Subproject: t.Subproject
  }));
  console.log("Sample tasks:", JSON.stringify(sample, null, 2));
}
