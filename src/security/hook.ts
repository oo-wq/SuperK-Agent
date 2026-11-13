export type HookAction = "allow" | "block" | "modify";

export interface HookResult {
  action: HookAction;
  reason?: string;
  modifiedInput?: any;
  modifiedOutput?: any;
}

export type PreToolHook = (
  toolName: string,
  input: any,
) => HookResult | Promise<HookResult>;

export type PostToolHook = (
  toolName: string,
  input: any,
  output: any,
) => HookResult | Promise<HookResult>;

// 将捕获的错误统一转为可读字符串
function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

// 工具执行前后（pre/post）的安全 Hook 管线
export class HookPipeline {
  private preHooks: { name: string; fn: PreToolHook }[] = [];
  private postHooks: { name: string; fn: PostToolHook }[] = [];

  registerPre(name: string, fn: PreToolHook): void {
    this.preHooks.push({ name, fn });
  }

  registerPost(name: string, fn: PostToolHook): void {
    this.postHooks.push({ name, fn });
  }

  async runPre(toolName: string, input: any): Promise<HookResult> {
    let currentInput = input;

    for (const hook of this.preHooks) {
      try {
        const result = await hook.fn(toolName, currentInput);
        if (result.action === "block") {
          console.log(`[hook:${hook.name}] 拦截 ${toolName} ${result.reason}`);
          return result;
        }
        if (result.action === "modify" && result.modifiedInput !== undefined) {
          currentInput = result.modifiedInput;
          console.log(`[hook:${hook.name}] 修改了 ${toolName} 的输入`);
        }
      } catch (err) {
        console.error(`[hook:${hook.name}] 执行Pre异常: ${errorMessage(err)}`);
      }
    }
    return { action: "allow" };
  }

  async runPost(
    toolName: string,
    input: any,
    output: any,
  ): Promise<HookResult> {
    let currentOutput = output;
    for (const hook of this.postHooks) {
      try {
        const result = await hook.fn(toolName, input, currentOutput);
        if (result.action === "modify" && result.modifiedOutput !== undefined) {
          currentOutput = result.modifiedOutput;
        }
      } catch (err) {
        console.error(`[hook:${hook.name}] 执行Post异常: ${errorMessage(err)}`);
      }
    }
    return { action: "allow", modifiedOutput: currentOutput };
  }

  list(): { pre: string[]; post: string[] } {
    return {
      pre: this.preHooks.map((hook) => hook.name),
      post: this.postHooks.map((hook) => hook.name),
    };
  }
}
