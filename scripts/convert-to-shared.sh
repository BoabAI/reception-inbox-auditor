#!/usr/bin/env bash
# Convert demonstration@smecai.au from UserMailbox to Shared.
# Required because Microsoft Graph's Mail.Read.Shared scope only honours
# delegation on shared mailboxes — even FullAccess on a regular user mailbox
# isn't enough to call /users/<upn>/messages from a delegated token.
#
# Side effects:
#   - Demonstration mailbox no longer needs an E3/E5 license (free for shared)
#   - sean@smecai.au keeps FullAccess + SendAs (already granted earlier)
#
# Rollback: `Set-Mailbox -Identity demonstration@smecai.au -Type Regular`
set -euo pipefail

pwsh -NoLogo -NoProfile -Command '
$ErrorActionPreference = "Stop"
Import-Module ExchangeOnlineManagement
Connect-ExchangeOnline -UserPrincipalName sean@smecai.au -ShowBanner:$false 2>&1 | Out-Null
Write-Host "> converting demonstration@smecai.au to Shared"
Set-Mailbox -Identity demonstration@smecai.au -Type Shared
Start-Sleep -Seconds 5
Write-Host "> verify"
Get-Mailbox -Identity demonstration@smecai.au | Format-List Name, RecipientTypeDetails, PrimarySmtpAddress
Disconnect-ExchangeOnline -Confirm:$false | Out-Null
'
