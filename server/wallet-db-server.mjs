import http from "node:http"; // 引入 Node 自带的 HTTP 模块，用来创建本地 API 服务。
import { mkdir, readFile, writeFile } from "node:fs/promises"; // 引入文件读写工具，用来保存本地数据库文件。
import path from "node:path"; // 引入路径工具，避免手写路径时出错。
import { fileURLToPath } from "node:url"; // 引入 URL 转文件路径工具，方便在 ESM 模块里定位当前文件。

const currentFile = fileURLToPath(import.meta.url); // 获取当前服务文件的绝对路径。
const serverDir = path.dirname(currentFile); // 获取当前服务文件所在目录。
const projectRoot = path.resolve(serverDir, ".."); // 获取项目根目录。
const databaseDir = path.join(projectRoot, ".local-db"); // 设置本地数据库目录，这个目录不会提交到 Git。
const databaseFile = path.join(databaseDir, "wallet-users.json"); // 设置钱包用户数据库文件路径。
const port = Number(process.env.WALLET_DB_PORT ?? 5174); // 从环境变量读取 API 端口，默认使用 5174。

function isWalletAddress(value) { // 定义检查钱包地址格式的函数。
  return typeof value === "string" && /^0x[a-fA-F0-9]{40}$/.test(value); // 钱包地址必须是 0x 开头加 40 位十六进制字符。
} // 钱包地址检查函数结束。

function sendJson(response, statusCode, payload) { // 定义返回 JSON 的函数。
  response.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type", "Access-Control-Allow-Methods": "GET,POST,OPTIONS" }); // 设置响应头，允许前端访问这个 API。
  response.end(JSON.stringify(payload)); // 把对象转成 JSON 字符串并返回给前端。
} // 返回 JSON 函数结束。

async function readRequestBody(request) { // 定义读取请求正文的函数。
  const chunks = []; // 创建数组，用来收集请求传来的数据块。
  for await (const chunk of request) { // 逐块读取请求正文。
    chunks.push(chunk); // 把当前数据块放进数组。
  } // 请求正文读取结束。
  const rawBody = Buffer.concat(chunks).toString("utf8"); // 把所有数据块合并成一个 UTF-8 字符串。
  return rawBody ? JSON.parse(rawBody) : {}; // 如果有正文就解析 JSON，没有正文就返回空对象。
} // 读取请求正文函数结束。

async function readDatabase() { // 定义读取数据库文件的函数。
  await mkdir(databaseDir, { recursive: true }); // 确保数据库目录存在，不存在就自动创建。
  try { // 开始尝试读取数据库。
    const fileText = await readFile(databaseFile, "utf8"); // 读取数据库文件内容。
    return JSON.parse(fileText); // 把数据库文件内容解析成对象。
  } catch (error) { // 如果文件不存在或读取失败，就进入这里。
    if (error.code !== "ENOENT") throw error; // 如果不是“文件不存在”，就把错误抛出去。
    return { users: [] }; // 如果文件不存在，就返回一个空用户列表。
  } // 数据库读取错误处理结束。
} // 读取数据库函数结束。

async function writeDatabase(database) { // 定义写入数据库文件的函数。
  await mkdir(databaseDir, { recursive: true }); // 确保数据库目录存在。
  await writeFile(databaseFile, `${JSON.stringify(database, null, 2)}\n`, "utf8"); // 把数据库对象格式化后写入文件。
} // 写入数据库函数结束。

async function saveWalletConnection(payload) { // 定义保存钱包连接记录的函数。
  const walletAddress = payload.walletAddress; // 从请求里取出钱包地址。
  const chainId = Number(payload.chainId ?? 0); // 从请求里取出链 ID，没有就记为 0。
  const source = typeof payload.source === "string" ? payload.source : "web"; // 记录来源，默认来自网页。
  if (!isWalletAddress(walletAddress)) { // 检查钱包地址格式是否正确。
    return { ok: false, statusCode: 400, error: "钱包地址格式不正确。" }; // 地址不正确时返回错误。
  } // 地址格式检查结束。
  const normalizedAddress = walletAddress.toLowerCase(); // 把钱包地址转成小写，避免同一个地址大小写不同导致重复。
  const now = new Date().toISOString(); // 生成当前时间字符串。
  const database = await readDatabase(); // 读取当前数据库。
  const existingUser = database.users.find((user) => user.walletAddress === normalizedAddress); // 查找这个钱包是否已经记录过。
  if (existingUser) { // 如果这个钱包已经存在。
    existingUser.lastSeenAt = now; // 更新最后连接时间。
    existingUser.connectCount += 1; // 连接次数加一。
    existingUser.latestChainId = chainId; // 更新最近一次连接的链 ID。
    existingUser.source = source; // 更新来源。
  } else { // 如果这个钱包是第一次连接。
    database.users.push({ walletAddress: normalizedAddress, firstSeenAt: now, lastSeenAt: now, connectCount: 1, latestChainId: chainId, source }); // 新增一条钱包用户记录。
  } // 新增或更新逻辑结束。
  await writeDatabase(database); // 把更新后的数据库写回文件。
  const savedUser = database.users.find((user) => user.walletAddress === normalizedAddress); // 重新取出保存后的用户记录。
  return { ok: true, statusCode: 200, user: savedUser }; // 返回保存成功结果。
} // 保存钱包连接记录函数结束。

const server = http.createServer(async (request, response) => { // 创建 HTTP 服务。
  try { // 开始处理请求。
    if (request.method === "OPTIONS") { // 如果浏览器发送的是跨域预检请求。
      sendJson(response, 200, { ok: true }); // 返回允许跨域。
      return; // 结束请求处理。
    } // 预检请求处理结束。
    if (request.method === "GET" && request.url === "/health") { // 如果请求健康检查接口。
      sendJson(response, 200, { ok: true, service: "wallet-db" }); // 返回服务正常。
      return; // 结束请求处理。
    } // 健康检查处理结束。
    if (request.method === "POST" && request.url === "/api/wallets") { // 如果请求保存钱包地址接口。
      const payload = await readRequestBody(request); // 读取前端传来的 JSON 数据。
      const result = await saveWalletConnection(payload); // 保存钱包连接记录。
      sendJson(response, result.statusCode, result); // 把保存结果返回给前端。
      return; // 结束请求处理。
    } // 保存钱包接口处理结束。
    sendJson(response, 404, { ok: false, error: "接口不存在。" }); // 其他路径返回 404。
  } catch (error) { // 捕获服务处理过程中的错误。
    sendJson(response, 500, { ok: false, error: error instanceof Error ? error.message : "服务器错误。" }); // 返回服务器错误信息。
  } // 错误处理结束。
}); // HTTP 服务创建结束。

server.listen(port, "127.0.0.1", () => { // 启动 API 服务，只监听本机地址。
  console.log(`Wallet database API running at http://127.0.0.1:${port}`); // 在终端打印 API 地址。
}); // API 服务启动结束。
