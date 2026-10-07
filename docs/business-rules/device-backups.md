# Device Backups — Business Rules

Automatic copies of the main devices' configuration. When an access point dies
or someone breaks its settings, the last good configuration is one download
away instead of being rebuilt from memory.

Format and conventions: [README.md](README.md).

## ID ranges

| Range                 | Area                                      |
| --------------------- | ----------------------------------------- |
| `BKP-001` … `BKP-009` | What a backup is and when it is a new one |
| `BKP-010` … `BKP-019` | Which devices, when, and what is refused  |
| `BKP-020` … `BKP-029` | Attempt history per device                |
| `BKP-030` … `BKP-039` | Retention                                 |
| `BKP-040` … `BKP-049` | Secrecy and access                        |
| `BKP-050` … `BKP-059` | Vendors and the HTTP surface              |
| `BKP-060` … `BKP-069` | Alerts                                    |
| `BKP-070` … `BKP-079` | Comparing versions                        |

## Layer coverage

| Layer                          | Rules |
| ------------------------------ | ----- |
| Domain (aggregate)             | 9     |
| Domain (service)               | 4     |
| Domain (service) + Application | 1     |
| Domain + Application           | 5     |
| Application                    | 4     |
| Application + Infrastructure   | 2     |
| Application + Presentation     | 1     |
| Infrastructure                 | 8     |
| Infrastructure (database)      | 1     |
| Presentation                   | 3     |

AirOS access points and MikroTik routers and switches, read by this server
itself, with change and failure alerts and a comparison of any two versions.
Stations, other vendors' routers and switches, and backups through the agent
come later; the refusals in `BKP-014` say which case a device falls into today.

---

## What a backup is and when it is a new one

### BKP-001 — A backup is one version of one device's configuration

**Type:** Invariant · **Status:** Active
**Layer:** Domain
**Since:** 2026-10-07

A backup records the device, the file's format, a SHA-256 of its content, its
size, whether it was scheduled or asked for, when it was taken and when the
device was last seen still holding it. A new version starts out checked at the
moment it was taken.

**Why:** The record is what the list shows; the file itself is kept beside it so
listing versions never touches the secrets inside it (`BKP-042`).

**Enforced at:** `src/domain/device-backups/aggregates/ConfigBackup.ts` (`create`)
**Tests:** `tests/domain/device-backups/aggregates/ConfigBackup.test.ts`,
`tests/application/device-backups/services/DeviceConfigBackupService.test.ts`,
`tests/integration/use-cases/device-backups/BackUpDeviceNowUseCase.integration.test.ts`

### BKP-002 — The content hash must be a SHA-256 hex digest

**Type:** Validation · **Status:** Active
**Layer:** Domain
**Since:** 2026-10-07

**Why:** The hash is how two reads are compared (`BKP-006`). Anything else
would make "unchanged" meaningless.

**Enforced at:** `src/domain/device-backups/aggregates/ConfigBackup.ts` (`validate`)
**Message:** `Backup content hash must be a SHA-256 hex digest`
**Tests:** `tests/domain/device-backups/aggregates/ConfigBackup.test.ts`

### BKP-003 — A backup cannot be empty

**Type:** Invariant · **Status:** Active
**Layer:** Domain
**Since:** 2026-10-07

A device that hands over an empty file has a failed attempt, not a backup.

**Why:** An empty version would become the "latest" and hide the last real one.

**Enforced at:** `src/domain/device-backups/aggregates/ConfigBackup.ts` (`validate`)
**Message:** `A configuration backup cannot be empty`
**Tests:** `tests/domain/device-backups/aggregates/ConfigBackup.test.ts`,
`tests/application/device-backups/services/DeviceConfigBackupService.test.ts`

### BKP-004 — A backup cannot exceed 1,000,000 bytes

**Type:** Validation · **Status:** Active
**Layer:** Domain
**Since:** 2026-10-07

**Why:** A real configuration is a few KB to about 50 KB. Something far larger
is not a configuration file, and it is stored in the database row.

