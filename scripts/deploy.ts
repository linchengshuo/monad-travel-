import hre from "hardhat"; // 引入 Hardhat 运行环境，Hardhat 是部署和测试智能合约的工具。

const monadTestnetChainId = 10143; // 定义 Monad 测试网链 ID，用来防止误部署到主网。

const demoHotelName = process.env.DEMO_HOTEL_NAME ?? "Monad 测试酒店"; // 从环境变量读取演示酒店名称，没有设置就使用默认名称。

const shouldCreateDemoHotel = process.env.CREATE_DEMO_HOTEL === "true"; // 读取是否创建演示酒店合约，true 表示创建。

const existingFactoryAddress = process.env.HOTEL_FACTORY_ADDRESS ?? process.env.VITE_HOTEL_FACTORY_ADDRESS ?? ""; // 读取已有工厂合约地址；有它就复用，不重复部署 Factory。

function requirePrivateKey() { // 定义检查部署私钥是否存在的函数。
  if (!process.env.PRIVATE_KEY) throw new Error("缺少 PRIVATE_KEY 环境变量：Hardhat 需要它来生成 Monad 测试网部署钱包。不要写进代码，只在当前 PowerShell 里临时设置。"); // 没有私钥就停止部署，并给出明确说明。
} // 私钥检查函数结束。

function looksLikeAddress(address: string) { // 定义检查字符串是否像 EVM 地址的函数。
  return /^0x[0-9a-fA-F]{40}$/.test(address); // EVM 地址必须是 0x 开头加 40 个十六进制字符。
} // 地址格式检查函数结束。

async function main() { // 定义部署入口函数。
  requirePrivateKey(); // 部署前先确认测试网钱包私钥存在。
  const connection = await hre.network.getOrCreate(); // 连接 Hardhat 当前选择的网络。
  if (connection.networkName !== "monadTestnet") throw new Error("只能部署到 monadTestnet，禁止部署到主网。"); // 网络名称不是测试网就停止。
  const publicClient = await connection.viem.getPublicClient(); // 获取公共客户端，公共客户端可以理解为只读链上数据和等待交易的工具。
  const chainId = await publicClient.getChainId(); // 从公共客户端读取当前网络链 ID。
  if (chainId !== monadTestnetChainId) throw new Error(`当前链 ID 是 ${chainId}，不是 Monad 测试网 ${monadTestnetChainId}。`); // 链 ID 不对就停止。
  const [deployer] = await connection.viem.getWalletClients(); // 获取部署者钱包，演示酒店 owner 会是这个钱包。
  const factory = looksLikeAddress(existingFactoryAddress) ? await connection.viem.getContractAt("HotelFactory", existingFactoryAddress as `0x${string}`) : await connection.viem.deployContract("HotelFactory"); // 有已有 Factory 就复用，没有就部署新的 Factory。
  const factoryAddress = factory.address; // 读取当前使用的工厂合约地址。
  console.log(`${looksLikeAddress(existingFactoryAddress) ? "Using existing" : "HotelFactory deployed at"}: ${factoryAddress}`); // 打印当前使用的工厂合约地址。
  const existingHotels = await factory.read.getOwnerHotels([deployer.account.address]); // 查询当前部署钱包名下已经创建过的酒店合约。
  console.log(`Owner wallet: ${deployer.account.address}`); // 打印 owner 钱包地址，方便你确认这个钱包就是商家钱包。
  console.log(`Existing owner hotels: ${existingHotels.length === 0 ? "none" : existingHotels.join(", ")}`); // 打印已有酒店地址；如果上次 createHotel 成功，这里会看到地址。
  if (!shouldCreateDemoHotel) { // 如果这次不要求创建新酒店。
    console.log(`Set VITE_HOTEL_FACTORY_ADDRESS=${factoryAddress}`); // 提示前端需要设置的工厂地址环境变量。
    if (existingHotels.length > 0) console.log(`Set VITE_HOTEL_HANGZHOU_CONTRACT_ADDRESS=${existingHotels[existingHotels.length - 1]}`); // 如果已有酒店，就提示最后一个酒店地址给前端使用。
    return; // 不再创建新酒店，避免重复花 gas。
  } // 不创建新酒店处理结束。
  const hash = await factory.write.createHotel([demoHotelName, []], { account: deployer.account }); // 通过工厂创建演示酒店合约，MON 支付版本不需要传代币地址。
  const receipt = await publicClient.waitForTransactionReceipt({ hash }); // 等待创建酒店交易确认。
  const createdHotelAddresses = await factory.read.getOwnerHotels([deployer.account.address]); // 通过自定义函数查询部署者名下全部酒店合约地址。
  const latestHotelAddress = createdHotelAddresses[createdHotelAddresses.length - 1]; // 取刚刚创建的最后一个酒店地址。
  console.log(`Demo Hotel tx: ${receipt.transactionHash}`); // 打印创建酒店交易哈希。
  console.log(`Demo Hotel deployed at: ${latestHotelAddress}`); // 打印演示酒店合约地址。
  console.log(`Set VITE_HOTEL_HANGZHOU_CONTRACT_ADDRESS=${latestHotelAddress}`); // 提示前端需要设置的酒店地址环境变量。
  console.log(`Set VITE_HOTEL_FACTORY_ADDRESS=${factoryAddress}`); // 提示前端需要设置的工厂地址环境变量。
} // 部署入口函数结束。

main().catch((error) => { // 执行部署函数并捕获错误。
  console.error(error); // 打印错误，方便排查。
  process.exitCode = 1; // 设置失败退出码，让命令行知道部署失败。
}); // 错误处理结束。
