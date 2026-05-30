import hardhatToolboxViem from "@nomicfoundation/hardhat-toolbox-viem"; /* 引入 Hardhat 的 Viem 工具箱。*/
import { defineConfig } from "hardhat/config"; /* 引入 Hardhat 3 的配置函数。*/

const privateKey = process.env.PRIVATE_KEY?.trim(); /* 从环境变量读取私钥并去掉首尾空格，代码里不写真正私钥。*/

const privateKeyPattern = /^0x[0-9a-fA-F]{64}$/; /* 定义私钥格式规则：0x 开头，后面 64 个十六进制字符。*/

const isValidPrivateKey = privateKeyPattern.test(privateKey ?? ""); /* 检查当前私钥是否符合 Hardhat 要求。*/

if (privateKey && !isValidPrivateKey) { /* 如果填了 PRIVATE_KEY 但格式不合法，就提前给出中文错误。*/
  throw new Error("PRIVATE_KEY 格式不对：必须是 0x 开头，加 64 个十六进制字符；不要填示例文字，也不要带空格或中文。"); /* 抛出明确错误，避免 Hardhat 给难懂提示。*/
} /* 私钥格式检查结束。*/

const monadTestnetRpcUrl = process.env.MONAD_TESTNET_RPC_URL ?? "https://testnet-rpc.monad.xyz"; /* 读取 Monad 测试网 RPC 地址。*/

const accounts = isValidPrivateKey && privateKey ? [privateKey] : []; /* 只有合法测试网私钥才用于部署，没有也不影响本地编译。*/

const config = defineConfig({ /* 创建 Hardhat 3 配置对象。*/
  plugins: [hardhatToolboxViem], /* 启用 Viem 工具箱插件。*/
  solidity: "0.8.24", /* 指定 Solidity 合约编译版本。*/
  networks: { /* 定义项目可以连接的区块链网络。*/
    hardhat: { /* 定义本地临时测试网络。*/
      type: "edr-simulated", /* 告诉 Hardhat 这是本地模拟网络。*/
      chainType: "l1", /* 告诉 Hardhat 这是普通 EVM L1 网络。*/
      chainId: 31337, /* 设置本地网络链 ID。*/
    }, /* 本地测试网络配置结束。*/
    monadTestnet: { /* 定义 Monad 测试网。*/
      type: "http", /* 告诉 Hardhat 这是通过 RPC 连接的网络。*/
      chainType: "l1", /* 告诉 Hardhat 这是普通 EVM L1 网络。*/
      url: monadTestnetRpcUrl, /* 使用 Monad 测试网 RPC 地址。*/
      chainId: 10143, /* 强制指定 Monad 测试网链 ID，防止误连主网。*/
      accounts, /* 使用环境变量里的测试网私钥。*/
    }, /* Monad 测试网配置结束。*/
  }, /* 网络配置结束。*/
}); /* Hardhat 配置对象结束。*/

export default config; /* 导出配置，让 Hardhat 命令可以读取。*/
