# Ubiquitous Language - Network Monitoring Platform

## Overview

This document defines the **Ubiquitous Language** used throughout the Network Monitoring Platform. The Ubiquitous Language is a shared vocabulary between domain experts, developers, product owners, and stakeholders. All terms are used consistently in code, documentation, conversations, and user interfaces.

## Purpose

- Eliminate ambiguity in communication
- Ensure code reflects business domain
- Bridge gap between technical and business teams
- Provide onboarding reference for new team members

---

## Table of Contents

1. [Core Domain Concepts](#core-domain-concepts)
2. [Device & Hardware Terms](#device--hardware-terms)
3. [Network & Connectivity](#network--connectivity)
4. [Monitoring & Polling](#monitoring--polling)
5. [Alerts & Notifications](#alerts--notifications)
6. [Maintenance & Operations](#maintenance--operations)
7. [Business & Procurement](#business--procurement)
8. [Technical Infrastructure](#technical-infrastructure)
9. [User Roles & Actors](#user-roles--actors)
10. [Processes & Workflows](#processes--workflows)
11. [Metrics & Measurements](#metrics--measurements)

---

## Core Domain Concepts

| Term | Meaning | Context | Synonyms/Notes |
|------|---------|---------|----------------|
| **Aggregate** | A cluster of domain objects that can be treated as a single unit. An aggregate has a root entity that controls access to its children. | Domain Model | DDD tactical pattern |
| **Aggregate Root** | The main entity in an aggregate that serves as the entry point for accessing the aggregate's data. | Domain Model | Root Entity |
| **Entity** | An object that has a unique identity that persists over time, regardless of changes to its attributes. | Domain Model | Domain Entity |
| **Value Object** | An immutable object that has no identity and is defined only by its attributes. | Domain Model | VO |
| **Domain Event** | A record of something significant that happened in the domain. | Domain Model | Event |
| **Invariant** | A business rule that must always be true within an aggregate. | Domain Model | Business Rule, Constraint |
| **Bounded Context** | A logical boundary within which a particular domain model applies. | Strategic DDD | Context |
| **Repository** | An abstraction for accessing and persisting aggregates. | Domain Model | Data Access Layer |
| **Use Case** | A specific way a user interacts with the system to accomplish a goal. | Application Layer | Interactor, Application Service |

---

## Device & Hardware Terms

| Term | Meaning | Context | Synonyms/Notes |
|------|---------|---------|----------------|
| **Access Point (AP)** | A wireless network device that allows Wi-Fi enabled devices to connect to a wired network. | Network Devices | Wireless Access Point, WAP |
| **Radio** | A wireless communication device that transmits and receives radio frequency signals. | Network Devices | Radio Device, Transceiver |
| **Router** | A network device that forwards data packets between computer networks. | Network Devices | Gateway |
| **Switch** | A network device that connects devices on a computer network by using packet switching. | Network Devices | Network Switch |
| **Backbone** | The core network infrastructure that interconnects various parts of the network. | Network Topology | Core Network |
| **CPE (Customer Premises Equipment)** | Equipment located at the customer's location (e.g., modem, router). | Network Devices | Customer Equipment |
| **Device Model** | A specific product model from a manufacturer (e.g., Mimosa C5c, MikroTik hAP ac²). | Hardware Catalog | Model, SKU |
| **Physical Device** | An actual piece of hardware with a serial number and physical location. | Hardware Management | Hardware, Equipment |
| **Network Device** | The logical representation of a device in the network with IP address and configuration. | Network Management | Logical Device, Node |
| **Serial Number** | A unique identifier assigned to a physical device by the manufacturer. | Hardware | S/N |
| **MAC Address** | A unique identifier assigned to a network interface controller for communications. | Networking | Physical Address, Hardware Address |
| **Firmware** | Software that provides low-level control for a device's specific hardware. | Device Software | OS, Operating System |

---

## Network & Connectivity

| Term | Meaning | Context | Synonyms/Notes |
|------|---------|---------|----------------|
| **IP Address** | A numerical label assigned to each device connected to a network. | Networking | Internet Protocol Address |
| **Link** | A point-to-point wireless connection between two devices. | Network Topology | PtP Link, Connection |
| **Point-to-Point (PtP)** | A direct connection between two network devices. | Network Architecture | PTP, Backhaul Link |
| **Point-to-Multipoint (PtMP)** | A connection from one central location to multiple remote locations. | Network Architecture | PTMP |
| **Backhaul** | A network connection that links a local network to the wider internet or core network. | Network Topology | Upstream Link |
| **SSID** | The name of a wireless network that users see when connecting. | Wireless Networking | Network Name |
| **Frequency Channel** | A specific frequency band used for wireless communication (e.g., 2.4GHz, 5GHz). | Wireless Networking | Channel |
| **Signal Strength** | The power level of a received signal, measured in dBm. | Wireless Networking | RSSI (Received Signal Strength Indicator) |
| **Throughput** | The actual rate of successful data transfer over a network connection. | Network Performance | Data Rate |
| **Bandwidth** | The maximum rate of data transfer across a given path. | Network Performance | Capacity |
| **Latency** | The time it takes for data to travel from source to destination. | Network Performance | Ping Time, Delay |
| **Packet Loss** | The percentage of data packets that fail to reach their destination. | Network Performance | Loss Rate |

---

## Monitoring & Polling

| Term | Meaning | Context | Synonyms/Notes |
|------|---------|---------|----------------|
| **Polling** | The process of regularly checking the status of network devices. | Monitoring | Health Check |
| **Poller** | A service or component that performs polling operations. | Monitoring | Polling Service |
| **Polling Interval** | The time between successive polls of a device. | Monitoring | Poll Frequency, Check Interval |
| **Polling Result** | The outcome of a single polling operation, including metrics and status. | Monitoring | Poll Response |
| **Health Check** | A test to determine if a device is operational and responsive. | Monitoring | Status Check, Ping |
| **Ping** | A network utility that tests reachability of a device and measures round-trip time. | Monitoring | ICMP Echo |
| **ICMP (Internet Control Message Protocol)** | A network protocol used for diagnostic and control purposes (e.g., ping). | Networking | - |
| **SNMP (Simple Network Management Protocol)** | A protocol for collecting information from and configuring network devices. | Device Management | - |
| **Uptime** | The amount of time a device has been continuously operational. | Monitoring | Availability |
| **Downtime** | The period when a device is not operational. | Monitoring | Outage |
| **Device Status** | The current operational state of a device (e.g., ONLINE, OFFLINE, MAINTENANCE). | Monitoring | Operational Status |
| **Metrics** | Quantitative measurements of device performance or health. | Monitoring | KPIs, Performance Indicators |
| **Telemetry** | Automated collection and transmission of data from remote devices. | Monitoring | Remote Measurement |

---

## Alerts & Notifications

| Term | Meaning | Context | Synonyms/Notes |
|------|---------|---------|----------------|
| **Alert** | A notification triggered when a device or metric exceeds a defined threshold. | Alerting | Notification, Warning |
| **Alert Rule** | A condition that, when met, triggers an alert. | Alerting | Alert Condition, Threshold |
| **Threshold** | A predefined limit for a metric; exceeding it triggers an alert. | Alerting | Limit, Boundary |
| **Notification** | A message sent to inform users of an event or alert. | Alerting | Alert Message |
| **Notification Channel** | A medium through which notifications are sent (e.g., email, SMS, Slack). | Alerting | Alert Channel |
| **Alert Severity** | The importance level of an alert (e.g., INFO, WARNING, CRITICAL). | Alerting | Priority, Level |
| **Alert Escalation** | The process of routing alerts to higher-level personnel if not acknowledged. | Alerting | Escalation Policy |
| **Alert Acknowledgment** | The action of confirming receipt and awareness of an alert. | Alerting | ACK |
| **Alert Grouping** | Combining related alerts to reduce noise and improve clarity. | Alerting | Alert Correlation |
| **False Positive** | An alert triggered incorrectly when no actual issue exists. | Alerting | False Alarm |

---

## Maintenance & Operations

| Term | Meaning | Context | Synonyms/Notes |
|------|---------|---------|----------------|
| **Maintenance** | Work performed to keep devices operational or restore them after failure. | Operations | Service, Repair |
| **Preventive Maintenance** | Scheduled maintenance to prevent future failures. | Operations | Scheduled Maintenance, PM |
| **Corrective Maintenance** | Maintenance performed after a failure to restore functionality. | Operations | Reactive Maintenance, Repair |
| **Predictive Maintenance** | Maintenance based on analytics and predictions of potential failures. | Operations | Condition-Based Maintenance |
| **Emergency Maintenance** | Urgent unplanned maintenance due to critical failure. | Operations | Emergency Repair |
| **Maintenance Log** | A record of maintenance activities performed on a device. | Operations | Service Record, Maintenance History |
| **Technician** | A person who performs maintenance and repairs on network devices. | Personnel | Field Technician, Service Technician |
| **Work Order** | A formal request or instruction to perform maintenance work. | Operations | Service Ticket, Job Order |
| **Service Level Agreement (SLA)** | A commitment between a service provider and customer defining service expectations. | Operations | SLA |
| **Mean Time To Repair (MTTR)** | The average time required to repair a failed device. | Operations | Repair Time |
| **Mean Time Between Failures (MTBF)** | The average time between device failures. | Operations | Reliability Metric |
| **Warranty** | A guarantee from the manufacturer covering repairs or replacements for a period. | Hardware Management | Guarantee |

---

## Business & Procurement

| Term | Meaning | Context | Synonyms/Notes |
|------|---------|---------|----------------|
| **Supplier** | A company or vendor that provides devices and equipment. | Procurement | Vendor, Provider |
| **Purchase Order** | A formal document issued to a supplier to purchase devices. | Procurement | PO |
| **Inventory** | The collection of devices and equipment owned by the organization. | Asset Management | Stock, Assets |
| **Asset** | A physical device or piece of equipment owned by the organization. | Asset Management | Equipment, Hardware |
| **Depreciation** | The reduction in value of a device over time. | Accounting | Asset Depreciation |
| **Lifecycle** | The stages a device goes through from procurement to decommissioning. | Asset Management | Product Lifecycle |
| **Decommissioning** | The process of permanently removing a device from active service. | Asset Management | Retirement |
| **ISP (Internet Service Provider)** | A company that provides internet access to customers. | Business Domain | Service Provider |
| **Customer** | An end-user who subscribes to ISP services. | Business Domain | Client, Subscriber |
| **Billing** | The process of charging customers for services rendered. | Business Domain | Invoicing |
| **Subscription** | A recurring payment model for services. | Business Domain | Plan, Service Package |

---

## Technical Infrastructure

| Term | Meaning | Context | Synonyms/Notes |
|------|---------|---------|----------------|
| **Database** | A structured system for storing and retrieving data. | Infrastructure | DB, Data Store |
| **ORM (Object-Relational Mapping)** | A technique to map database tables to domain objects (Prisma in this system). | Infrastructure | Data Mapper |
| **Migration** | A versioned change to the database schema. | Infrastructure | Schema Migration |
| **API (Application Programming Interface)** | An interface for interacting with the system programmatically. | Infrastructure | REST API, Web API |
| **Endpoint** | A specific URL path that handles API requests. | Infrastructure | Route, API Route |
| **WebSocket** | A protocol for real-time bidirectional communication. | Infrastructure | WS |
| **Cache** | A temporary storage layer for frequently accessed data. | Infrastructure | Caching Layer |
| **Queue** | A system for managing asynchronous tasks and messages. | Infrastructure | Message Queue, Job Queue |
| **Docker** | A platform for containerizing applications. | Infrastructure | Container |
| **Environment Variable** | A configuration value set outside the application code. | Infrastructure | Config Variable, Env Var |
| **Logging** | The practice of recording events and errors for debugging and auditing. | Infrastructure | Log, Audit Trail |
| **Authentication** | The process of verifying the identity of a user or system. | Security | Auth |
| **Authorization** | The process of determining what an authenticated user is allowed to do. | Security | Access Control |
| **JWT (JSON Web Token)** | A compact token format used for authentication and information exchange. | Security | Token |

---

## User Roles & Actors

| Term | Meaning | Context | Synonyms/Notes |
|------|---------|---------|----------------|
| **System Administrator** | A user with full access to configure and manage the system. | User Roles | Admin, Sysadmin |
| **Network Manager** | A user responsible for managing network devices and configurations. | User Roles | Network Admin |
| **NOC Operator** | A user who monitors the network operations center and responds to alerts. | User Roles | Operations Center Staff |
| **Technician** | A field worker who performs maintenance and repairs. | User Roles | Field Tech, Service Tech |
| **Business Manager** | A user who views reports and manages business operations. | User Roles | Manager |
| **Viewer** | A read-only user with access to dashboards and reports. | User Roles | Observer, Guest |
| **System** | Automated processes and scheduled jobs (not a human user). | Actors | Automation, Scheduler |

---

## Processes & Workflows

| Term | Meaning | Context | Synonyms/Notes |
|------|---------|---------|----------------|
| **Deployment** | The process of installing and configuring a device in the network. | Operations | Installation, Provisioning |
| **Provisioning** | Setting up a device with its initial configuration. | Operations | Configuration, Setup |
| **Configuration** | The settings and parameters that define how a device operates. | Device Management | Config |
| **Backup** | A copy of device configuration or firmware for recovery purposes. | Operations | Configuration Backup |
| **Restore** | The process of returning a device to a previous configuration or state. | Operations | Recovery |
| **Upgrade** | Updating device firmware or software to a newer version. | Operations | Update, Patch |
| **Downgrade** | Reverting device firmware or software to a previous version. | Operations | Rollback |
| **Reboot** | Restarting a device to apply changes or recover from issues. | Operations | Restart, Power Cycle |
| **Factory Reset** | Restoring a device to its original manufacturer settings. | Operations | Hard Reset |
| **Discovery** | The process of automatically detecting devices on the network. | Network Management | Auto-Discovery |
| **Topology Mapping** | Creating a visual representation of network connections and relationships. | Network Management | Network Map |

---

## Metrics & Measurements

| Term | Meaning | Context | Synonyms/Notes |
|------|---------|---------|----------------|
| **dBm** | A unit of power level relative to 1 milliwatt (used for signal strength). | Measurements | Decibel-milliwatt |
| **dBi** | A unit of antenna gain relative to an isotropic radiator. | Measurements | Decibel-isotropic |
| **Mbps** | Megabits per second (unit of data transfer rate). | Measurements | Megabits/s |
| **Gbps** | Gigabits per second (unit of data transfer rate). | Measurements | Gigabits/s |
| **ms (milliseconds)** | Unit of time used to measure latency. | Measurements | Millisecond |
| **°C (Celsius)** | Unit of temperature used to measure device heat. | Measurements | Degrees Celsius |
| **MHz** | Megahertz (unit of frequency, used for wireless channels). | Measurements | Megahertz |
| **GHz** | Gigahertz (unit of frequency, used for wireless channels). | Measurements | Gigahertz |
| **Watts** | Unit of electrical power consumption. | Measurements | W |
| **Volts** | Unit of electrical voltage. | Measurements | V |
| **Amperes** | Unit of electrical current. | Measurements | A, Amps |
| **Percentage (%)** | Used for CPU usage, memory usage, disk usage, packet loss, etc. | Measurements | Percent |
| **Uptime Percentage** | The percentage of time a device was operational over a period. | Measurements | Availability |

---

## Domain-Specific Acronyms

| Acronym | Full Form | Meaning |
|---------|-----------|---------|
| **AP** | Access Point | Wireless network device |
| **PtP** | Point-to-Point | Direct connection between two devices |
| **PtMP** | Point-to-Multipoint | Connection from one to many devices |
| **ISP** | Internet Service Provider | Company providing internet service |
| **NOC** | Network Operations Center | Centralized monitoring facility |
| **SNMP** | Simple Network Management Protocol | Device management protocol |
| **ICMP** | Internet Control Message Protocol | Network diagnostic protocol |
| **SSH** | Secure Shell | Secure remote access protocol |
| **SLA** | Service Level Agreement | Service commitment |
| **MTTR** | Mean Time To Repair | Average repair time |
| **MTBF** | Mean Time Between Failures | Reliability metric |
| **CPE** | Customer Premises Equipment | Customer-side equipment |
| **ORM** | Object-Relational Mapping | Database abstraction technique |
| **API** | Application Programming Interface | Programmatic interface |
| **REST** | Representational State Transfer | API architectural style |
| **JWT** | JSON Web Token | Authentication token format |
| **DTO** | Data Transfer Object | Object for transferring data between layers |
| **CRUD** | Create, Read, Update, Delete | Basic data operations |
| **DDD** | Domain-Driven Design | Software design approach |
| **VO** | Value Object | Immutable domain object |

---

## Anti-Patterns to Avoid

These terms should **NOT** be used as they create ambiguity:

| Avoid This | Use This Instead | Reason |
|------------|------------------|--------|
| "Thing" | Specific entity name (Device, NetworkDevice) | Too vague |
| "Stuff" | Specific term | Too vague |
| "Data" | Specific entity or DTO | Too generic |
| "Info" | Specific term (Configuration, Metrics, Status) | Too generic |
| "Manager" (in code) | Service, Coordinator, Handler | Overused pattern |
| "Helper" | Service, Utility, Calculator | Unclear responsibility |
| "Util" | Specific service name | Unclear purpose |
| "Box" | Device, Equipment | Too informal |
| "Node" | NetworkDevice, Device | Ambiguous in network context |
| "Item" | Specific entity name | Too generic |

---

## Contextual Usage Examples

### ✅ Good Usage

> "The **Poller Service** executes a **health check** on each **Network Device** at the configured **polling interval**. When a device becomes **offline**, a **NetworkDeviceOfflineEvent** is emitted, which triggers the **Alert System** to send a **notification** via the configured **notification channel**."

### ❌ Poor Usage

> "The thing checks the stuff every few seconds. When something goes wrong, we send a message to the user."

---

## Glossary Maintenance

This ubiquitous language is a **living document** and should be updated when:

- New domain concepts are discovered
- Terms are refined through conversations with domain experts
- New features introduce new vocabulary
- Existing terms are found to be ambiguous

**Process for Adding Terms**:
1. Discuss with domain experts to ensure alignment
2. Add to this document with clear definition
3. Update code to reflect the term
4. Update API documentation
5. Update user-facing documentation

---

## References

- **Domain Model**: [DOMAIN-MODEL.md](DOMAIN-MODEL.md)
- **Architecture**: [ARCHITECTURE.md](ARCHITECTURE.md)
- **Context Map**: [CONTEXT-MAP.md](CONTEXT-MAP.md)
- **Event Flows**: [EVENT-FLOWS.md](EVENT-FLOWS.md)

---

**Document Version**: 1.0
**Last Updated**: 2025-12-03
**Maintainer**: Domain Team
**Contributors**: Development Team, Network Operations Team, Product Owner
