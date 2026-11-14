export type Role = "owner" | "collaborator" | "guest";

export interface UserIdentity {
  id: string;
  name: string;
  role: Role;
}

// 各角色的工具访问权限
interface ToolAccess {
  allow: string[] | "*";
  deny: string[];
}

// 访客角色可用的只读工具
const GUEST_ALLOWED_TOOLS = [
  "read_file",
  "list_directory",
  "glob",
  "grep",
  "rag_search",
];

const TOOL_ACCESS: Record<Role, ToolAccess> = {
  owner: { allow: "*", deny: [] }, // 完全访问
  collaborator: { allow: "*", deny: ["bash"] }, // 自动审批
  guest: { allow: GUEST_ALLOWED_TOOLS, deny: ["bash"] }, // 手动审批
};

export function canUseTool(role: Role, toolName: string): boolean {
  const access = TOOL_ACCESS[role];
  if (access.deny.includes(toolName)) return false;
  if (access.allow === "*") return true;
  return access.allow.includes(toolName);
}

export function filterToolsForRole(toolNames: string[], role: Role): string[] {
  return toolNames.filter((name) => canUseTool(role, name));
}
