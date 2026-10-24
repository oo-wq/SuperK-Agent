import type { ToolResultPart } from "ai";

// ToolResultOutput 与纯文本之间的互转（压缩/截断时用文本替换工具结果）

type ToolResultOutput = ToolResultPart["output"];

export function textToolResultOutput(value: string): ToolResultOutput {
  return {
    type: "text",
    value,
  };
}

export function toolResultOutputToText(
  output: ToolResultOutput,
): string | undefined {
  switch (output.type) {
    case "text":
    case "error-text":
      return output.value;
    case "json":
    case "error-json":
      return JSON.stringify(output.value);
    case "content":
      return output.value
        .map((part) => {
          if (part.type === "text") return part.text;
          const mediaType = "mediaType" in part ? part.mediaType : undefined;
          return `[media:${mediaType ?? part.type}]`;
        })
        .join("\n");
  }
}