**Enforced at:** `src/domain/device-backups/aggregates/ConfigBackup.ts` (`MAX_CONFIG_BYTES`)
**Message:** `A configuration backup cannot exceed 1000000 bytes`
**Tests:** `tests/domain/device-backups/aggregates/ConfigBackup.test.ts`

### BKP-005 — Line endings and trailing whitespace are not a change

**Type:** Policy · **Status:** Active
**Layer:** Domain (service)
**Since:** 2026-10-07

Two reads are compared after normalising CRLF to LF, trimming trailing
whitespace on each line and dropping blank lines at the end. Line order and
every value still count.

**Why:** Without it the same configuration served slightly differently would
look like a change every night.

**Enforced at:** `src/domain/device-backups/services/ConfigNormalizer.ts`
**Tests:** `tests/domain/device-backups/services/ConfigNormalizer.test.ts`,
`tests/application/device-backups/services/DeviceConfigBackupService.test.ts`

### BKP-006 — An unchanged configuration adds no version

**Type:** Policy · **Status:** Active
**Layer:** Domain + Application
**Since:** 2026-10-07

When the device still holds the latest saved configuration, nothing new is
stored; that version's last-checked time moves forward instead.

**Why:** The history then shows real changes only, and 30 versions (`BKP-030`)
cover months rather than a month of identical copies.

**Enforced at:** `src/application/device-backups/services/DeviceConfigBackupService.ts`,
`src/domain/device-backups/aggregates/ConfigBackup.ts` (`confirmUnchanged`)
**Tests:** `tests/domain/device-backups/aggregates/ConfigBackup.test.ts`,
`tests/application/device-backups/services/DeviceConfigBackupService.test.ts`,
`tests/integration/use-cases/device-backups/BackUpDeviceNowUseCase.integration.test.ts`

### BKP-007 — A backup is never checked before it was taken, and its check never goes back

**Type:** Invariant · **Status:** Active
**Layer:** Domain
**Since:** 2026-10-07

**Why:** A late or out-of-order confirmation must not make a version look
older than it is.

**Enforced at:** `src/domain/device-backups/aggregates/ConfigBackup.ts` (`confirmUnchanged`, `validate`)
**Message:** `A backup cannot be checked before it was taken`
**Tests:** `tests/domain/device-backups/aggregates/ConfigBackup.test.ts`

### BKP-008 — The stored file is exactly what the device sent

**Type:** Policy · **Status:** Active
**Layer:** Application
**Since:** 2026-10-07

Normalisation (`BKP-005`) is used for comparing only. The file kept and
downloaded is byte for byte the device's own.

**Why:** The file has to go back into the device through its own upload page.

**Enforced at:** `src/application/device-backups/services/DeviceConfigBackupService.ts`
**Tests:** `tests/integration/use-cases/device-backups/DownloadDeviceBackupUseCase.integration.test.ts`

---

## Which devices, when, and what is refused

### BKP-010 — The daily run backs up the access points, routers and switches

**Type:** Policy · **Status:** Active
**Layer:** Infrastructure
**Since:** 2026-10-07 · **Changed:** 2026-10-07 (routers and switches)

A device is in the run when it is `ACTIVE` or `COMMISSIONING`, is not deleted,
and either has an enabled wireless polling configuration of type
`ACCESS_POINT` or its model is a `ROUTER`, `ROUTERBOARD` or `SWITCH`. These are
the main devices; an access point counts as one first. Stations, servers,
disabled polling configurations, devices in inventory or decommissioned are
left out.

**Why:** Access points carry a whole sector of customers and the routers and
switches carry the whole network; their configuration is the one worth having.
Stations come later as an opt-in.

**Enforced at:** `src/infrastructure/device-backups/queries/PrismaBackupTargetsQuery.ts` (`listScheduled`)
**Tests:** `tests/integration/use-cases/device-backups/RunScheduledBackupsUseCase.integration.test.ts`,
`tests/application/device-backups/use-cases/RunScheduledBackupsUseCase.test.ts`,
`tests/application/device-backups/services/DeviceConfigBackupService.test.ts`,
`tests/infrastructure/device-backups/fetchers/ConfigFetcherRegistry.test.ts`

