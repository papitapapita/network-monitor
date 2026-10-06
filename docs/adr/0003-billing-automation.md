# ADR 0003 — Billing Automation

## Status

Accepted — 2026-10-05

## Context

A prospective client (a Colombian ISP, off-site install under ADR 0002) needs
billing automated before signing:

1. a bill sent to every customer each cycle;
2. payment reminders around the due date, with configurable grace days;
3. online payment that marks the bill paid on its own;
4. manual payments (cash, transfer) marked too;
5. service cut automatically after the grace days and restored on payment.

What exists today: `Bill` (BIL-001…141) is generated, marked overdue and marked
paid by hand over HTTP; nothing records how a bill was paid. A SUSPENDED
`ContractedService` is enforced with a `1k/1k` MikroTik queue (SVC-022) and a
WhatsApp notice, but nothing links an unpaid bill to a suspension. Enforcement
talks to the router from the server, so it cannot reach an off-site client's
network.

## Decision

### Collection groups and the cycle

- Each customer pays by the **15th or the 30th** (`Customer.paymentDay`,
  CUS-024; default 30, CUS-025). The 30th means the last day in February.
- That day is the bill's **due date** (end of day, Colombian time, UTC-5).
- The bill is **issued 5 days earlier**.
- After the due date the bill goes **OVERDUE**; **3 grace days** follow.
- The day after the last grace day, unpaid customers are **cut**.
- Lead days and grace days are install settings, editable by the ISP's admin.
- The **billing mode** is a setting too: paid in advance (a bill due in October
  is for October) or after use (for September). ISPs do both.
- Customers with only suspended services are not billed.
- A new customer's first bill is **prorated** from the day their service
  started. Paid in advance, it also covers the days of the joining month that
  no bill charged. Bills made by hand stay whole-month.
- Automatic billing is **off until the admin turns it on**, so an install that
  bills by hand today (Insetel) is not changed by the upgrade.

### Payments

- Payments are **marked by hand** first: method (cash, bank transfer, Nequi,
  Daviplata, Bre-B or other), reference, amount, the date paid (earlier than
  the entry is fine, never in the future), and the user who entered it. The
  bill's existing pay action records it.
- A bill is paid only when the **full amount** is recorded.
- Paying every overdue bill of a suspended customer restores the service —
  all of their suspended services, at once.
- The automatic cut has its own switch, off by default, separate from
  automatic billing.
- Online sources (a gateway webhook or a bank's collection file) arrive later
  as further payment methods on the same record. Each is verified and
  idempotent on the provider's transaction id.

### Cutting service

- "Cut" is the existing **`1k/1k` queue**: the customer can still reach the
  ISP's pages and WhatsApp, and the CPE stays pingable.
- Off site, the server asks the client's **on-site agent** to apply or remove
  the queue: a new backend-sent agent request beside `probe`, announced as an
  `enforce` capability in the agent's hello (agent `0.4.0`). Reconciliation
  goes through the agent too.

### Notices

- Reminders by WhatsApp and email, near the cut: in the last two grace days.
- The bill itself is emailed with its PDF when issued; WhatsApp only carries
  the reminders, since each template message costs money.
- Email uses the install's SMTP sender (Resend), shared with sign-in emails.

### Deferred (not built now)

- **DIAN electronic invoicing.** Preferred route: connect to the ISP's existing
  billing software if it has an API (Alegra, Siigo); the ISP's own subscription
  pays for it. Otherwise an API-first provider (Factus, Dataico). Until then the
  bill is a payment notice (estado de cuenta), not a legal factura.
- **Online payment.** Ranked by cost: a bank collection agreement (convenio de
  recaudo) with PSE and a daily Asobancaria file, at a fixed fee per payment;
  direct PSE with ACH Colombia; a gateway (Wompi preferred over ePayco and
  Mercado Pago) as an optional convenience. Chosen once the client names their
  bank and software.

## Phases

One commit per slice, reviewed before the next.

1. Payment day on the customer (CUS-024, CUS-025).
2. Billing settings and the automatic cycle: generate on the issue day, mark
   overdue after the due date. Then prorated first bills.
3. Manual payments.
4. Automatic cut after the grace days, restore on payment.
5. Enforcement through the on-site agent.
6. Notices (WhatsApp + email).
7. Deferred items above, as the client decides.

## Consequences

- Billing reads the customer's payment day through a read-only query port, not
  the customers repository.
- The agent gains a second request type; older agents without `enforce` are
  refused with a reason, as probes are today.
- Until DIAN is connected, the ISP keeps issuing its legal invoices the way it
  does now.
