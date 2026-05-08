#!/usr/bin/env bash
# One-shot: grant the signed-in az user the data-plane role on the AU East
# Azure OpenAI account so DefaultAzureCredential can call it.
set -euo pipefail

SCOPE="/subscriptions/9fae4eea-369b-4474-b16f-09401bbaae64/resourceGroups/Email-Agent-Test/providers/Microsoft.CognitiveServices/accounts/Email-AI-OpenAI"
ASSIGNEE="sean@smecai.au"
ROLE="Cognitive Services OpenAI User"

echo "Granting '$ROLE' to $ASSIGNEE on Email-AI-OpenAI..."
az role assignment create --assignee "$ASSIGNEE" --role "$ROLE" --scope "$SCOPE"
echo "Done."
