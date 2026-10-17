# Power Control — Business Rules

Cutting and restoring PoE power to the antennas at a tower, so a thunderstorm
does not reach equipment that is switched on. The antennas are powered from
the PoE-out ports of MikroTik switches: hEX PoE on RouterOS v6 or v7, and
CSS106 on SwOS.

This first phase only **reads**. It lists each switch's PoE ports and works
out which antenna each one powers. Cutting power, timers and turning off a
whole site come in later phases, and they rely on the match made here.

Format and conventions: [README.md](README.md).

## ID ranges

| Range                 | Area                                   |
| --------------------- | -------------------------------------- |
| `PWR-001` … `PWR-009` | What a PoE switch is                   |
| `PWR-010` … `PWR-019` | Which switches are read, and how       |
| `PWR-020` … `PWR-029` | What a port reading says, per firmware |
| `PWR-030` … `PWR-039` | Which antenna a port powers            |
| `PWR-040` … `PWR-049` | Which port powers an antenna           |
| `PWR-050` … `PWR-059` | Access                                 |

## Layer coverage

| Layer                        | Rules |
| ---------------------------- | ----- |
| Domain (service)             | 5     |
| Application                  | 4     |
| Application + Infrastructure | 2     |
| Infrastructure               | 7     |
| Presentation                 | 1     |

---

## What a PoE switch is

### PWR-001 — A switch is a PoE switch when its model names the firmware it runs

**Type:** Policy · **Status:** Active
**Layer:** Infrastructure
**Since:** 2026-10-17

A device counts as a PoE switch when its device model has `poeSwitchOs` set,
to `ROUTEROS` or `SWOS` (`DEV-031`). That value also picks how its ports are
read: the RouterOS API or the SwOS web interface. Whether a RouterOS switch
runs v6 or v7 is not stored; the reader copes with both (`PWR-023`).

**Why:** The firmware belongs to the hardware model: every hEX PoE runs
RouterOS and every CSS106 runs SwOS. Marking the two catalogue entries once
covers every unit. Only CRS models can boot either firmware, and Insetel has
none.

**Enforced at:** `src/infrastructure/power-control/readers/PoeSwitchReaderRegistry.ts`, `src/infrastructure/power-control/queries/PrismaPoeSwitchTargetsQuery.ts` (`listSwitchesAtSite`)
**Tests:** `tests/infrastructure/power-control/readers/PoeSwitchReaderRegistry.test.ts`, `tests/integration/use-cases/power-control/ListSitePoePortsUseCase.integration.test.ts`

---

## Which switches are read, and how

### PWR-010 — A site's PoE switches are those in service at that location

**Type:** Policy · **Status:** Active
**Layer:** Infrastructure
**Since:** 2026-10-17

The PoE switches at a site are the non-deleted devices at that location whose
model is a PoE switch (`PWR-001`) and whose status is `ACTIVE` or
`COMMISSIONING`. They are listed by name.

**Why:** A switch on the shelf or at another tower powers nothing at this one.

**Enforced at:** `src/infrastructure/power-control/queries/PrismaPoeSwitchTargetsQuery.ts` (`listSwitchesAtSite`)
**Tests:** `tests/integration/use-cases/power-control/ListSitePoePortsUseCase.integration.test.ts`

### PWR-011 — A switch without an IP or a saved login is listed, not read

**Type:** Policy · **Status:** Active
**Layer:** Application
**Since:** 2026-10-17

A switch with no IP address, or with no username and password saved, is still
listed, with `readable: false` and the reason. Nothing tries to reach it.

**Why:** The operator sees every switch at the site and what each one is
missing, instead of a switch silently left out.

**Enforced at:** `src/application/power-control/services/resolvePoeSwitchTarget.ts`
**Message:** `The switch has no IP address` · `The switch has no username and password saved`
**Tests:** `tests/application/power-control/services/resolvePoeSwitchTarget.test.ts`, `tests/integration/use-cases/power-control/ListSitePoePortsUseCase.integration.test.ts`

### PWR-012 — A switch is read with the device's saved login

**Type:** Policy · **Status:** Active
**Layer:** Application + Infrastructure
**Since:** 2026-10-17

The switch is read with its device credentials' HTTP username and password.
RouterOS reads them on the API port (`apiPort`, default 8728), as live router
traffic does. SwOS reads them over plain HTTP on `httpPort`. SwOS has no HTTPS,
so the 443 default saved for other devices means port 80 for it; any other
saved port is used as is.

