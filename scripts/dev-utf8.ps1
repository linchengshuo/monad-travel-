# 这行把 PowerShell 输入输出编码切到 UTF-8，避免中文显示成乱码。
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

# 这行把 PowerShell 的默认输出编码也切到 UTF-8。
$OutputEncoding = [System.Text.Encoding]::UTF8

# 这行把 Windows 控制台代码页切到 65001，65001 就是 UTF-8。
chcp 65001

# 这行启动 Vite 开发服务器，端口固定为 5173，方便你打开同一个地址。
npm.cmd run dev -- --port 5173
