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
export async function downloadFileFromOneDrive(
  fileName: string = 'Master Project.xml'
): Promise<{ fileName: string; content: string; webUrl?: string }> {
  const token = await getGraphAccessToken();

  // 1. Search in all available drives in the tenant
  const drivesRes = await fetch('https://graph.microsoft.com/v1.0/drives', {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  const drivesData = await drivesRes.json();
  const drives = drivesData.value || [];

  for (const drive of drives) {
    const searchRes = await fetch(
      `https://graph.microsoft.com/v1.0/drives/${drive.id}/root/search(q='${encodeURIComponent(
        fileName
      )}')`,
      {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      }
    );
    const searchData = await searchRes.json();
    const files = searchData.value || [];

    const targetFile = files.find(
      (f: any) => f.name.toLowerCase() === fileName.toLowerCase()
    );

    if (targetFile) {
      // Download content
      const contentRes = await fetch(
        `https://graph.microsoft.com/v1.0/drives/${drive.id}/items/${targetFile.id}/content`,
        {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store',
        }
      );

      if (!contentRes.ok) {
        throw new Error(`Failed to download ${fileName} from drive: ${contentRes.statusText}`);
      }

      const content = await contentRes.text();
      return {
        fileName: targetFile.name,
        content,
        webUrl: targetFile.webUrl,
      };
    }
  }

  // 2. Also search SharePoint sites
  const sitesRes = await fetch(
    `https://graph.microsoft.com/v1.0/sites?search=Protemp`,
    {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    }
  );
  const sitesData = await sitesRes.json();
  const sites = sitesData.value || [];

  for (const site of sites) {
    const siteDrivesRes = await fetch(
      `https://graph.microsoft.com/v1.0/sites/${site.id}/drives`,
      {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      }
    );
    const siteDrives = (await siteDrivesRes.json()).value || [];

    for (const drive of siteDrives) {
      const searchRes = await fetch(
        `https://graph.microsoft.com/v1.0/drives/${drive.id}/root/search(q='${encodeURIComponent(
          fileName
        )}')`,
        {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store',
        }
      );
      const searchData = await searchRes.json();
      const files = searchData.value || [];

      const targetFile = files.find(
        (f: any) => f.name.toLowerCase() === fileName.toLowerCase()
      );

      if (targetFile) {
        const contentRes = await fetch(
          `https://graph.microsoft.com/v1.0/drives/${drive.id}/items/${targetFile.id}/content`,
          {
            headers: { Authorization: `Bearer ${token}` },
            cache: 'no-store',
          }
        );

        if (!contentRes.ok) {
          throw new Error(`Failed to download ${fileName}: ${contentRes.statusText}`);
        }

        const content = await contentRes.text();
        return {
          fileName: targetFile.name,
          content,
          webUrl: targetFile.webUrl,
        };
      }
    }
  }

  throw new Error(
    `File "${fileName}" not found in any OneDrive or SharePoint drive. Please verify the file name and that Azure admin consent for Files.Read.All is granted.`
  );
}
