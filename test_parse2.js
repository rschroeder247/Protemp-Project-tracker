const fs = require('fs');
const { XMLParser } = require('fast-xml-parser');

const p = "C:\\Users\\RolandSchroeder\\Downloads\\AVI_Line4_Site_Installation.xml";
if (fs.existsSync(p)) {
  const xml = fs.readFileSync(p, 'utf-8');
  console.log("Downloads XML size:", xml.length);
  const parser = new XMLParser();
  const parsed = parser.parse(xml);
  const rawTasks = parsed.Project?.Tasks?.Task;
  console.log("Tasks in Downloads XML:", Array.isArray(rawTasks) ? rawTasks.length : typeof rawTasks);
  if (Array.isArray(rawTasks)) {
    console.log("Sample 3 tasks:", JSON.stringify(rawTasks.slice(0, 3).map(t => ({ UID: t.UID, Name: t.Name, WBS: t.WBS, Summary: t.Summary })), null, 2));
  }
}