### BKP-011 — The run starts once a day, from 3:00 Colombian time

**Type:** Policy · **Status:** Active
**Layer:** Infrastructure
**Since:** 2026-10-07

Checked every 15 minutes. A run that could not start is retried on the next
check; a run that started counts the day as done even if some devices failed.
A run is never started while another is going. The run stops with the other
background jobs while the subscription is read-only.

**Why:** At 3:00 the network is quiet, and a failed device is retried the next
night or on demand (`BKP-012`), not every 15 minutes.

**Enforced at:** `src/infrastructure/device-backups/orchestrator/ConfigBackupOrchestrator.ts`
**Tests:** `tests/infrastructure/device-backups/orchestrator/ConfigBackupOrchestrator.test.ts`

### BKP-012 — A device backed up in the last 20 hours is skipped

**Type:** Policy · **Status:** Active
**Layer:** Application
**Since:** 2026-10-07

Only a success counts; a device whose last attempt failed is tried again.

**Why:** The orchestrator remembers the day in memory only, so a restart after
the night's run starts it again. This keeps that second run from asking every
device twice.

**Enforced at:** `src/application/device-backups/use-cases/RunScheduledBackupsUseCase.ts` (`BACKUP_FRESH_FOR_MS`)
**Tests:** `tests/application/device-backups/use-cases/RunScheduledBackupsUseCase.test.ts`,
`tests/domain/device-backups/aggregates/DeviceBackupState.test.ts`,
`tests/integration/use-cases/device-backups/RunScheduledBackupsUseCase.integration.test.ts`

### BKP-013 — At most four devices are asked at once, and one failure stops nothing

**Type:** Policy · **Status:** Active
**Layer:** Application
**Since:** 2026-10-07

**Why:** One radio that takes the full 10-second timeout should not hold up
the rest, and the run should never flood the network.

**Enforced at:** `src/application/device-backups/use-cases/RunScheduledBackupsUseCase.ts` (`BACKUP_CONCURRENCY`)
**Tests:** `tests/application/device-backups/use-cases/RunScheduledBackupsUseCase.test.ts`

### BKP-014 — A device that cannot be backed up is refused before it is asked

**Type:** Policy · **Status:** Active
**Layer:** Application
**Since:** 2026-10-07

In this order: not a main device (`BKP-010`); out of this server's reach; no
IP address; no HTTP credentials; no backup support yet for this kind of device
from its vendor. Today that support is AirOS on Ubiquiti access points and
RouterOS on any MikroTik; a Ubiquiti router, for one, is refused. The refusal
is recorded like a failed attempt (`BKP-020`).

**Why:** An access point that is never backed up because nobody saved its
login should show up as failing, with the reason, instead of silently missing.

**Enforced at:** `src/application/device-backups/services/DeviceConfigBackupService.ts` (`refusalFor`)
**Messages:** `Only access points, routers and switches are backed up for now`,
`This server cannot reach the device, and backups through an agent are not available yet`,
`The device has no IP address`, `No HTTP credentials are configured for this device`,
`Backups are not supported for this kind of device from this vendor yet`
**Tests:** `tests/application/device-backups/services/DeviceConfigBackupService.test.ts`,
`tests/integration/use-cases/device-backups/BackUpDeviceNowUseCase.integration.test.ts`,
`tests/integration/use-cases/device-backups/RunScheduledBackupsUseCase.integration.test.ts`,
`tests/infrastructure/device-backups/fetchers/ConfigFetcherRegistry.test.ts`

### BKP-015 — Off site, no device is backed up yet

**Type:** Policy · **Status:** Active
**Layer:** Infrastructure
**Since:** 2026-10-07

With `SERVER_ON_SITE=false` the daily run is empty and a manual backup is
refused as out of reach.

