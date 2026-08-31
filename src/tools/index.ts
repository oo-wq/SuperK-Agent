import { ToolDefinition } from "./registry";
import { pickSearchTool, webFetchTool } from "./web-search";
import { bashTool } from "./shell-tools";
import { globTool, grepTool } from "./search-tools";
import {
  readFileTool,
  writeFileTool,
  listDirectoryTool,
  editFileTool,
} from "./file-tools";

export const allTools: ToolDefinition[] = [
  readFileTool,
  writeFileTool,
  listDirectoryTool,
  editFileTool,
  globTool,
  grepTool,
  bashTool,
  pickSearchTool(),
  webFetchTool,
];

// 核心工具
export {
  readFileTool,
  writeFileTool,
  listDirectoryTool,
  editFileTool,
  globTool,
  grepTool,
  bashTool,
};
