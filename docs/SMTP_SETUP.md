# Dual-Channel SMTP Setup & Deliverability Guide: Zoho Business Email & Gmail

Rhymvex utilizes a **Dual-Channel SMTP Engine** that routes outbound email automatically across two concurrent transports:

| Channel | Transport | Primary Purpose | Sender Address | Target Audience |
| :--- | :--- | :--- | :--- | :--- |
| **Channel 1: Client Business** | **Zoho Mail** | Intake "Thank You" Confirmations, Client Portal Invites, Outbound Proposals | Branded (`support@rhymvex.space`) | External Clients & Prospects |
| **Channel 2: Internal System** | **Google / Gmail** | Team Invitations, Inflow Lead Notices with Pipeline Counts, Error Detection | System Alert Address | Internal Rhymvex Team |

---

## Quick Setup: Interactive CLI Utility

Rhymvex includes an interactive setup CLI application that tests connection handshakes for both transports, sends live test emails, and saves configuration directly into `web/.env.local`:

```bash
# In the web directory:
cd web
npm run mail:app
```

Or verify both connections directly from terminal:
```bash
npm run mail:verify
```

---

## Channel 1: Zoho Mail (Client-Facing Business Channel)

Handles client-facing interactions so your business domain (`rhymvex.space`) maintains high deliverability and professional brand presence.

### Step 1: Generate a Zoho Application-Specific Password
Zoho strictly requires an Application-Specific Password for third-party SMTP clients when Two-Factor Authentication (2FA) is enabled:

1. Log in to [Zoho Accounts](https://accounts.zoho.com).
2. In the left navigation, click **Security**.
3. Under **Application-Specific Passwords**, click **Generate New Password**.
4. Set the Application Name to `Rhymvex Client Mail`.
5. Click **Generate** and copy the generated password.

### Step 2: Ensure SMTP Access is Enabled
1. Open [Zoho Mail](https://mail.zoho.com).
2. Go to **Settings** (gear icon) → **Mail Accounts**.
3. Select your account and ensure the **SMTP** checkbox / toggle is **Enabled**.

### Step 3: Configure `web/.env.local`
Add or update the following values in `web/.env.local`:

```env
ZOHO_SMTP_HOST=smtp.zoho.com
ZOHO_SMTP_PORT=465
ZOHO_SMTP_SECURE=true
ZOHO_SMTP_USER=support@rhymvex.space
ZOHO_SMTP_PASSWORD=your-zoho-app-specific-password
ZOHO_SMTP_FROM=Rhymvex <support@rhymvex.space>
```

> [!IMPORTANT]
> **Relaying Disallowed (Error 553)**: Zoho enforces strict sender validation. The email in `ZOHO_SMTP_FROM` **must** match `ZOHO_SMTP_USER` or be configured as an approved alias in your Zoho Mail account.

### Step 4: Zoho Domain DNS Records (Deliverability)
Configure these records in your domain registrar / DNS provider (Cloudflare, Namecheap, etc.):

| Type | Name / Host | Value / Target | Priority | Purpose |
|------|-------------|----------------|----------|---------|
| `MX` | `@` | `mx.zoho.com` | 10 | Primary inbound mail |
| `MX` | `@` | `mx2.zoho.com` | 20 | Secondary inbound mail |
| `MX` | `@` | `mx3.zoho.com` | 50 | Backup inbound mail |
| `TXT` | `@` | `v=spf1 include:zoho.com ~all` | — | SPF authorization |
| `TXT` | `zoho._domainkey` | *(Copy value from Zoho Admin Console → DKIM)* | — | DKIM signing |
| `TXT` | `_dmarc` | `v=DMARC1; p=none; rua=mailto:admin@rhymvex.space` | — | DMARC policy |

---

## Channel 2: Google / Gmail (System & Team Background Channel)

Handles team management, instant lead notifications with live pipeline statistics, and background error detection.

### Step 1: Enable 2-Step Verification
Google does not allow third-party SMTP authentication with your primary account password. 2-Step Verification must be enabled first:
1. Visit [Google Account Security](https://myaccount.google.com/security).
2. Ensure **2-Step Verification** is turned **ON**.

### Step 2: Generate a 16-Character Google App Password
1. Visit [Google App Passwords](https://myaccount.google.com/apppasswords).
2. Enter an app name, e.g. `Rhymvex System Mail`.
3. Click **Create**.
4. Google will display a 16-character code (e.g. `abcd efgh ijkl mnop`).
5. Copy this password (the mailer automatically strips spaces).

### Step 3: Configure `web/.env.local`
Add or update the following values in `web/.env.local`:

```env
GMAIL_SMTP_HOST=smtp.gmail.com
GMAIL_SMTP_PORT=465
GMAIL_SMTP_SECURE=true
GMAIL_SMTP_USER=your-account@gmail.com
GMAIL_SMTP_PASSWORD=abcdefghijklmnop
GMAIL_SMTP_FROM=Rhymvex System <your-account@gmail.com>

# The destination where new lead alerts and error notifications are delivered:
INTERNAL_NOTIFICATION_EMAIL=your-account@gmail.com
```

---

## Testing Your Configuration

### Via Terminal CLI:
```bash
# Interactive setup wizard
npm run mail:app

# Verify both channels live
npm run mail:verify

# Send a test email through the Client Channel (Zoho)
npx tsx scripts/smtp-app.ts --test --channel=business --to your-email@example.com

# Send a test email through the System Channel (Gmail)
npx tsx scripts/smtp-app.ts --test --channel=system --to your-email@example.com
```

### Via Web Admin Portal:
1. Sign in to the staff portal at `http://localhost:3000/admin`.
2. Navigate to **Business Email** (`/admin/email`).
3. View the **Dual-Channel SMTP Engine** matrix.
4. Click **Test Zoho Channel** or **Test Gmail Channel** to execute live TLS handshakes directly in the browser!