**Why:** One login per device, already stored encrypted, so a switch needs no
new kind of secret. The 443-to-80 rule saves the operator a step on every
CSS106: a SwOS switch can never answer on 443.

**Enforced at:** `src/infrastructure/power-control/queries/PrismaPoeSwitchTargetsQuery.ts` (`toCandidate`), `src/infrastructure/power-control/readers/SwOsPoeReader.ts` (`swOsHttpPort`)
**Tests:** `tests/infrastructure/power-control/readers/SwOsPoeReader.test.ts`, `tests/integration/use-cases/power-control/ListSitePoePortsUseCase.integration.test.ts`

### PWR-013 — On site, this server reads every switch; off site, none yet

**Type:** Policy · **Status:** Active
**Layer:** Application + Infrastructure
**Since:** 2026-10-17

A server on site (`SERVER_ON_SITE`, default true) reads every switch itself,
behind an agent or not, as backups do (`BKP-015`). An off-site server reads
none: a switch behind an agent is listed with
`Behind an on-site agent: reading PoE ports through an agent is not supported yet`,
and one with no agent with
`This server is off site and no agent reaches the switch`.

**Why:** Insetel's server sits on its own network. Reading PoE ports through
the agent needs a new probe kind and an agent release, which comes in a later
phase.

**Enforced at:** `src/infrastructure/power-control/queries/PrismaPoeSwitchTargetsQuery.ts` (`reachOf`), `src/application/power-control/services/resolvePoeSwitchTarget.ts`
**Tests:** `tests/application/power-control/services/resolvePoeSwitchTarget.test.ts`, `tests/integration/use-cases/power-control/ListSitePoePortsUseCase.integration.test.ts`

### PWR-014 — Switches are read live, together, and one failure does not hide the rest

**Type:** Policy · **Status:** Active
**Layer:** Application
**Since:** 2026-10-17

Every request reads the site's switches at that moment, all at once. Nothing
is stored, and nothing on a switch is changed. A switch that does not answer
within 10 seconds, or answers with an error, is listed with `readable: true`,
the `error`, and no ports; the other switches are shown as usual.

**Why:** A PoE port's state is only worth seeing as it is now, minutes before a
storm. One dead switch must not leave the operator blind at the rest of the
tower.

**Enforced at:** `src/application/power-control/services/SitePoeInspector.ts`, `src/infrastructure/power-control/readers/RouterOsPoeReader.ts`, `src/infrastructure/power-control/readers/SwOsPoeReader.ts`
**Tests:** `tests/integration/use-cases/power-control/ListSitePoePortsUseCase.integration.test.ts`

---

## What a port reading says, per firmware

### PWR-020 — A port's mode is OFF, AUTO, FORCED_ON or UNKNOWN

**Type:** Validation · **Status:** Active
**Layer:** Infrastructure
**Since:** 2026-10-17

The mode is what the switch is set to do with the port's power. RouterOS
`off`, `auto-on` and `forced-on` map to `OFF`, `AUTO` and `FORCED_ON`.
SwOS codes 0, 1 and 2 map the same way (unconfirmed, `PWR-024`). Any other
value is `UNKNOWN`, never a guess.

**Why:** One vocabulary for both firmwares, so the screen and the later off/on
actions never need to know which switch they are talking to.

**Enforced at:** `src/infrastructure/power-control/readers/RouterOsPoeReader.ts` (`MODES`), `src/infrastructure/power-control/readers/SwOsPoeReader.ts` (`MODES`)
**Tests:** `tests/infrastructure/power-control/readers/RouterOsPoeReader.test.ts`, `tests/infrastructure/power-control/readers/SwOsPoeReader.test.ts`

### PWR-021 — A port's status is POWERED, NO_LOAD, OFF, FAULT or UNKNOWN

**Type:** Validation · **Status:** Active
**Layer:** Infrastructure
**Since:** 2026-10-17

The status is what the port is actually doing. RouterOS `powered-on` is
`POWERED`, `waiting-for-load` is `NO_LOAD`, `disabled` is `OFF`, and
`short-circuit`, `overload`, `voltage-too-low` and `current-too-low` are
`FAULT`. Any other value is `UNKNOWN`. With no live reading at all, a port set
to `OFF` reads `OFF` and any other reads `UNKNOWN`.

**Why:** `FAULT` is the one the operator must notice; the detail behind it is
on the switch itself.

