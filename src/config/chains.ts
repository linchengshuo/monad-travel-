export const MONAD_TESTNET_CHAIN_ID = 10143; // 定义 Monad 测试网的链 ID，链 ID 可以理解为区分不同区块链网络的编号。

export const MONAD_TESTNET_RPC_URL = import.meta.env.VITE_MONAD_TESTNET_RPC_URL ?? "https://testnet-rpc.monad.xyz"; // 从环境变量读取 RPC 地址，RPC 可以理解为网页和区块链沟通的入口。

export const HOTEL_FACTORY_ADDRESS = import.meta.env.VITE_HOTEL_FACTORY_ADDRESS ?? ""; // 从环境变量读取酒店工厂合约地址，部署前这里可以为空。

export const isMonadTestnet = (chainId: number) => chainId === MONAD_TESTNET_CHAIN_ID; // 判断当前钱包网络是不是 Monad 测试网。