**Why:** Off site the server reaches devices only through the agent, and the
agent cannot fetch configurations yet (phase 2).

**Enforced at:** `src/infrastructure/device-backups/queries/PrismaBackupTargetsQuery.ts`
**Tests:** `tests/integration/use-cases/device-backups/BackUpDeviceNowUseCase.integration.test.ts`,
`tests/integration/use-cases/device-backups/RunScheduledBackupsUseCase.integration.test.ts`

---

## Attempt history per device

### BKP-020 — Every attempt is recorded on the device

**Type:** Policy · **Status:** Active
**Layer:** Domain + Application
**Since:** 2026-10-07

Saved, unchanged, failed or refused, each attempt updates the device's backup
state: when it was, how it went, the error if it failed, and the last success,
which survives later failures.

**Why:** "Last good backup 6 days ago, failing since: login rejected" is what
tells a technician to act.

**Enforced at:** `src/domain/device-backups/aggregates/DeviceBackupState.ts`,
`src/application/device-backups/services/DeviceConfigBackupService.ts` (`record`)
**Tests:** `tests/domain/device-backups/aggregates/DeviceBackupState.test.ts`,
`tests/application/device-backups/services/DeviceConfigBackupService.test.ts`,
`tests/integration/use-cases/device-backups/BackUpDeviceNowUseCase.integration.test.ts`,
`tests/integration/use-cases/device-backups/ListDeviceBackupsUseCase.integration.test.ts`

### BKP-021 — "Failing since" is the first failure of the current streak

**Type:** Invariant · **Status:** Active
**Layer:** Domain
**Since:** 2026-10-07

A success clears it.

**Enforced at:** `src/domain/device-backups/aggregates/DeviceBackupState.ts` (`recordFailure`, `recordSuccess`)
**Tests:** `tests/domain/device-backups/aggregates/DeviceBackupState.test.ts`

### BKP-022 — Failures in a row are counted

**Type:** Invariant · **Status:** Active
**Layer:** Domain
**Since:** 2026-10-07

**Why:** The alert waits for several failures in a row (`BKP-061`), so one bad
night pages nobody.

**Enforced at:** `src/domain/device-backups/aggregates/DeviceBackupState.ts` (`recordFailure`)
**Tests:** `tests/domain/device-backups/aggregates/DeviceBackupState.test.ts`

### BKP-023 — A long error is cut to 500 characters, not refused

**Type:** Policy · **Status:** Active
**Layer:** Domain
**Since:** 2026-10-07

**Why:** The error comes from the device or the network; refusing it would lose
the attempt itself.

**Enforced at:** `src/domain/device-backups/aggregates/DeviceBackupState.ts` (`MAX_BACKUP_ERROR_LENGTH`)
**Backed by:** `DeviceBackupState.lastError @db.VarChar(500)` in `prisma/schema.prisma`
**Tests:** `tests/domain/device-backups/aggregates/DeviceBackupState.test.ts`

### BKP-024 — Error, streak and failing-since exist only while the last attempt failed

**Type:** Invariant · **Status:** Active
**Layer:** Domain
**Since:** 2026-10-07

**Enforced at:** `src/domain/device-backups/aggregates/DeviceBackupState.ts` (`validate`)
**Tests:** `tests/domain/device-backups/aggregates/DeviceBackupState.test.ts`

---

## Retention

### BKP-030 — The newest 30 versions per device are kept

**Type:** Policy · **Status:** Active
**Layer:** Application + Infrastructure
**Since:** 2026-10-07

Older versions are removed right after a new one is saved. The newest version
is never removed.

**Why:** With `BKP-006`, 30 versions are 30 real changes. Months of history at
a few KB each.

**Enforced at:** `src/application/device-backups/services/DeviceConfigBackupService.ts` (`BACKUP_VERSIONS_KEPT`),
`src/infrastructure/device-backups/repositories/PrismaConfigBackupRepository.ts` (`pruneOldVersions`)
**Tests:** `tests/application/device-backups/services/DeviceConfigBackupService.test.ts`,
`tests/integration/use-cases/device-backups/RunScheduledBackupsUseCase.integration.test.ts`

