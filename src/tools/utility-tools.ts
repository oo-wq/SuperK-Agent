import { jsonSchema } from "ai";

export const weatherTool = {
    description: "查询指定城市的天气信息",
    inputSchema: jsonSchema({
        type: "object",
        properties: {
            city: {
                type: "string",
                description: "要查询的城市的名称,比如:“南昌”、“北京”",
            },
        },
        required: ["city"],
        additionalProperties: false,
    }),
    execute: async ({city}: { city: string }) => {
        const mockWeather: Record<string, string> = {
            "南昌": "晴，30摄氏度",
            "北京": "雨，25摄氏度",
            "上海": "阴，28摄氏度",
        }
        return mockWeather[city] || `${city}的天气信息暂未记录`;
    }
}