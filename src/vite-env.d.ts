/// <reference types="vite/client" />

interface Window { // 扩展浏览器窗口类型，让 TypeScript 知道钱包对象存在。
  ethereum?: { // 声明可选的钱包对象，MetaMask 等钱包会把它挂到 window 上。
    request: (args: { method: string; params?: unknown[] }) => Promise<unknown>; // 声明钱包请求方法，用来连接钱包和签名。
  }; // 钱包对象声明结束。
} // 浏览器窗口类型扩展结束。
