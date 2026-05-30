import { createPublicClient, createWalletClient, custom, encodePacked, getAddress, http, keccak256, parseEther, toBytes, verifyMessage, type Address, type Hex } from "viem"; // 引入 viem 工具，viem 是前端和 EVM 链交互的库。
import { monadTestnet } from "viem/chains"; // 引入 Monad 测试网配置，确保钱包交易只按测试网处理。
import { HOTEL_FACTORY_ADDRESS, MONAD_TESTNET_RPC_URL } from "../config/chains"; // 引入测试网 RPC 和工厂合约地址配置，地址只从环境变量读取。
import type { PaymentToken } from "../types/booking"; // 引入支付币种类型，限制只能传 MON。

const hotelAbi = [ // 定义酒店合约最小 ABI。
  { // 定义 payBooking 函数。
    type: "function", // 声明这是一种函数。
    name: "payBooking", // 函数名是 payBooking，意思是支付并创建链上订单凭证。
    stateMutability: "payable", // 这个函数会改链上状态，并随交易接收 MON 主币。
    inputs: [ // 定义函数入参。
      { name: "bookingId", type: "bytes32" }, // bookingId 是链上订单 ID。
      { name: "offchainOrderId", type: "bytes32" }, // offchainOrderId 是链外订单编号哈希。
      { name: "guestHash", type: "bytes32" }, // guestHash 是用户资料哈希。
      { name: "checkInCodeHash", type: "bytes32" }, // checkInCodeHash 是入住数字密码哈希。
      { name: "amount", type: "uint256" }, // amount 是支付金额，按 MON 最小单位 wei 填写。
    ], // 入参定义结束。
    outputs: [], // 这个函数没有返回值。
  }, // payBooking 函数定义结束。
  { // 定义 checkIn 函数。
    type: "function", // 声明这是一种函数。
    name: "checkIn", // 函数名是 checkIn，意思是商家提交用户签名完成入住。
    stateMutability: "nonpayable", // 这个函数会改链上状态。
    inputs: [ // 定义函数入参。
      { name: "bookingId", type: "bytes32" }, // bookingId 是链上订单 ID。
      { name: "checkInCode", type: "string" }, // checkInCode 是商家掌握的明文数字密码。
      { name: "signature", type: "bytes" }, // signature 是用户钱包签出来的签名。
    ], // 入参定义结束。
    outputs: [], // 这个函数没有返回值。
  }, // checkIn 函数定义结束。
] as const; // 固定 ABI 内容，避免 TypeScript 把类型放宽。

const hotelFactoryAbi = [ // 定义酒店工厂合约最小 ABI。
  { // 定义 createHotel 函数。
    type: "function", // 声明这是一种函数。
    name: "createHotel", // 函数名是 createHotel，意思是创建一个新的酒店合约。
    stateMutability: "nonpayable", // 这个函数会改链上状态，但不直接收 MON 主币。
    inputs: [ // 定义函数入参。
      { name: "hotelName", type: "string" }, // hotelName 是酒店名称。
      { name: "acceptedTokens", type: "address[]" }, // acceptedTokens 是旧版本保留参数，MON 支付版本传空数组。
    ], // 入参定义结束。
    outputs: [{ name: "", type: "address" }], // Solidity 会返回新酒店地址，但前端交易写入时通常从链上列表再读取更稳。
  }, // createHotel 函数定义结束。
  { // 定义 getOwnerHotels 函数。
    type: "function", // 声明这是一种函数。
    name: "getOwnerHotels", // 函数名是 getOwnerHotels，意思是读取某个商家名下的酒店合约。
    stateMutability: "view", // view 表示只读链上数据，不花 gas。
    inputs: [{ name: "owner", type: "address" }], // owner 是商家钱包地址。
    outputs: [{ name: "", type: "address[]" }], // 返回这个商家的酒店合约地址数组。
  }, // getOwnerHotels 函数定义结束。
] as const; // 固定工厂 ABI 内容，避免 TypeScript 把类型放宽。

