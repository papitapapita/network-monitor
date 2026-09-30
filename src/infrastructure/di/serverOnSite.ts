// Whether this backend sits on the monitored network and can reach its
// devices itself. Unset means yes: every install so far runs next to its
// network, and it keeps working exactly as before. A backend hosted off site
// (a VPS) sets false; devices behind an on-site agent are then out of its
// reach, and features that talk to a device from the server are refused for
// them instead of timing out. A value that is neither stops the boot.
export function loadServerOnSite(env: NodeJS.ProcessEnv): boolean {
  const raw = env.SERVER_ON_SITE?.trim().toLowerCase();
  if (!raw || raw === 'true') return true;
  if (raw === 'false') return false;
  throw new Error(
    `SERVER_ON_SITE: expected true or false, got "${env.SERVER_ON_SITE}"`
  );
}
