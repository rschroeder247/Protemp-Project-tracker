/**
 * Microsoft 365 Graph API Service for OneDrive Integration
 */

const TENANT_ID = process.env.MS_TENANT_ID || '';
const CLIENT_ID = process.env.MS_CLIENT_ID || '';
const CLIENT_SECRET = process.env.MS_CLIENT_SECRET || '';

export async function getGraphAccessToken(): Promise<string> {
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    scope: 'https://graph.microsoft.com/.default',
    grant_type: 'client_credentials',
  });

  const res = await fetch(
    `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
      cache: 'no-store',
    }
  );

  const data = await res.json();
  if (!res.ok || data.error) {
    throw new Error(
      `Failed to obtain MS Graph token: ${data.error_description || data.error}`
    );
  }

  return data.access_token;
}

/**
 * Searches across all OneDrive drives and SharePoint sites for the specified file name
 * and returns its text content (e.g. Master Project.xml).
 */
/**
 * Helper to search an individual drive for the target file and download its content
 */
async function searchDriveForFile(
  driveId: string,
  fileName: string,
  token: string
): Promise<{ fileName: string; content: string; webUrl?: string; lastModifiedDateTime?: string } | null> {
  try {
    const searchRes = await fetch(
      `https://graph.microsoft.com/v1.0/drives/${driveId}/root/search(q='${encodeURIComponent(
        fileName
      )}')`,
      {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      }
    );
    if (!searchRes.ok) return null;
    const searchData = await searchRes.json();
    const files = searchData.value || [];

    const matchingFiles = files
      .filter((f: any) => f.name && f.name.toLowerCase() === fileName.toLowerCase())
      .sort((a: any, b: any) => {
        // Deprioritize folders like "new folder", "archive", "old"
        const aUrl = (a.webUrl || '').toLowerCase();
        const bUrl = (b.webUrl || '').toLowerCase();
        const aOld = aUrl.includes('new%20folder') || aUrl.includes('archive') || aUrl.includes('temp');
        const bOld = bUrl.includes('new%20folder') || bUrl.includes('archive') || bUrl.includes('temp');
        if (aOld && !bOld) return 1;
        if (!aOld && bOld) return -1;
        // Prioritize newest modified date
        const timeA = new Date(a.lastModifiedDateTime || 0).getTime();
        const timeB = new Date(b.lastModifiedDateTime || 0).getTime();
        return timeB - timeA;
      });

    const targetFile = matchingFiles[0];

    if (targetFile) {
      const contentRes = await fetch(
        `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${targetFile.id}/content`,
        {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store',
        }
      );
      if (contentRes.ok) {
        const content = await contentRes.text();
        return {
          fileName: targetFile.name,
          content,
          webUrl: targetFile.webUrl,
          lastModifiedDateTime: targetFile.lastModifiedDateTime,
        };
      }
    }
  } catch (e) {
    // Ignore and proceed to next drive
  }
  return null;
}

/**
 * Searches across all OneDrive drives, SharePoint sites, and user personal drives
 * for the specified file name and returns its text content (e.g. Master Project.xml).
 */
export async function downloadFileFromOneDrive(
  fileName: string = 'Master Project.xml'
): Promise<{ fileName: string; content: string; webUrl?: string; lastModifiedDateTime?: string }> {
  const token = await getGraphAccessToken();

  // 0. Fast-path: Check direct known SharePoint path first (< 1s)
  const knownDriveId = 'b!aJuWp9LDrU21DuedJYC4tY_NzGRevhlNm5XuWgvDqs1wyQwrTeW9RLE212NNjDCH';
  try {
    const metaRes = await fetch(
      `https://graph.microsoft.com/v1.0/drives/${knownDriveId}/root:/Protemp%20Operations/MS%20Project/${encodeURIComponent(
        fileName
      )}`,
      {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      }
    );
    if (metaRes.ok) {
      const meta = await metaRes.json();
      const contentRes = await fetch(
        `https://graph.microsoft.com/v1.0/drives/${knownDriveId}/items/${meta.id}/content`,
        {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store',
        }
      );
      if (contentRes.ok) {
        const content = await contentRes.text();
        return {
          fileName: meta.name,
          content,
          webUrl: meta.webUrl,
          lastModifiedDateTime: meta.lastModifiedDateTime,
        };
      }
    }
  } catch (e) {
    // Fall back to exhaustive search
  }

  // 1. Search in tenant-level drives
  try {
    const drivesRes = await fetch('https://graph.microsoft.com/v1.0/drives', {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    if (drivesRes.ok) {
      const drivesData = await drivesRes.json();
      for (const drive of drivesData.value || []) {
        const found = await searchDriveForFile(drive.id, fileName, token);
        if (found) return found;
      }
    }
  } catch (e) {
    // proceed
  }

  // 2. Search root SharePoint site and all SharePoint sites
  try {
    const rootSiteRes = await fetch('https://graph.microsoft.com/v1.0/sites/root/drives', {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    if (rootSiteRes.ok) {
      const rootDrives = await rootSiteRes.json();
      for (const drive of rootDrives.value || []) {
        const found = await searchDriveForFile(drive.id, fileName, token);
        if (found) return found;
      }
    }

    const sitesRes = await fetch('https://graph.microsoft.com/v1.0/sites?search=*', {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    if (sitesRes.ok) {
      const sitesData = await sitesRes.json();
      for (const site of sitesData.value || []) {
        const siteDrivesRes = await fetch(
          `https://graph.microsoft.com/v1.0/sites/${site.id}/drives`,
          {
            headers: { Authorization: `Bearer ${token}` },
            cache: 'no-store',
          }
        );
        if (siteDrivesRes.ok) {
          const siteDrives = await siteDrivesRes.json();
          for (const drive of siteDrives.value || []) {
            const found = await searchDriveForFile(drive.id, fileName, token);
            if (found) return found;
          }
        }
      }
    }
  } catch (e) {
    // proceed
  }

  // 3. Search user personal OneDrive drives (focusing on Roland, Operations, Projects, etc.)
  try {
    const usersRes = await fetch('https://graph.microsoft.com/v1.0/users', {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    if (usersRes.ok) {
      const usersData = await usersRes.json();
      for (const user of usersData.value || []) {
        try {
          const userDriveRes = await fetch(
            `https://graph.microsoft.com/v1.0/users/${user.id}/drive`,
            {
              headers: { Authorization: `Bearer ${token}` },
              cache: 'no-store',
            }
          );
          if (userDriveRes.ok) {
            const userDrive = await userDriveRes.json();
            if (userDrive && userDrive.id) {
              const found = await searchDriveForFile(userDrive.id, fileName, token);
              if (found) return found;
            }
          }
        } catch {
          // ignore individual user error
        }
      }
    }
  } catch (e) {
    // proceed
  }

  throw new Error(
    `File "${fileName}" not found in any OneDrive or SharePoint drive. Please verify the file name and that Azure admin consent for Files.Read.All and Sites.Read.All is granted.`
  );
}