export interface BookingHashes { // 定义订单哈希结果。
  chainBookingId: Hex; // 链上订单 ID。
  offchainOrderHash: Hex; // 链外订单编号哈希。
  checkInCodeHash: Hex; // 入住数字密码哈希。
} // 订单哈希结果定义结束。

export interface PayHotelBookingInput { // 定义支付函数需要的输入。
  hotelAddress: string; // 酒店合约地址。
  tokenSymbol: PaymentToken; // 支付币种，MVP 阶段固定为 MON。
  amount: number; // 支付金额。
  orderId: string; // 链外订单编号。
  guestHash: string; // 用户资料哈希。
  checkInCode: string; // 入住数字密码。
} // 支付函数输入定义结束。

export interface SignCheckInInput { // 定义用户入住签名函数需要的输入。
  hotelAddress: string; // 酒店合约地址。
  chainBookingId: string; // 链上订单 ID。
  guestHash: string; // 用户资料哈希。
  checkInCode: string; // 入住数字密码。
} // 用户入住签名输入定义结束。

export interface VerifyCheckInSignatureInput extends SignCheckInInput { // 定义验证用户入住签名需要的输入。
  expectedWalletAddress: string; // 订单里记录的下单钱包地址。
  signature: string; // 用户钱包签出来的签名。
} // 验证用户入住签名输入定义结束。

export interface SubmitCheckInInput { // 定义商家提交入住核验需要的输入。
  hotelAddress: string; // 酒店合约地址。
  chainBookingId: string; // 链上订单 ID。
  checkInCode: string; // 入住数字密码。
  signature: string; // 用户到店签名。
} // 商家提交入住核验输入定义结束。

export interface CreateHotelContractInput { // 定义创建酒店合约需要的输入。
  hotelName: string; // 酒店或商家主体名称。
} // 创建酒店合约输入定义结束。

function assertEthereumProvider() { // 定义检查钱包插件是否存在的函数。
  if (!window.ethereum) throw new Error("没有检测到钱包插件。"); // 没有钱包就抛出错误，阻止继续上链。
  return window.ethereum; // 返回钱包对象，后面交给 viem 使用。
} // 钱包检查函数结束。

export function isEvmAddress(value: string): boolean { // 定义检查字符串是否像 EVM 地址的函数。
  try { // 开始尝试格式化地址。
    getAddress(value); // getAddress 会校验地址格式，不合法会报错。
    return true; // 没报错说明地址格式可用。
  } catch { // 捕获地址格式错误。
    return false; // 报错说明不是合法 EVM 地址。
  } // 地址检查结束。
} // EVM 地址检查函数结束。

export function createSixDigitCheckInCode(): string { // 定义生成 6 位入住数字密码的函数。
  const code = Math.floor(100000 + Math.random() * 900000); // 生成 100000 到 999999 之间的随机整数。
  return String(code); // 转成字符串，方便二维码和签名使用。
} // 6 位密码生成函数结束。

export function createBookingHashes(orderId: string, guestHash: string, checkInCode: string): BookingHashes { // 定义生成订单哈希的函数。
  const offchainOrderHash = keccak256(toBytes(orderId)); // 把链外订单编号转成 bytes32 哈希。
  const checkInCodeHash = keccak256(toBytes(checkInCode)); // 把入住数字密码转成 bytes32 哈希。
  const chainBookingId = keccak256(encodePacked(["bytes32", "bytes32"], [offchainOrderHash, guestHash as Hex])); // 用订单哈希和资料哈希生成链上订单 ID。
  return { chainBookingId, offchainOrderHash, checkInCodeHash }; // 返回三个链上需要的哈希。
} // 订单哈希函数结束。

export function canUseRealPayment(hotelAddress: string, tokenSymbol: PaymentToken): boolean { // 定义判断能否真实上链支付的函数。
  return isEvmAddress(hotelAddress) && tokenSymbol === "MON"; // 酒店合约地址合法且币种是 MON 时才允许真实交易。
} // 真实支付判断函数结束。