### BKP-031 — A device's backups go with it when it is removed for good

**Type:** Policy · **Status:** Active
**Layer:** Infrastructure (database)
**Since:** 2026-10-07

A soft-deleted device keeps its backups through the grace period; purging it
removes them and its backup state.

**Enforced at:** `ON DELETE CASCADE` on `config_backups.device_id` and
`device_backup_states.device_id` (migration `20261009120000_device_config_backups`)
**Tests:** `tests/integration/use-cases/device-backups/DownloadDeviceBackupUseCase.integration.test.ts`

---

## Secrecy and access

### BKP-040 — The file is stored encrypted

**Type:** Policy · **Status:** Active
**Layer:** Infrastructure
**Since:** 2026-10-07

AES-256-GCM with `DEVICE_CREDENTIALS_KEY`, the same key as device credentials.

**Why:** The file holds admin passwords, wireless keys and PPPoE secrets.

**Enforced at:** `src/infrastructure/device-backups/repositories/PrismaConfigBackupRepository.ts` (`add`)
**Tests:** `tests/integration/use-cases/device-backups/BackUpDeviceNowUseCase.integration.test.ts`

### BKP-041 — Downloading needs `manage-credentials`; backing up now needs `update`

**Type:** Policy · **Status:** Active
**Layer:** Presentation
**Since:** 2026-10-07

Listing needs `read`. Backing up now is open to ADMIN and OPERATOR; downloading
the file only to ADMIN (and VENDOR).

**Why:** The file holds the same secrets that only `manage-credentials` may
write.

**Enforced at:** `src/presentation/http/routes/device-backup.routes.ts`
**Tests:** `tests/integration/device-backup.routes.test.ts`

### BKP-042 — Listing never includes the file

**Type:** Policy · **Status:** Active
**Layer:** Infrastructure
**Since:** 2026-10-07

Every read but the download leaves the encrypted content out of the query.

**Enforced at:** `src/infrastructure/device-backups/repositories/PrismaConfigBackupRepository.ts` (`METADATA`)
**Tests:** `tests/integration/use-cases/device-backups/ListDeviceBackupsUseCase.integration.test.ts`,
`tests/integration/device-backup.routes.test.ts`

### BKP-043 — A downloaded file or a comparison is neither logged nor cached

**Type:** Policy · **Status:** Active
**Layer:** Application + Presentation
**Since:** 2026-10-07

The use case log shows `[redacted]` in place of the content, or of the changed
lines of a comparison (`BKP-070`), and both responses carry
`Cache-Control: no-store`.

**Enforced at:** `src/application/device-backups/use-cases/DownloadDeviceBackupUseCase.ts` (`sanitizeForLogging`),
`src/application/device-backups/use-cases/DiffDeviceBackupsUseCase.ts` (`sanitizeForLogging`),
`src/presentation/http/controllers/DeviceBackupController.ts` (`download`, `diff`)
**Tests:** `tests/application/device-backups/use-cases/DownloadDeviceBackupUseCase.test.ts`,
`tests/application/device-backups/use-cases/DiffDeviceBackupsUseCase.test.ts`,
`tests/integration/device-backup.routes.test.ts`

---

## Vendors and the HTTP surface

### BKP-050 — An AirOS backup is the file the web UI's "Download backup" saves

**Type:** Policy · **Status:** Active
**Layer:** Infrastructure
**Since:** 2026-10-07

`GET /cfg.cgi` on the logged-in session, re-logging in once if the session was
refused. The answer must look like an AirOS `system.cfg` (`key=value` lines,
not an HTML page).

**Why:** It is the file the device's own "Upload configuration" takes back. A
login page served with HTTP 200 must not be saved as a backup.

**Enforced at:** `src/infrastructure/wireless-monitoring/collectors/AirOsHttpClient.ts` (`fetchConfig`)
**Message:** `cfg.cgi did not return an AirOS configuration file`
**Tests:** `tests/infrastructure/wireless-monitoring/collectors/AirOsHttpClient.test.ts`