**Enforced at:** `src/infrastructure/power-control/readers/RouterOsPoeReader.ts` (`STATUSES`, `statusOf`)
**Tests:** `tests/infrastructure/power-control/readers/RouterOsPoeReader.test.ts`

### PWR-022 — Only ports that can give power are listed

**Type:** Policy · **Status:** Active
**Layer:** Infrastructure
**Since:** 2026-10-17

A RouterOS port is listed when it has a `poe-out` setting, which leaves out the
PoE-in port and SFP. Power and voltage are given when the switch reports them
and null otherwise. When the live monitor does not answer, the ports are still
listed from their settings.

**Why:** A port that can never power an antenna has nothing to offer here.

**Enforced at:** `src/infrastructure/power-control/readers/RouterOsPoeReader.ts` (`readPorts`)
**Tests:** `tests/infrastructure/power-control/readers/RouterOsPoeReader.test.ts`

### PWR-023 — RouterOS v6 and v7 are both read, whichever menu holds PoE

**Type:** Policy · **Status:** Active
**Layer:** Infrastructure
**Since:** 2026-10-17

RouterOS v7 keeps the PoE setting under `/interface/ethernet/poe`; some v6
releases keep `poe-out` on `/interface/ethernet` itself. The reader asks the
PoE menu first and falls back to the ethernet menu, and the same for the live
monitor. The version is read and shown, not branched on. When power is not
reported, it is worked out from voltage and current.

**Why:** Insetel's hEX units run both, and the backhaul's RB960 runs v6.

**Enforced at:** `src/infrastructure/power-control/readers/RouterOsPoeReader.ts`
**Tests:** `tests/infrastructure/power-control/readers/RouterOsPoeReader.test.ts`
**Hardware check pending:** which menu holds `poe-out` on Insetel's v6 RB960.

### PWR-024 — SwOS ports are read from its web interface's files

**Type:** Policy · **Status:** Active
**Layer:** Infrastructure
**Since:** 2026-10-17

SwOS has no API and read-only SNMP, so the reader logs in the way the browser
does (HTTP digest) and reads `link.b` (port names), `poe.b` (mode, status,
power and voltage in tenths) and `sys.b` (version). Port names are hex-encoded;
a missing `sys.b` only loses the version.

**Why:** It is the only way in. MikroTik does not document these files, so the
field names and codes sit in one table in the reader.

**Enforced at:** `src/infrastructure/power-control/readers/SwOsPoeReader.ts` (`FIELDS`, `MODES`, `STATUSES`), `src/infrastructure/power-control/readers/SwOsBFormat.ts`, `src/infrastructure/power-control/readers/DigestHttpClient.ts`
**Tests:** `tests/infrastructure/power-control/readers/SwOsPoeReader.test.ts`, `tests/infrastructure/power-control/readers/SwOsBFormat.test.ts`, `tests/infrastructure/power-control/readers/DigestHttpClient.test.ts`
**Hardware check pending:** the field names and codes are not yet confirmed
against a capture from Insetel's CSS106. Until then, a CSS106 reading may show
wrong statuses or the PoE-in port.

---

## Which antenna a port powers

### PWR-030 — A port names its antenna by the antenna's IP in its label

**Type:** Policy · **Status:** Active
**Layer:** Domain (service)
**Since:** 2026-10-17

The first valid IPv4 address in a port's label is the antenna it powers. An
address glued to more digits or dots (`1.10.0.5.21`) does not count, and an
invalid one (`10.0.5.300`) is skipped. On RouterOS the label is whichever of
the interface comment and name holds an IP, the comment first; on SwOS it is
the port name.

**Why:** SwOS port names are too short for more than an address, and an
address is exactly what the inventory can match on.

**Enforced at:** `src/domain/power-control/services/PoePortLabel.ts`, `src/infrastructure/power-control/readers/RouterOsPoeReader.ts` (`labelOf`)
**Tests:** `tests/domain/power-control/services/PoePortLabel.test.ts`, `tests/infrastructure/power-control/readers/RouterOsPoeReader.test.ts`

### PWR-031 — A port matches the non-deleted device holding its IP

**Type:** Policy · **Status:** Active
**Layer:** Domain (service)
**Since:** 2026-10-17

A port whose IP belongs to a non-deleted device is `MATCHED` to it. A port
with no IP, or with an IP no device holds, is `UNMATCHED`, with the IP when
there is one.

**Why:** An address belongs to at most one live device (`DEV-049`), so a match
is never ambiguous on the inventory side.

