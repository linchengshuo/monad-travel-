# Monad 酒店 DApp MVP

这是一个面向 Monad 测试网的酒店入驻与预订 DApp 原型。

## 当前设计

- 酒店主体是链上合约。
- 房型、图片、价格、库存、有效期是链外数据。
- 用户资料不明文上链。
- 链上只保存用户资料哈希。
- 支付测试只允许 Monad 测试网。

## 新手解释

- DApp：运行在区块链相关环境里的网页应用。
- 智能合约：部署到链上的程序，负责保存规则和处理交易。
- 链上：写进区块链，通常公开、难删除、成本更高。
- 链外：普通服务器或本地数据，适合图片、库存、后台管理。
- 哈希：资料的指纹，不能直接还原姓名、电话、证件号。
- RPC：网页和区块链沟通的入口地址。

## 环境变量

复制 `.env.example` 为 `.env`，然后只在本机填写真实值。

不要把 `.env` 上传到 Git。

## 常用命令

```bash
npm install
npm run dev
npm run test
npm run compile:contracts
npm run deploy:monad-testnet
```

## 如果 PowerShell 显示中文乱码

源码文件本身使用 UTF-8 编码。如果你在 PowerShell 里看到中文变成乱码，通常是终端显示编码问题。

推荐用这个命令启动开发服务器：

```powershell
.\scripts\dev-utf8.ps1
```

这个脚本会先把 PowerShell 切到 UTF-8，再启动 Vite。

## Monskills

官方安装命令：

```bash
npx skills add therealharpaljadeja/monskills
```

当前沙盒里这一步因为网络/权限被拦截，后续需要你允许联网下载后继续。

## 商家审核数据库

数据库方案使用 Supabase。设置方式见：

```text
docs/supabase-setup.md
```

审核入口：

```text
/audit
```
