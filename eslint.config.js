import js from "@eslint/js"; // 引入 ESLint 官方 JavaScript 推荐规则，ESLint 是代码风格和错误检查工具。
import tseslint from "typescript-eslint"; // 引入 TypeScript ESLint，让 ESLint 能读懂 TypeScript 代码。

export default [ // 导出 ESLint 配置数组。
  js.configs.recommended, // 使用官方推荐规则，先保证基础错误能被检查出来。
  ...tseslint.configs.recommended, // 使用 TypeScript 推荐规则，检查类型脚本里的常见问题。
  { // 添加项目自己的配置。
    ignores: ["dist", "artifacts", "cache", "node_modules"], // 忽略构建产物和依赖目录。
  }, // 项目配置结束。
]; // ESLint 配置数组结束。