### BKP-051 — A manual backup answers why it did not happen

**Type:** Policy · **Status:** Active
**Layer:** Presentation
**Since:** 2026-10-07

409 when the device was refused before being asked (`BKP-014`), 502 when it
was asked and failed.

**Why:** "Save the device's credentials first" and "the radio did not answer"
are fixed by different people.

**Enforced at:** `src/presentation/http/controllers/DeviceBackupController.ts` (`getErrorStatusCode`)
**Tests:** `tests/integration/device-backup.routes.test.ts`

### BKP-052 — The date a RouterOS export was taken is not a change

**Type:** Policy · **Status:** Active
**Layer:** Domain (service)
**Since:** 2026-10-07

On top of `BKP-005`, the first line of a RouterOS export, `# <date> <time> by
RouterOS <version>`, is compared without its date and time. The version it
names still counts, as does every other comment.

**Why:** RouterOS stamps every export with the moment it ran, so without this
every router would look changed every night. An upgrade of RouterOS is a real
change worth seeing.

**Enforced at:** `src/domain/device-backups/services/ConfigNormalizer.ts` (`dropExportDate`)
**Tests:** `tests/domain/device-backups/services/ConfigNormalizer.test.ts`,
`tests/application/device-backups/services/DeviceConfigBackupService.test.ts`

### BKP-053 — A RouterOS comparison hides the value of each secret argument

**Type:** Policy · **Status:** Active
**Layer:** Domain (service)
**Since:** 2026-10-07

In a RouterOS line, every `name=value` argument whose name contains `pass`,
`psk`, `secret`, `community`, `token` or `private`, or ends in `key`
(`wpa2-pre-shared-key`, `private-key`), shows `********` instead of its value,
quoted or not. Comment lines, empty values and text inside a quoted value are
left alone. A secret long enough for RouterOS to wrap onto a second line is
masked on its first line only.

**Why:** Same as `BKP-071`: PPPoE passwords, RADIUS secrets and wireless keys
are for restoring, not for reading on screen.

**Enforced at:** `src/domain/device-backups/services/ConfigSecretMasker.ts` (`maskRouterOs`)
**Tests:** `tests/domain/device-backups/services/ConfigSecretMasker.test.ts`

### BKP-054 — A RouterOS backup is the export `/import` takes back, secrets included

**Type:** Policy · **Status:** Active
**Layer:** Infrastructure
**Since:** 2026-10-07

The device runs `/export show-sensitive` over SSH. RouterOS 6 does not know
that argument and already shows the secrets, so when the answer is
`expected end of command` or `syntax error`, plain `/export` runs instead. An
answer with no menu line (a line starting with `/`) is not saved. The download
is named `.rsc`.

**Why:** RouterOS 7 leaves passwords and keys out of a plain export, and a
backup without them cannot rebuild the router. A permission error printed as
text must not be kept as a backup.

**Enforced at:** `src/infrastructure/device-backups/fetchers/RouterOsConfigFetcher.ts`,
`src/application/device-backups/use-cases/DownloadDeviceBackupUseCase.ts` (`EXTENSIONS`)
**Message:** `The device did not return a RouterOS export`
**Tests:** `tests/infrastructure/device-backups/fetchers/RouterOsConfigFetcher.test.ts`,
`tests/infrastructure/device-backups/fetchers/SshCommandClient.test.ts`,
`tests/integration/use-cases/device-backups/BackUpDeviceNowUseCase.integration.test.ts`,
`tests/integration/use-cases/device-backups/DownloadDeviceBackupUseCase.integration.test.ts`

### BKP-055 — RouterOS is reached over SSH with the device's HTTP login

**Type:** Policy · **Status:** Active
**Layer:** Infrastructure
**Since:** 2026-10-07

