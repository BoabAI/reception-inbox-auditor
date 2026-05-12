// Generic role assignment scoped to the existing resource group of the target
// resource. Used for granting the Function MSI access to the customer's
// pre-existing Azure OpenAI account (which may live in a separate RG).

param principalId string
param targetResourceId string
param roleDefinitionId string
param roleNameForDeployment string

resource targetOpenAI 'Microsoft.CognitiveServices/accounts@2023-10-01-preview' existing = {
  name: split(targetResourceId, '/')[8]
}

resource assignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(targetResourceId, principalId, roleDefinitionId, roleNameForDeployment)
  scope: targetOpenAI
  properties: {
    principalId: principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', roleDefinitionId)
  }
}
