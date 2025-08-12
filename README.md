# AP Polling Frequency & Monitoring System

## Objective

The system polls each Access Point (AP) at regular intervals (default: every 15 seconds) to ensure real-time or near-real-time monitoring. Polling frequency is adjustable per AP or globally, balancing responsiveness and system load.

## Build & Run Instructions

1. **Install dependencies:**
   ```sh
   npm install
   ```
2. **Build the project:**
   ```sh
   npm run build
   ```
3. **Start the monitoring service:**
   ```sh
   npm start
   ```
   - The service will begin polling all configured APs at the default or configured intervals.

## Implementation Overview

- **Polling Mechanism:**

  - Uses asynchronous timers to poll each AP at its configured interval (default: 15s).
  - Polling frequency can be set globally or per AP via the settings manager (`SettingsManager` class).
  - Polling jobs are managed independently for each AP, supporting concurrent polling and runtime changes.
  - APs can be added/removed or have their polling frequency changed without restarting the service.
  - Polling can be paused for maintenance (set `enabled: false` for an AP).
  - The system can adapt polling intervals in response to network congestion (future enhancement).
  - All polling results and failures are logged for audit and debugging.

- **Configuration:**

  - Settings are managed via the `SettingsManager` class (`src/services/settings.service.ts`).
  - Polling intervals are persisted in a config file and can be updated via API or CLI (see code for details).
  - Input validation ensures intervals are within allowed bounds (min 5s, max 5min).

- **Extensibility:**
  - Supports various AP brands (Mikrotik, Ubiquiti, etc.).
  - Polling logic is protocol-agnostic and can be extended for SNMP, HTTP, or custom protocols.
  - Integrates with third-party alerting tools (Slack, Discord, email) and provides API hooks for external systems.

## Acceptance Criteria Mapping

1. **Default Polling:** APs are polled every 15s by default (configurable).
2. **Configurable Frequency:** Admins can set polling frequency per AP or globally via the settings manager.
3. **Live Updates:** Changes to polling frequency are applied at runtime without restart.
4. **Pause Polling:** Polling can be paused per AP (set `enabled: false`).
5. **Adaptive Polling:** (Planned) System can adapt intervals based on network load.
6. **Failure Handling:** Polling failures are logged and do not crash the system.

## User Roles

- **Admins:** Configure polling frequency and AP settings.
- **Technicians:** View polling status and receive alerts.
- **System:** Automated polling and alerting.

## Testing

- Unit tests for polling logic and frequency adjustment (`src/services/settings.service.test.ts`).
- Load and integration tests recommended for large-scale deployments.

## Security & Compliance

- Follows best practices for secure polling and logging.
- Logs and configuration changes are auditable and retained per policy.

## Further Details

- See `src/services/settings.service.ts` for core implementation.
- See `src/monitor.ts` for polling loop and job scheduling.
- See `src/notifier.ts` for alerting integration.

---

For more details on requirements, see the [requirements section](#) or contact the project maintainer.

# Node.js Ping Monitoring System

A simple **Node.js monitoring tool** that **pings multiple endpoints** at a set interval and sends **email notifications** if an endpoint goes down.

## 🚀 Features

- ✅ **Ping multiple endpoints** to check availability.
- ✅ **Email notifications** when an endpoint fails.
- ✅ **Retry mechanism** to avoid false alerts.
- ✅ **Logging with Winston** for debugging and analysis.
- ✅ **Fully typed with TypeScript** for better maintainability.

---

## 📦 Installation

1.  **Clone the repository**

    ```sh
    git clone https://github.com/your-username/node-ping-monitor.git
    cd node-ping-monitor
    ```

2.  **Install dependencies**

    ```sh
     npm install

    ```

3.  **Set up environment variables**

    Create a .env file and add your email credentials:

    ```ini
    EMAIL_USER=your-email@gmail.com
    EMAIL_PASS=your-email-password
    ALERT_EMAIL=recipient-email@gmail.com
    ```

4.  **Compile TypeScript**

    ```sh
    npm run build
    ```

5.  **Run the monitor**

    ```sh
    npm start
    ```

## 🛠 Configuration

Edit src/config.ts to add or modify endpoints and settings:

```js
export const config = {
  endpoints: [
    { url: '8.8.8.8', name: 'Google DNS' },
    { url: '1.1.1.1', name: 'Cloudflare DNS' }
  ],
  interval: 30000, // Check every 30 seconds
  maxRetries: 3 // Retries before sending alert
};
```

## 📂 Project Structure

```bash
node-ping-monitor/
│── src/
│ ├── config.ts # Monitoring configuration
│ ├── logger.ts # Logging system (Winston)
│ ├── notifier.ts # Email notification system
│ ├── monitor.ts # Main monitoring logic
│── .env # Environment variables (ignored in Git)
│── .gitignore # Ignored files list
│── .eslintrc.json # ESLint configuration
│── .prettierrc # Prettier formatting rules
│── package.json # Project metadata & scripts
│── tsconfig.json # TypeScript configuration
│── README.md # Project documentation
```

## 📝 Logging

The system logs events in monitor.log and also displays them in the console.

Example logs:

```csharp
✅ Google DNS (8.8.8.8) is UP
⚠️ Cloudflare DNS (1.1.1.1) is DOWN
🚨 Alert sent: Cloudflare DNS is DOWN!
```

## 📬 Future Improvements

- 📡 Add Telegram or Twilio SMS notifications.
- 📊 Create a web dashboard to monitor endpoints in real-time.
- 📈 Store monitoring history in a database.
- ⌨️ Create a CLI command that receives a file of IP addresses as argument

## 👨‍💻 Contributing

Feel free to submit issues or pull requests to improve the project!

## 📜 License

This project is licensed under the MIT License.

### **Next Steps**

1. Replace `your-username` with your GitHub username in the **clone** section.
2. Add a **LICENSE file** (optional but recommended).
3. Customize the **Future Improvements** section if you plan to add more features.
