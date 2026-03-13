# AIDIALECTIC — Privacy Policy

**Effective date:** March 2026
**Last updated:** March 2026

## Summary

AIDIALECTIC does not collect, transmit, or store any user data outside of your local browser. Your data stays on your device.

## What data AIDIALECTIC accesses

AIDIALECTIC interacts with the web pages at **claude.ai** and **gemini.google.com** in order to paste structured prompts into chat inputs and capture AI-generated responses. This interaction happens entirely within your browser using Chrome's content script APIs.

Session data, including your questions, AI responses, and conversation history, is stored locally on your device using Chrome's built-in storage API (`chrome.storage.local`). This data never leaves your browser.

## What data AIDIALECTIC does NOT do

- **No data is transmitted** to any external server, analytics service, or third party
- **No tracking or analytics** of any kind (no cookies, no telemetry, no usage metrics)
- **No account required.** AIDIALECTIC has no user accounts, logins, or registration
- **No advertising.** AIDIALECTIC contains no ads and no ad-related tracking

## GitHub export (optional, user-initiated)

AIDIALECTIC includes an optional feature to export session transcripts to a GitHub repository. This feature requires you to manually configure a personal access token in the extension's settings. Exports only occur when you explicitly initiate them. AIDIALECTIC does not store your GitHub token on any external server. It is saved locally in Chrome's storage alongside your session data.

## Clipboard access

AIDIALECTIC uses clipboard access (`clipboardWrite`) as a fallback method for pasting prompts into AI chat interfaces. Clipboard content is not read, stored, or transmitted.

## Permissions explained

| Permission | Why it's needed |
|---|---|
| `sidePanel` | Opens the AIDIALECTIC conversation panel in Chrome's side panel |
| `storage` | Saves your sessions and settings locally on your device |
| `clipboardWrite` | Fallback method for pasting prompts into AI chat inputs |
| `activeTab` | Detects which AI site you're currently viewing |
| `scripting` | Re-injects content scripts when the extension updates |
| `webNavigation` | Detects page navigation on AI sites (which use single-page app routing) |
| Host access to `claude.ai` and `gemini.google.com` | Injects content scripts that handle prompt pasting and response capture on these two sites only |

## Data deletion

All AIDIALECTIC data can be deleted at any time by either using the "Clear All Data" option in the extension's settings page, or by uninstalling the extension from Chrome.

## Changes to this policy

If this policy is updated, the effective date at the top will be changed. AIDIALECTIC is open-source. You can review the complete source code at any time to verify these claims.

## Contact

If you have questions about this privacy policy, reach out at [deftx.com/aidialectic](https://deftx.com/aidialectic).
