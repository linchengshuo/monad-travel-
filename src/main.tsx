import React from "react"; // 引入 React，React 负责把组件渲染成网页。
import ReactDOM from "react-dom/client"; // 引入 ReactDOM，ReactDOM 负责把 React 放进 HTML 页面。
import AppWithAudit from "./AppWithAudit"; // 引入带审核入口的新主应用组件，这个组件包含用户、商家、审核员三个流程。
import "./appShell.css"; // 引入页面样式文件，让网页有布局、颜色和按钮样式。

ReactDOM.createRoot(document.getElementById("root")!).render( // 找到 index.html 里的 root 节点，并创建 React 应用入口。
  <React.StrictMode> {/* 开启 React 严格模式，开发时可以帮助发现潜在问题。 */}
    <AppWithAudit /> {/* 渲染带审核入口的主应用界面。 */}
  </React.StrictMode>, // 严格模式包裹结束。
); // React 渲染命令结束。
