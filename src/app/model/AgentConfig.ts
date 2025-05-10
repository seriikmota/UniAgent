export interface ToolConfig {
    name: string
    description: string
    isRequest: boolean
    method: 'GET' | 'POST' | 'PUT' | 'DELETE'
    url: string
    parameters: Record<string, { type: string, clazz: string, description: string, possibleValues: string[] }>
}

export interface CachedTools {
    expiresAt: number
    tools: Array<ToolConfig>
}