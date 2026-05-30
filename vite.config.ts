import { defineConfig } from "vite"; // 从 Vite 里拿到定义配置的函数。
import react from "@vitejs/plugin-react"; // 引入 React 插件，让 Vite 能理解 React 代码。

export default defineConfig({ // 导出 Vite 配置，Vite 启动时会读取这里。
  plugins: [react()], // 启用 React 插件，支持 JSX 和快速刷新。
}); // 配置对象到这里结束。
