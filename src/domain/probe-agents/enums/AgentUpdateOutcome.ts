// How an agent's last self-update ended (AGT-084), as the agent reports it.
export enum AgentUpdateOutcome {
  // The new version runs and reached the backend.
  INSTALLED = 'INSTALLED',
  // The new version did not reach the backend in time; the previous one was
  // put back and runs again.
  ROLLED_BACK = 'ROLLED_BACK',
  // Refused before it replaced anything: download, checksum, signature or
  // self-test failed.
  REJECTED = 'REJECTED'
}
