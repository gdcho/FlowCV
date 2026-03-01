# Privacy Policy - FlowCV Chrome Extension

**Last updated: February 2026**

FlowCV ("the extension") is a Chrome extension that uses Claude AI to tailor your Overleaf LaTeX resume to job descriptions scraped from LinkedIn and Indeed. This policy explains what data the extension accesses, how it is used, and what is never collected.

---

## 1. Data collected and why

### 1.1 Anthropic API key

- **What:** Your personal Claude API key, entered in the extension Settings page.
- **How stored:** Saved locally in Chrome's `chrome.storage.local` on your device only.
- **How used:** Sent as an `Authorization` header directly to `api.anthropic.com` when you click Analyze. It is never sent to any server operated by FlowCV.

### 1.2 Job description text

- **What:** The job title, company, summary, qualifications, responsibilities, and keywords scraped from the active LinkedIn or Indeed tab when you click Capture Job.
- **How stored:** Held in memory in the extension's MV3 service worker for the duration of your session. Optionally persisted to `chrome.storage.local` so it survives a browser restart.
- **How used:** Included in the prompt sent to the Anthropic API to generate resume suggestions. Never transmitted to any server other than `api.anthropic.com`.

### 1.3 Resume content

- **What:** The LaTeX source of your active Overleaf document, read from the Monaco or CodeMirror editor when you click Analyze.
- **How stored:** Held in memory only for the duration of a single Analyze request. Never written to disk or any external storage.
- **How used:** Included in the prompt sent to the Anthropic API to generate resume suggestions. Never transmitted to any server other than `api.anthropic.com`.

---

## 2. Data sent to third parties

The only third party that receives any data is **Anthropic** (via `api.anthropic.com`). When you click Analyze, the extension sends:

- Your API key (in the Authorization header)
- A structured prompt containing excerpts of the job description and your resume's LaTeX blocks

Anthropic's own privacy policy applies to data processed through their API: <https://www.anthropic.com/legal/privacy>

FlowCV does not send data to any other server, analytics service, or third party.

---

## 3. Data NOT collected

- No usage analytics or telemetry
- No crash reports sent off-device
- No personally identifiable information (name, email, address)
- No payment or billing information
- No browsing history beyond the active job-posting tab

---

## 4. Permissions justification

| Permission                | What it accesses                          | Why it is needed                                                    |
| ------------------------- | ----------------------------------------- | ------------------------------------------------------------------- |
| `storage`                 | Chrome's local key-value store            | Saves your API key and captured job description between sessions    |
| `activeTab`               | URL of the current tab                    | Detects whether you are on LinkedIn or Indeed to enable scraping    |
| `scripting`               | Ability to inject JavaScript into a page  | Injects a bridge script into Overleaf to read and write editor text |
| Host: `overleaf.com`      | DOM of Overleaf project pages             | Displays the sidebar UI and reads/writes LaTeX via the editor API   |
| Host: `linkedin.com`      | DOM of LinkedIn job-posting pages         | Scrapes job title, description, and requirements                    |
| Host: `indeed.com`        | DOM of Indeed job-posting pages           | Scrapes job title, description, and requirements                    |
| Host: `api.anthropic.com` | Outbound HTTPS requests to Anthropic's API | Streams Claude AI responses for resume tailoring                   |

---

## 5. Data retention

- **API key:** Stored locally until you clear it in Settings or uninstall the extension.
- **Job description:** Stored locally until you capture a new job or uninstall the extension.
- **Resume content:** Never persisted; discarded immediately after each Analyze request.
- **AI responses:** Stored in memory only for the duration of the session; not written to disk.

Uninstalling the extension removes all locally stored data.

---

## 6. Children's privacy

The extension is not directed at children under 13 and does not knowingly collect information from children.

---

## 7. Changes to this policy

If this policy changes materially, the updated version will be committed to this repository with an updated "Last updated" date. Continued use of the extension after changes constitutes acceptance of the revised policy.

---

## 8. Contact

For privacy questions or data deletion requests, open an issue in the project repository.