The SSH login is the device's HTTP username and password, the same login the
suspension router uses, on the device's SSH port (22 unless set, `DEV-127`).
Logging in must finish within 10 seconds and the whole export within 30; an
answer larger than a backup may be (`BKP-004`) is cut off and fails. The
router's host key is not checked. Older RouterOS 6 key exchanges (SHA-1) are
accepted after the modern ones.

**Why:** One login per device keeps the credentials screen simple. Nothing
pins host keys yet, and the routers are reached on the ISP's own network.

**Enforced at:** `src/infrastructure/device-backups/fetchers/SshCommandClient.ts`,
`src/infrastructure/device-backups/queries/PrismaBackupTargetsQuery.ts`
**Messages:** `SSH login rejected: check the device username and password`,
`SSH connection refused on port <port>`, `SSH did not answer in time`,
`SSH timed out after 30s`
**Tests:** `tests/infrastructure/device-backups/fetchers/SshCommandClient.test.ts`,
`tests/integration/use-cases/device-backups/BackUpDeviceNowUseCase.integration.test.ts`

---

## Alerts

### BKP-060 — A configuration changed since the last night is announced

**Type:** Policy · **Status:** Active
**Layer:** Domain + Application
**Since:** 2026-10-07

When the nightly run saves a new version of a device that already had one, a
warning names the device and when it was last seen unchanged:
`La configuración de "<device>" cambió`. The first version of a device, an
unchanged night, and a change found by a manual backup announce nothing.

**Why:** A change nobody planned (a technician's mistake, a reset, someone
else in the radio) is worth knowing the next morning. A manual backup is the
user's own doing, usually right after their own change.

**Enforced at:** `src/domain/device-backups/aggregates/ConfigBackup.ts` (`create`, `DeviceConfigChangedEvent`),
`src/application/device-backups/services/DeviceConfigBackupService.ts`,
`src/application/notifications/event-handlers/DeviceBackupNotificationHandlers.ts`
**Tests:** `tests/domain/device-backups/aggregates/ConfigBackup.test.ts`,
`tests/application/device-backups/services/DeviceConfigBackupService.test.ts`,
`tests/application/notifications/event-handlers/DeviceBackupNotificationHandlers.test.ts`,
`tests/integration/use-cases/device-backups/RunScheduledBackupsUseCase.integration.test.ts`

### BKP-061 — A device failing three times in a row is announced, once per streak

**Type:** Policy · **Status:** Active
**Layer:** Domain + Application
**Since:** 2026-10-07

On the third failure in a row, scheduled or manual, a warning names the device, the last good backup (or that there
is none) and the last error. Further failures say nothing; a success ends the
streak, and a new streak is announced again.

**Why:** One bad night is usually the network, and pages nobody. A device that
stays broken should be reported once, not every night.

**Enforced at:** `src/domain/device-backups/aggregates/DeviceBackupState.ts` (`recordFailure`, `BACKUP_FAILURES_BEFORE_ALERT`, `DeviceBackupFailingEvent`),
`src/application/notifications/event-handlers/DeviceBackupNotificationHandlers.ts`
**Tests:** `tests/domain/device-backups/aggregates/DeviceBackupState.test.ts`,
`tests/application/device-backups/services/DeviceConfigBackupService.test.ts`,
`tests/application/notifications/event-handlers/DeviceBackupNotificationHandlers.test.ts`,
`tests/integration/use-cases/device-backups/RunScheduledBackupsUseCase.integration.test.ts`

### BKP-062 — Backup alerts follow the install's notification settings

**Type:** Policy · **Status:** Active
**Layer:** Application + Infrastructure
**Since:** 2026-10-07

Both go through the shared alert publisher, so the device's quiet hours and an
expired subscription hold them back like any device alert. Each has its own
type, `config_changed` and `backup_failing`, that the muted alert types can
switch off for the whole install. They are notifications only, not entries in
the alert list.

**Why:** An install that changes its radios often may not want the change
alert at all, and turning it off must not need a code change.

