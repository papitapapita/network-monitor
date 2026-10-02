# New customer install

Each customer gets its own install (ADR 0002): its own database, secrets and
hostname, `https://<name>.miredcontrol.com`. On the server, an install is one
folder holding a Docker Compose project with three containers: Postgres, the
backend and the dashboard. The scripts are in `deploy/customer/`.

Insetel is not one of these installs. It still runs on pm2 with its own
deploy script.

## Once per server

1. Install Docker with the Compose plugin, and `openssl`.
2. Clone the backend and frontend repos side by side, for example
   `~/apps/backend` and `~/apps/frontend`. If the frontend lives elsewhere, set
   `NMS_FRONTEND_REPO`.
3. Create `~/nms-customers/vendor.env` from
   `deploy/customer/vendor.env.example` and fill it in: the product bot token,
   your chat ID, your vendor email, the domain and the installers folder.
   Run `chmod 600` on it. To keep installs somewhere other than
   `~/nms-customers`, set `NMS_CUSTOMERS_DIR`.
4. Build the images: `deploy/customer/update-customers.sh --build-only`.
5. Schedule backups with `crontab -e`:

   ```
   30 3 * * * /home/<user>/apps/backend/deploy/customer/backup-customers.sh >> /home/<user>/nms-customers/backup.log 2>&1
   ```

## Before the script

- Agree on a short name with the customer (lowercase letters, digits and
  dashes, for example `redesnorte`). It becomes the hostname.
- Know the date their first payment covers, if any. It goes in
  `--paid-until`. Without it, the subscription is not enforced until you set
  it from the dashboard.

## Run the script

```
deploy/customer/new-customer.sh redesnorte --paid-until 2026-11-30
```

The script:

- creates `~/nms-customers/redesnorte/` with fresh secrets, a port pair and a
  subnet;
- starts the install and waits until the backend is healthy, which includes
  running the migrations;
- creates your vendor account.

It prints the password **once** and removes it from disk, so copy it then.

The install is set up for an off-site server that only monitors: modules
`monitoring`, `SERVER_ON_SITE=false`. Its devices are measured by the
customer's agent.

## After the script

1. **Cloudflare tunnel:** in the tunnel, add a public hostname with the two
   rules the script printed, the `^/agent/` path first:
   - `redesnorte.miredcontrol.com`, path `^/agent/` → `http://localhost:<backend port>`
   - `redesnorte.miredcontrol.com`, no path → `http://localhost:<dashboard port>`
2. **Sign in** at `https://redesnorte.miredcontrol.com` with your vendor
   account and change the password.
3. **Customer's administrator:** in _Usuarios_, create the customer's
   account with the `ADMIN` role and send them the credentials.
4. **Telegram:** the customer creates a group and adds the product bot to it.
   Their administrator then saves the group's chat ID in the notification
   settings and sends the test message (NOT-200, NOT-202). Until then, alerts
   are recorded in the dashboard but no message is sent.
5. **Agent:** in _Agentes_, create an agent and copy its pairing key. On a
   customer PC that is always on (Windows 10 or later, or Linux x64),
   download the installer from the dashboard, run it and paste the key.
   Check that the agent shows as online.
6. **Devices:** add the customer's devices. They are measured through the
   agent.

## Updating every install

After pulling both repos:

```
deploy/customer/update-customers.sh            # all installs
deploy/customer/update-customers.sh redesnorte # only some
```

The script rebuilds both images and restarts the installs on them. Each
backend runs its pending migrations as it starts.

Agents are separate: copy a new signed release into the installers folder and
they update themselves (AGT-080 … AGT-085).

## Backups and restore

`backup-customers.sh` writes `<name>/backups/<name>-<date>.dump` for every
install and keeps 14 days (`KEEP_DAYS`). Copy that folder off the machine too.

To restore one install:

```
cd ~/nms-customers/redesnorte
docker compose stop backend
docker compose exec -T db pg_restore -U nms -d nms --clean --if-exists < backups/<file>.dump
docker compose start backend
```

## Removing a customer

```
cd ~/nms-customers/redesnorte
docker compose down -v
```

`-v` deletes the database volume. Take a final backup first if anything must
be kept. Then remove the folder and the tunnel's public hostname.

## Moving to another server

1. Stop the install.
2. Copy its folder and the latest backup to the new server. The new server
   needs the setup from "Once per server" first.
3. Run `docker compose up -d db`, restore the backup, then `docker compose up -d`.
4. Point the tunnel hostname at the new server.

Agents only know the hostname, so they reconnect without changes.