export function getPaymentConfigIssue(hotelAddress: string, tokenSymbol: PaymentToken): string { // 定义读取支付配置缺失原因的函数。
  if (!isEvmAddress(hotelAddress)) return "缺少酒店合约地址：请让商家在商家后台创建酒店合约，然后重新进入酒店页面。"; // 酒店合约地址缺失时返回明确提示。
  if (tokenSymbol !== "MON") return "MVP 阶段只支持 MON 支付，请把房型收款币种改成 MON。"; // 币种不是 MON 时返回明确提示。
  return ""; // 配置完整时返回空字符串。
} // 支付配置缺失原因函数结束。

export async function createMerchantHotelContract(input: CreateHotelContractInput): Promise<Hex> { // 定义商家创建酒店合约的函数，返回新酒店合约地址。
  const provider = assertEthereumProvider(); // 检查并取得钱包对象。
  if (!isEvmAddress(HOTEL_FACTORY_ADDRESS)) throw new Error("酒店工厂合约地址未配置，不能创建酒店合约。"); // 工厂地址缺失就停止。
  const [account] = (await provider.request({ method: "eth_requestAccounts" })) as Address[]; // 请求商家钱包授权并读取地址。
  const walletClient = createWalletClient({ account, chain: monadTestnet, transport: custom(provider) }); // 创建钱包客户端，用来让商家签创建合约交易。
  const publicClient = createPublicClient({ chain: monadTestnet, transport: http(MONAD_TESTNET_RPC_URL) }); // 创建公共客户端，用来等待交易确认和读取链上数据。
  const beforeHotels = await publicClient.readContract({ address: getAddress(HOTEL_FACTORY_ADDRESS), abi: hotelFactoryAbi, functionName: "getOwnerHotels", args: [getAddress(account)] }); // 创建前先读取商家已有酒店列表。
  const txHash = await walletClient.writeContract({ account, address: getAddress(HOTEL_FACTORY_ADDRESS), abi: hotelFactoryAbi, functionName: "createHotel", args: [input.hotelName, []] }); // 调用工厂合约创建酒店合约，MON 支付版本不需要传代币地址。
  await publicClient.waitForTransactionReceipt({ hash: txHash }); // 等待创建酒店交易确认。
  const afterHotels = await publicClient.readContract({ address: getAddress(HOTEL_FACTORY_ADDRESS), abi: hotelFactoryAbi, functionName: "getOwnerHotels", args: [getAddress(account)] }); // 创建后重新读取商家酒店列表。
  const createdHotel = afterHotels.find((hotelAddress) => !beforeHotels.includes(hotelAddress)) ?? afterHotels[afterHotels.length - 1]; // 优先找新增地址，找不到就取最后一个地址。
  if (!createdHotel) throw new Error("创建交易已确认，但没有从工厂合约读取到酒店地址。"); // 如果链上列表仍然为空就报错。
  return createdHotel; // 返回新酒店合约地址。
} // 商家创建酒店合约函数结束。

export async function payHotelBooking(input: PayHotelBookingInput): Promise<Hex> { // 定义真实支付函数，返回支付交易哈希。
  const provider = assertEthereumProvider(); // 检查并取得钱包对象。
  if (!isEvmAddress(input.hotelAddress)) throw new Error("酒店合约地址未配置，不能真实上链支付。"); // 酒店地址缺失就停止。
  if (input.tokenSymbol !== "MON") throw new Error("MVP 阶段只支持 MON 支付。"); // 如果传入的不是 MON 就停止。
  const [account] = (await provider.request({ method: "eth_requestAccounts" })) as Address[]; // 请求用户授权并读取钱包地址。
  const walletClient = createWalletClient({ account, chain: monadTestnet, transport: custom(provider) }); // 创建钱包客户端，客户端可以理解为“帮网页叫钱包签交易的工具”。
  const publicClient = createPublicClient({ chain: monadTestnet, transport: http(MONAD_TESTNET_RPC_URL) }); // 创建公共客户端，用来等待交易确认。
  const hashes = createBookingHashes(input.orderId, input.guestHash, input.checkInCode); // 生成合约需要的订单哈希。
  const amountInWei = parseEther(String(input.amount)); // 把 0.1 MON 转成 wei，wei 是 MON 的最小单位。
  const paymentTxHash = await walletClient.writeContract({ account, address: getAddress(input.hotelAddress), abi: hotelAbi, functionName: "payBooking", args: [hashes.chainBookingId, hashes.offchainOrderHash, input.guestHash as Hex, hashes.checkInCodeHash, amountInWei], value: amountInWei }); // 调用酒店合约并随交易发送 MON。
  await publicClient.waitForTransactionReceipt({ hash: paymentTxHash }); // 等待支付交易确认，确认后前端再生成订单凭证。
  return paymentTxHash; // 返回支付交易哈希。
} // 真实支付函数结束。