**Enforced at:** `src/application/notifications/event-handlers/DeviceBackupNotificationHandlers.ts` (`CONFIG_CHANGED_ALERT_TYPE`, `BACKUP_FAILING_ALERT_TYPE`),
`src/infrastructure/di/container.ts`
**Tests:** `tests/application/notifications/event-handlers/DeviceBackupNotificationHandlers.test.ts`

### BKP-063 — A device left out because backing it up is not available yet raises no alert

**Type:** Policy · **Status:** Active
**Layer:** Domain + Application
**Since:** 2026-10-07

A refusal (`BKP-014`) because the device is not a main device, is out of
this server's reach, or is of a vendor with no backup support yet still counts
in the device's streak and shows as its last error, but never triggers the
failing alert (`BKP-061`). A refusal someone can fix (no IP address, no HTTP
credentials) does.

**Why:** The operator cannot do anything about a feature that does not exist
yet; an alert for it is noise that teaches people to ignore the real ones.

**Enforced at:** `src/application/device-backups/services/DeviceConfigBackupService.ts` (`NOT_AVAILABLE_YET`),
`src/domain/device-backups/aggregates/DeviceBackupState.ts` (`recordFailure`)
**Tests:** `tests/domain/device-backups/aggregates/DeviceBackupState.test.ts`,
`tests/application/device-backups/services/DeviceConfigBackupService.test.ts`,
`tests/integration/use-cases/device-backups/RunScheduledBackupsUseCase.integration.test.ts`

---

## Comparing versions

### BKP-070 — Two versions are compared line by line, as normalised

**Type:** Policy · **Status:** Active
**Layer:** Domain (service) + Application
**Since:** 2026-10-07

Any two versions of the same device and format, in either order. Both are
normalised first (`BKP-005`); changed lines come with three unchanged lines
around them, and changes close together share one block. A changed block
larger than four million line pairs is shown as all removed, then all added.

**Why:** "What did someone change on this radio?" is the question the change
alert (`BKP-060`) raises. The size limit keeps one odd pair of files from
taking the server's memory.

**Enforced at:** `src/domain/device-backups/services/ConfigDiff.ts`,
`src/application/device-backups/use-cases/DiffDeviceBackupsUseCase.ts`
**Messages:** `Backup not found`,
`Invalid comparison: the two backups have different formats`
**Tests:** `tests/domain/device-backups/services/ConfigDiff.test.ts`,
`tests/application/device-backups/use-cases/DiffDeviceBackupsUseCase.test.ts`,
`tests/integration/use-cases/device-backups/DiffDeviceBackupsUseCase.integration.test.ts`

### BKP-071 — A comparison hides secret values but shows that they changed

**Type:** Policy · **Status:** Active
**Layer:** Domain (service)
**Since:** 2026-10-07

In AirOS lines, the value of any setting whose name has a part containing
`pass`, `psk`, `secret`, `community`, `token` or `private`, or whose last part
ends in `key`, becomes `********`. RouterOS lines are masked argument by
argument (`BKP-053`). Masking happens after comparing, so a
changed password still shows as a removed and an added line. An empty value
stays empty.

**Why:** The comparison is for reading on screen; the secrets are only for
restoring, which is what the download is for (`BKP-041`).

**Enforced at:** `src/domain/device-backups/services/ConfigSecretMasker.ts`
**Tests:** `tests/domain/device-backups/services/ConfigSecretMasker.test.ts`,
`tests/application/device-backups/use-cases/DiffDeviceBackupsUseCase.test.ts`,
`tests/integration/use-cases/device-backups/DiffDeviceBackupsUseCase.integration.test.ts`,
`tests/integration/device-backup.routes.test.ts`

### BKP-072 — Comparing needs `manage-credentials`

**Type:** Policy · **Status:** Active
**Layer:** Presentation
**Since:** 2026-10-07

**Why:** Even masked, the configuration around a change shows SSIDs, addresses
and the whole network layout, so it is the download's audience: ADMIN and
VENDOR.

**Enforced at:** `src/presentation/http/routes/device-backup.routes.ts`
**Tests:** `tests/integration/device-backup.routes.test.ts`
