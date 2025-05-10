import {CachedTools} from "../model/AgentConfig";

const toolsCache: Map<string, CachedTools> = new Map()
const TTL = 60 * 60 * 1000

export default async function toolsMiddleware(req: any, res: any, next: any) {
    try {
        const universityId: string = req.query.universityId

        const cacheEntry = toolsCache.get(universityId)

        if (cacheEntry && cacheEntry.expiresAt > Date.now()) {
            (req as any).tools = cacheEntry.tools
            return next()
        }

        const tools = await getToolsFromAD(universityId)

        toolsCache.set(universityId, {
            tools,
            expiresAt: Date.now() + TTL
        });

        (req as any).tools = tools

        next()
    } catch (error) {
        console.error('Erro no middleware de ferramentas:', error)
        res.status(500).send({ message: 'Erro ao buscar as ferramentas disp' })
    }
}

async function getToolsFromAD(universityId: string): Promise<any> {
    try {
        const response = await fetch(`http://localhost:8080/api/institutionInformationsTools/${universityId}`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
        });

        return await response.json()
    } catch (error) {
        console.error("Ocorreu um erro ao buscar as ferramentas!", error)
        throw error
    }
}