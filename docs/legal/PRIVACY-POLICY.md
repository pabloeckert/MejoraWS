# Privacy Policy — MejoraWS

**Last updated:** April 28, 2026

## 1. Introduction

MejoraWS ("we", "our", "us") is a CRM WhatsApp automation tool. This Privacy Policy describes how we collect, use, and protect personal data when using our service.

## 2. Data We Collect

### 2.1 Contact Information
- **Name** — provided by the user or received via WhatsApp
- **Phone number** — required for WhatsApp communication
- **Email address** — optional, provided by the user
- **Company** — optional, provided by the user
- **Tags and scores** — assigned by the system or user

### 2.2 Communication Data
- **Messages** — content of WhatsApp conversations (inbound and outbound)
- **Timestamps** — when messages were sent/received
- **Message status** — sent, delivered, read

### 2.3 Activity Data
- **CRM activities** — deal stage changes, campaign participation
- **System activities** — bot responses, escalations

## 3. How We Use Data

- **Auto-reply:** Our AI bot uses message content to generate automated responses
- **CRM management:** Contact data is used for pipeline and deal tracking
- **Campaigns:** Contact data is used for targeted message campaigns
- **Analytics:** Aggregated data is used for performance reporting

## 4. Legal Basis for Processing (GDPR Article 6)

- **Consent:** Contact has explicitly agreed to receive messages
- **Legitimate interest:** Business communication with existing contacts
- **Contract performance:** Communication necessary for business relationship

## 5. Data Storage and Security

- **Local storage:** All data is stored locally in SQLite databases
- **No cloud dependencies:** Data does not leave the server (except WhatsApp messages via Baileys)
- **Encryption:** WhatsApp sessions are encrypted by Baileys
- **Access control:** Dashboard access is protected by JWT authentication

## 6. Data Retention

| Data Type | Retention Period |
|-----------|-----------------|
| Messages | 180 days (6 months) |
| Activities | 365 days (1 year) |
| Audit logs | 90 days (3 months) |
| Contacts | Until deletion requested |
| Campaigns | Until deletion requested |

## 7. Your Rights (GDPR)

### 7.1 Right of Access
Request a copy of all your personal data via `GET /api/v1/gdpr/export/:phone`

### 7.2 Right to Erasure
Request deletion of all your data via `DELETE /api/v1/gdpr/erase/:phone`

### 7.3 Right to Rectification
Request correction of inaccurate data via `PUT /api/v1/contacts/:id`

### 7.4 Right to Restrict Processing
Request limitation of data processing by contacting the administrator

### 7.5 Right to Data Portability
Receive your data in a structured, machine-readable format (JSON/CSV)

### 7.6 Right to Withdraw Consent
Withdraw consent at any time via `PUT /api/v1/gdpr/consent/:phone`

## 8. Third-Party Services

| Service | Purpose | Data Shared |
|---------|---------|-------------|
| **Baileys (WhatsApp Web)** | Message delivery | Phone numbers, message content |
| **Groq API** | AI response generation | Message content (for intent/sentiment analysis) |
| **Ollama** | Local AI backup | Message content (stays local) |

## 9. Data Protection Officer

For privacy-related inquiries, contact the system administrator.

## 10. Changes to This Policy

We may update this Privacy Policy from time to time. Changes will be documented in the project repository.

---

*This policy is compliant with the General Data Protection Regulation (EU) 2016/679.*