**Enforced at:** `src/domain/power-control/services/PoePortMatcher.ts`, `src/infrastructure/power-control/queries/PrismaPoeSwitchTargetsQuery.ts` (`findDevicesByIps`)
**Tests:** `tests/domain/power-control/services/PoePortMatcher.test.ts`, `tests/integration/use-cases/power-control/ListSitePoePortsUseCase.integration.test.ts`

### PWR-032 — A match to a device recorded elsewhere is flagged

**Type:** Policy · **Status:** Active
**Layer:** Domain (service)
**Since:** 2026-10-17

When the matched device's location is not the site being read, or it has no
location, the match is `MATCHED_OTHER_LOCATION` and carries that device's
location name.

**Why:** Either the label or the inventory is wrong. It should be fixed before
power is ever cut by that match.

**Enforced at:** `src/domain/power-control/services/PoePortMatcher.ts`
**Tests:** `tests/domain/power-control/services/PoePortMatcher.test.ts`, `tests/integration/use-cases/power-control/ListSitePoePortsUseCase.integration.test.ts`

### PWR-033 — An IP on two ports at the site is a duplicate on both

**Type:** Policy · **Status:** Active
**Layer:** Domain (service)
**Since:** 2026-10-17

When the same IP is on more than one port among all the switches read at the
site, every one of those ports is `DUPLICATE` and none is matched.

**Why:** Only one port can really power the antenna. Cutting the wrong one
drops a different antenna, so the later off/on actions refuse a duplicate
port.

**Enforced at:** `src/domain/power-control/services/PoePortMatcher.ts`
**Tests:** `tests/domain/power-control/services/PoePortMatcher.test.ts`, `tests/integration/use-cases/power-control/ListSitePoePortsUseCase.integration.test.ts`

### PWR-034 — A port labelled with its own switch's IP powers no antenna

**Type:** Policy · **Status:** Active
**Layer:** Domain (service)
**Since:** 2026-10-17

A port whose label holds the switch's own address is treated as having no IP.

**Why:** That label names the switch's uplink, not something it powers.

**Enforced at:** `src/domain/power-control/services/PoePortMatcher.ts` (`antennaIpOf`)
**Tests:** `tests/domain/power-control/services/PoePortMatcher.test.ts`

---

## Which port powers an antenna

### PWR-040 — An antenna's power source is FOUND, DUPLICATE, NONE or UNKNOWN

**Type:** Policy · **Status:** Active
**Layer:** Application
**Since:** 2026-10-17

The ports labelled with the antenna's IP give:

- `FOUND`: exactly one port.
- `DUPLICATE`: more than one, all listed.
- `UNKNOWN`: none, but a switch at the site could not be read; the unread
  switches are listed with the reason.
- `NONE`: none, and every switch at the site was read.

**Why:** "No port" is only true when nothing at the site went unread. The
later off/on button needs exactly one port.

**Enforced at:** `src/application/power-control/use-cases/GetDevicePowerSourceUseCase.ts`
**Tests:** `tests/integration/use-cases/power-control/GetDevicePowerSourceUseCase.integration.test.ts`

### PWR-041 — Only the switches at the antenna's own location are looked at

**Type:** Policy · **Status:** Active
**Layer:** Application
**Since:** 2026-10-17

The antenna is looked for on the PoE switches at its own location. An antenna
with no IP or no location answers `NONE` with the reason, and no switch is
read.

**Why:** An antenna is powered from the tower it is mounted on, and reading
every switch in the network for one antenna would be slow.

**Enforced at:** `src/application/power-control/use-cases/GetDevicePowerSourceUseCase.ts`
**Message:** `The device has no IP address` · `The device has no location, so no switch is looked at` · `There is no PoE switch at the device location`
**Tests:** `tests/integration/use-cases/power-control/GetDevicePowerSourceUseCase.integration.test.ts`

---

## Access

### PWR-050 — Reading PoE ports needs the `read` permission

**Type:** Policy · **Status:** Active
**Layer:** Presentation
**Since:** 2026-10-17

`GET /api/locations/:id/poe-ports` and `GET /api/devices/:id/power-source`
need `read`, which every role has. Neither returns the switch's login.

**Why:** They only show state; changing anything on a switch comes with the
later off/on actions, behind a stricter permission.

**Enforced at:** `src/presentation/http/routes/power-control.routes.ts`
**Tests:** `tests/integration/power-control.routes.test.ts`
