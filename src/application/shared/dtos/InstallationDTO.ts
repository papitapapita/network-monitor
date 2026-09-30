// What this install runs, fixed at boot (INS-009). The dashboard reads it to
// hide what the install does not offer instead of letting a click fail.
export interface InstallationDTO {
  // The optional modules (ENABLED_MODULES); the monitoring core is always on.
  modules: {
    customers: boolean;
    billing: boolean;
    quoting: boolean;
    tickets: boolean;
    enforcement: boolean;
  };
  // SERVER_ON_SITE (INS-041): false refuses server-side actions on devices
  // behind an agent and the network scan.
  serverOnSite: boolean;
  // AGENT_PUBLIC_URL is set, so agents can be created and paired (AGT-007).
  agentPairingAvailable: boolean;
  // INSTALLERS_DIR is set, so agent installers can be listed and downloaded
  // (INS-042).
  installersAvailable: boolean;
}
