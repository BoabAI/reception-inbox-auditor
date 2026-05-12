// Core resources: Storage, Key Vault, Function App, App Insights.
// Deployed at resource-group scope.

param location string
param storageAccountName string
param keyVaultName string
param functionAppName string
param planName string
param appInsightsName string
param cursorTableName string
param m365TenantId string
param watchedMailbox string
param sharePointHostname string
param sharePointSitePath string
param sharePointListName string
param azureOpenAIEndpoint string
param azureOpenAIDeployment string
param graphClientId string
@secure()
param graphClientSecret string

// ─── Storage Account (backs Function App + cursor table) ────────────
resource storage 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: storageAccountName
  location: location
  sku: { name: 'Standard_LRS' }
  kind: 'StorageV2'
  properties: {
    accessTier: 'Hot'
    minimumTlsVersion: 'TLS1_2'
    allowBlobPublicAccess: false
    supportsHttpsTrafficOnly: true
    defaultToOAuthAuthentication: true
  }
}

resource tableService 'Microsoft.Storage/storageAccounts/tableServices@2023-05-01' = {
  parent: storage
  name: 'default'
}

resource cursorTable 'Microsoft.Storage/storageAccounts/tableServices/tables@2023-05-01' = {
  parent: tableService
  name: cursorTableName
}

// ─── Application Insights ───────────────────────────────────────────
resource appInsights 'Microsoft.Insights/components@2020-02-02' = {
  name: appInsightsName
  location: location
  kind: 'web'
  properties: {
    Application_Type: 'web'
    publicNetworkAccessForIngestion: 'Enabled'
    publicNetworkAccessForQuery: 'Enabled'
  }
}

// ─── Key Vault (Graph client secret) ────────────────────────────────
resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: keyVaultName
  location: location
  properties: {
    tenantId: subscription().tenantId
    sku: { name: 'standard', family: 'A' }
    enableRbacAuthorization: true
    enableSoftDelete: true
    softDeleteRetentionInDays: 7
    enablePurgeProtection: null
    publicNetworkAccess: 'Enabled'
  }
}

resource graphSecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'graph-client-secret'
  properties: {
    value: graphClientSecret
    attributes: { enabled: true }
  }
}

// ─── Consumption Plan (Linux, Node 20) ──────────────────────────────
resource plan 'Microsoft.Web/serverfarms@2023-12-01' = {
  name: planName
  location: location
  sku: { name: 'Y1', tier: 'Dynamic' }
  kind: 'functionapp'
  properties: {
    reserved: true // Linux
  }
}

// ─── Function App ───────────────────────────────────────────────────
resource functionApp 'Microsoft.Web/sites@2023-12-01' = {
  name: functionAppName
  location: location
  kind: 'functionapp,linux'
  identity: { type: 'SystemAssigned' }
  properties: {
    serverFarmId: plan.id
    httpsOnly: true
    siteConfig: {
      linuxFxVersion: 'Node|20'
      ftpsState: 'Disabled'
      minTlsVersion: '1.2'
      appSettings: [
        // Functions runtime
        { name: 'FUNCTIONS_EXTENSION_VERSION', value: '~4' }
        { name: 'FUNCTIONS_WORKER_RUNTIME', value: 'node' }
        { name: 'WEBSITE_NODE_DEFAULT_VERSION', value: '~20' }
        { name: 'AzureWebJobsStorage', value: 'DefaultEndpointsProtocol=https;AccountName=${storage.name};EndpointSuffix=${environment().suffixes.storage};AccountKey=${storage.listKeys().keys[0].value}' }
        { name: 'APPLICATIONINSIGHTS_CONNECTION_STRING', value: appInsights.properties.ConnectionString }

        // App-specific
        { name: 'M365_TENANT_ID', value: m365TenantId }
        { name: 'WATCHED_MAILBOX', value: watchedMailbox }
        { name: 'SP_HOSTNAME', value: sharePointHostname }
        { name: 'SP_SITE_PATH', value: sharePointSitePath }
        { name: 'SP_LIST_NAME', value: sharePointListName }
        { name: 'AZURE_OPENAI_ENDPOINT', value: azureOpenAIEndpoint }
        { name: 'AZURE_OPENAI_DEPLOYMENT', value: azureOpenAIDeployment }

        { name: 'GRAPH_AUTH_MODE', value: 'app' }
        { name: 'GRAPH_CLIENT_ID', value: graphClientId }
        { name: 'GRAPH_CLIENT_SECRET', value: '@Microsoft.KeyVault(SecretUri=${graphSecret.properties.secretUri})' }

        { name: 'CURSOR_STORE', value: 'table' }
        { name: 'AZURE_STORAGE_ACCOUNT', value: storage.name }
        { name: 'AZURE_STORAGE_TABLE', value: cursorTableName }

        // Optional: 5-min schedule override
        { name: 'AUTO_LOG_SCHEDULE', value: '0 */5 * * * *' }
      ]
    }
  }
}

// ─── RBAC: Function MSI on storage table + Key Vault ────────────────
var storageTableContributorRoleId = '0a9a7e1f-b9d0-4cc4-a60d-0319b160aaa3'
var keyVaultSecretsUserRoleId = '4633458b-17de-408a-b874-0445c86b69e6'

resource tableRoleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(storage.id, functionApp.id, storageTableContributorRoleId)
  scope: storage
  properties: {
    principalId: functionApp.identity.principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', storageTableContributorRoleId)
  }
}

resource kvRoleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(keyVault.id, functionApp.id, keyVaultSecretsUserRoleId)
  scope: keyVault
  properties: {
    principalId: functionApp.identity.principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', keyVaultSecretsUserRoleId)
  }
}

output functionPrincipalId string = functionApp.identity.principalId
output functionAppName string = functionApp.name
output appInsightsConnectionString string = appInsights.properties.ConnectionString
