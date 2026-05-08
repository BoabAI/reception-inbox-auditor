#!/usr/bin/env bash
# One-shot: convert demonstration@smecai.au to a shared mailbox and grant
# sean@smecai.au Full Access. After this, Sean's Graph token can read the
# inbox and send-as.
#
# Run once via: bash scripts/grant-mailbox-access.sh
# Will pop a browser for Microsoft 365 admin sign-in (sean@smecai.au).
set -euo pipefail

pwsh -NoLogo -NoProfile -Command '
$ErrorActionPreference = "Stop"
Import-Module ExchangeOnlineManagement
Write-Host "Connecting to Exchange Online (browser auth as sean@smecai.au)..."
Connect-ExchangeOnline -UserPrincipalName sean@smecai.au -ShowBanner:$false

Write-Host "Granting sean@smecai.au FullAccess + SendAs on demonstration@smecai.au..."
Add-MailboxPermission -Identity demonstration@smecai.au -User sean@smecai.au -AccessRights FullAccess -InheritanceType All -AutoMapping:$false | Out-Null
Add-RecipientPermission -Identity demonstration@smecai.au -Trustee sean@smecai.au -AccessRights SendAs -Confirm:$false | Out-Null

Write-Host "Done. Permissions can take ~60s to propagate."
Disconnect-ExchangeOnline -Confirm:$false | Out-Null
'