export async function signCheckInMessage(input: SignCheckInInput): Promise<Hex> { // 定义用户到店签名函数。
  const provider = assertEthereumProvider(); // 检查并取得钱包对象。
  if (!isEvmAddress(input.hotelAddress)) throw new Error("酒店合约地址未配置，不能生成真实入住签名。"); // 酒店地址缺失就停止。
  const [account] = (await provider.request({ method: "eth_requestAccounts" })) as Address[]; // 请求用户授权并读取钱包地址。
  const walletClient = createWalletClient({ account, chain: monadTestnet, transport: custom(provider) }); // 创建钱包客户端。
  const checkInCodeHash = keccak256(toBytes(input.checkInCode)); // 重新计算入住数字密码哈希。
  const messageHash = keccak256(encodePacked(["address", "bytes32", "bytes32", "bytes32"], [getAddress(input.hotelAddress), input.chainBookingId as Hex, input.guestHash as Hex, checkInCodeHash])); // 生成与合约一致的签名消息哈希。
  const signature = await walletClient.signMessage({ account, message: { raw: messageHash } }); // 让用户钱包签名，钱包会自动加标准签名前缀。
  return signature; // 返回用户签名。
} // 用户到店签名函数结束。

export async function verifyCheckInSignature(input: VerifyCheckInSignatureInput): Promise<boolean> { // 定义验证到店签名确实来自下单钱包的函数。
  if (!isEvmAddress(input.hotelAddress)) return false; // 酒店合约地址不合法时直接返回失败。
  if (!isEvmAddress(input.expectedWalletAddress)) return false; // 订单钱包地址不合法时直接返回失败。
  const checkInCodeHash = keccak256(toBytes(input.checkInCode)); // 重新计算入住数字密码哈希。
  const messageHash = keccak256(encodePacked(["address", "bytes32", "bytes32", "bytes32"], [getAddress(input.hotelAddress), input.chainBookingId as Hex, input.guestHash as Hex, checkInCodeHash])); // 生成与签名时完全一致的消息哈希。
  return verifyMessage({ address: getAddress(input.expectedWalletAddress), message: { raw: messageHash }, signature: input.signature as Hex }); // 用 viem 验证签名者是否等于订单钱包。
} // 验证到店签名函数结束。

export async function submitHotelCheckIn(input: SubmitCheckInInput): Promise<Hex> { // 定义商家提交入住核验到合约的函数。
  const provider = assertEthereumProvider(); // 检查并取得钱包对象。
  if (!isEvmAddress(input.hotelAddress)) throw new Error("酒店合约地址未配置，不能提交入住核验。"); // 酒店地址缺失就停止。
  const [account] = (await provider.request({ method: "eth_requestAccounts" })) as Address[]; // 请求商家钱包授权并读取地址。
  const walletClient = createWalletClient({ account, chain: monadTestnet, transport: custom(provider) }); // 创建钱包客户端。
  const publicClient = createPublicClient({ chain: monadTestnet, transport: http(MONAD_TESTNET_RPC_URL) }); // 创建公共客户端，用来等待交易确认。
  const txHash = await walletClient.writeContract({ account, address: getAddress(input.hotelAddress), abi: hotelAbi, functionName: "checkIn", args: [input.chainBookingId as Hex, input.checkInCode, input.signature as Hex] }); // 调用酒店合约 checkIn，提交数字密码和用户签名。
  await publicClient.waitForTransactionReceipt({ hash: txHash }); // 等待入住核验交易确认。
  return txHash; // 返回入住核验交易哈希。
} // 商家提交入住核验函数结束。
