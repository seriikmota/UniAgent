import {ToolConfig} from "../model/AgentConfig";
import {z} from "zod";
import {DynamicStructuredTool} from "@langchain/core/tools";
import {createReactAgent} from "@langchain/langgraph/prebuilt";
import {ChatOpenAI} from "@langchain/openai";
import * as dotenv from "dotenv";
import {PostgresSaver} from "@langchain/langgraph-checkpoint-postgres";
import {pool} from "../../server";
import {StructuredToolInterface} from "@langchain/core/dist/tools";

dotenv.config();
const config = { configurable: { thread_id: "1" } };

export class AgentService {

    public static async handleMessage(message: string, tools: Array<ToolConfig>) {
        let agent = await this.createAgent(tools)

        return { message: await this.processMessage(agent, message) }
    }

    private static async processMessage(agent: any, message: string) {
        let agentOutput = await agent.invoke({
            messages: [{
                role: "user",
                content: message
            }],
        }, config);
        return agentOutput.messages[agentOutput.messages.length - 1].content;
    }

    private static async createAgent(tools: Array<ToolConfig>) {
        const checkpointer = new PostgresSaver(pool);
        await checkpointer.setup();

        return createReactAgent({
            llm: this.createLLM(),
            tools: this.createTools(tools),
            checkpointSaver: checkpointer,
            messageModifier: 'Você é um assistente de um sistema de gerenciamento de usuários'
        });
    }

    private static createLLM() {
        return new ChatOpenAI( {model: 'gpt-4o-mini', temperature: 0} )
    }

    private static createTools(tools: Array<ToolConfig>): Array<StructuredToolInterface> {
        let mountedTools: Array<any> = new Array<any>()

        for (let tool of tools) {
            let mountedTool;

            if (tool.isRequest)
                mountedTool = this.createDynamicTool(tool);
            else
                mountedTool = this.createStructuredTool(tool);

            mountedTools.push(mountedTool);
        }

        return mountedTools;
    }

    private static createDynamicTool(tool: ToolConfig): any {
        let schema = this.createSchemeTool(tool.parameters)
        let func = this.createFuncTool(tool);
        return new DynamicStructuredTool({
            name: tool.name,
            description: tool.description,
            schema: schema,
            func: func
        });
    }

    private static createStructuredTool(tool: ToolConfig): any {
        let schema = this.createSchemeTool(tool.parameters)
        return {
            name: tool.name,
            description: tool.description,
            schema: schema,
        };
    }

    private static createSchemeTool(parameters: any): any {
        return !parameters ? z.object({}) : z.object(
            Object.keys(parameters).reduce((acc, key) => {
                const param = parameters[key];
                let parameterZod: z.ZodType;

                switch (param.clazz.toUpperCase()) {
                    case 'NUMBER': parameterZod = z.number().describe(param.description); break;
                    case 'STRING':  parameterZod = z.string().describe(param.description); break;
                    case 'BOOLEAN': parameterZod = z.boolean().describe(param.description); break;
                    case 'ENUM': parameterZod = z.enum(param.possibleValues).describe(param.description); break;
                    case 'NULL': parameterZod = z.null(); break;
                    default: throw new Error(`Tipo de parâmetro não suportado: ${param.clazz}`);
                }

                switch (param.type) {
                    case 'AUTO' || 'FIXED': acc[key] = parameterZod.nullable(); break;
                    case 'OPTIONAL': {
                        acc[key] = parameterZod.optional().nullable();
                        console.log("OPTIONAL")
                        break;
                    }
                    case 'MANDATORY': acc[key] = parameterZod; break;
                    default: acc[key] = parameterZod; break;
                }

                return acc;
            }, {} as Record<string, z.ZodType>)
        );
    }

    private static createFuncTool(tool: ToolConfig) {
        return async (args: any): Promise<string> => {
            let finalUrl = tool.url;

            for (const [key, value] of Object.entries(args)) {
                if (value !== undefined && value !== null) {
                    finalUrl = finalUrl.replace(`{${key}}`, encodeURIComponent((value as string | number | boolean).toString()));
                } else {
                    finalUrl = finalUrl.replace(`{${key}}`, '');
                }
            }

            const filteredArgs = Object.fromEntries(
                Object.entries(args).filter(([_, value]) => value !== undefined)
            );

            console.log("finalUrl" + finalUrl)
            console.log("finalUrl" + JSON.stringify(filteredArgs))

            const response = await fetch(finalUrl, {
                method: tool.method,
                headers: { 'Content-Type': 'application/json' },
                body: tool.method !== 'GET' ? JSON.stringify(filteredArgs) : undefined,
            });

            const data = await response.json();

            console.log(JSON.stringify(data))

            return JSON.stringify(data);
        }
    }
}