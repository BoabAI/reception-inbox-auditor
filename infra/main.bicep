// ─── Reception Inbox Auditor — Azure infrastructure ─────────────────
// Deploys: Function App (Linux/Node 20 Consumption), Storage (state + table),
// Key Vault (Graph client secret), system-assigned managed identity, RBAC
// for Azure OpenAI + Storage Table.
//
// Customer's Azure OpenAI resource is a PREREQUISITE — pass its resourceId
// in azureOpenAIResourceId. Quota approval can take 24-72h; start early.
//
// Deploy with:
//   az deployment sub create \
//     --location australiaeast \
//     --template-file infra/main.bicep \
//     --parameters @infra/main.parameters.json
// ───────────────────────────────────────────────────────────────────
targetScope = 'subscription'

@description('Short name used in resource naming (3-10 lowercase alphanumeric)')
@minLength(3)
@maxLength(10)
param namePrefix string = 'recept'

@description('Deployment environment suffix (e.g. prod, dev, test)')
param env string = 'prod'

@description('Azure region for all resources (Australia East for AU data residency)')
param location string = 'australiaeast'

// ─── Tenant / app config (flow into Function App settings) ──────────
@description('Microsoft 365 tenant ID')
param m365TenantId string

@description('Shared mailbox to watch')
param watchedMailbox string

@description('SharePoint hostname, e.g. contoso.sharepoint.com')
param sharePointHostname string

@description('SharePoint site path, e.g. /sites/AIApplications')
param sharePointSitePath string

@description('SharePoint list display name')
param sharePointListName string = 'Reception Email Tracker'

@description('Azure OpenAI endpoint URL')
param azureOpenAIEndpoint string

@description('Azure OpenAI deployment name')
param azureOpenAIDeployment string = 'gpt-4.1-nano'

@description('Resource ID of the customer-provided Azure OpenAI account (for RBAC)')
param azureOpenAIResourceId string

@description('App registration client ID for Graph app-only auth')
param graphClientId string

@description('App registration client secret. Stored in Key Vault.')
@secure()
param graphClientSecret string

// ─── Compose names ──────────────────────────────────────────────────
var suffix = uniqueString(subscription().id, namePrefix, env)
var rgName = 'rg-${namePrefix}-${env}'
var storageAccountName = toLower(replace('${namePrefix}st${env}${substring(suffix, 0, 6)}', '-', ''))
var keyVaultName = '${namePrefix}-kv-${env}-${substring(suffix, 0, 6)}'
var functionAppName = '${namePrefix}-fn-${env}-${substring(suffix, 0, 6)}'
var planName = '${namePrefix}-plan-${env}'
var appInsightsName = '${namePrefix}-ai-${env}'
var cursorTableName = 'cursors'

// ─── Resource group ─────────────────────────────────────────────────
resource rg 'Microsoft.Resources/resourceGroups@2023-07-01' = {
  name: rgName
  location: location
}

module core 'modules/core.bicep' = {
  name: 'core-${env}'
  scope: rg
  params: {
    location: location
    storageAccountName: storageAccountName
    keyVaultName: keyVaultName
    functionAppName: functionAppName
    planName: planName
    appInsightsName: appInsightsName
    cursorTableName: cursorTableName
    m365TenantId: m365TenantId
    watchedMailbox: watchedMailbox
    sharePointHostname: sharePointHostname
    sharePointSitePath: sharePointSitePath
    sharePointListName: sharePointListName
    azureOpenAIEndpoint: azureOpenAIEndpoint
    azureOpenAIDeployment: azureOpenAIDeployment
    graphClientId: graphClientId
    graphClientSecret: graphClientSecret
  }
}

// ─── RBAC: Function MSI → customer's Azure OpenAI ───────────────────
// Cognitive Services OpenAI User: 5e0bd9bd-7b93-4f28-af87-19fc36ad61bd
var openAIUserRoleId = '5e0bd9bd-7b93-4f28-af87-19fc36ad61bd'

module openAIRoleAssignment 'modules/role-assignment.bicep' = {
  name: 'openai-role-${env}'
  scope: resourceGroup(split(azureOpenAIResourceId, '/')[4])
  params: {
    principalId: core.outputs.functionPrincipalId
    targetResourceId: azureOpenAIResourceId
    roleDefinitionId: openAIUserRoleId
    roleNameForDeployment: 'openai-user'
  }
}

// ─── Outputs ────────────────────────────────────────────────────────
output resourceGroupName string = rg.name
output functionAppName string = functionAppName
output functionPrincipalId string = core.outputs.functionPrincipalId
output storageAccountName string = storageAccountName
output keyVaultName string = keyVaultName
output appInsightsConnectionString string = core.outputs.appInsightsConnectionString
