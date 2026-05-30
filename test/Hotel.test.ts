import hre from "hardhat"; // 引入 Hardhat 运行环境，用来部署和测试合约。
import assert from "node:assert/strict"; // 引入 Node.js 自带断言工具，断言可以理解为测试里的“必须满足”。
import { describe, it } from "node:test"; // 引入 Node.js 自带测试函数，describe 是测试组，it 是单个测试。
import { encodePacked, keccak256, toBytes } from "viem"; // 引入哈希和编码工具，用来生成与合约一致的签名消息。

describe("Hotel", function () { // 定义酒店合约测试组。
  it("创建酒店并记录订单支付凭证", async function () { // 测试酒店创建和订单支付。
    const connection = await hre.network.getOrCreate(); // 连接 Hardhat 本地测试网络，使用新版推荐写法。
    const [owner, guest] = await connection.viem.getWalletClients(); // 获取两个测试钱包，第一个当商家，第二个当用户。
    const factory = await connection.viem.deployContract("HotelFactory"); // 部署酒店工厂合约。
    const publicClient = await connection.viem.getPublicClient(); // 获取公共客户端，用来等待交易完成。
    const hash = await factory.write.createHotel(["测试酒店", []], { account: owner.account }); // 商家创建酒店，MON 支付版本不需要传代币地址。
    const receipt = await publicClient.waitForTransactionReceipt({ hash }); // 等待创建酒店交易完成。
    const createdEvent = receipt.logs[0]; // 读取第一条日志，MVP 测试里用于确认交易有日志。
    assert.notEqual(createdEvent, undefined); // 检查日志存在。
    const hotels = await factory.read.getOwnerHotels([owner.account.address]); // 查询商家创建的酒店。
    assert.equal(hotels.length, 1); // 检查酒店数量为 1。
    const hotel = await connection.viem.getContractAt("Hotel", hotels[0]); // 根据地址拿到酒店合约对象。
    const bookingId = "0x1111111111111111111111111111111111111111111111111111111111111111"; // 准备订单编号哈希。
    const offchainOrderId = "0x2222222222222222222222222222222222222222222222222222222222222222"; // 准备链外订单编号哈希。
    const guestHash = "0x3333333333333333333333333333333333333333333333333333333333333333"; // 准备用户资料哈希。
    const checkInCode = "123456"; // 准备用户到店时输入或扫码得到的数字密码。
    const checkInCodeHash = keccak256(toBytes(checkInCode)); // 把数字密码转成链上保存的哈希。
    const ownerBalanceBefore = await publicClient.getBalance({ address: owner.account.address }); // 读取支付前商家钱包 MON 余额。
    await hotel.write.payBooking([bookingId, offchainOrderId, guestHash, checkInCodeHash, 500n], { account: guest.account, value: 500n }); // 用户用 MON 支付订单。
    const ownerBalanceAfter = await publicClient.getBalance({ address: owner.account.address }); // 读取支付后商家钱包 MON 余额。
    assert.equal(ownerBalanceAfter - ownerBalanceBefore, 500n); // 检查用户支付的 MON 已经转进商家钱包。
    const booking = await hotel.read.bookings([bookingId]); // 读取链上订单。
    assert.equal(booking[0].toLowerCase(), guest.account.address.toLowerCase()); // 检查订单用户地址正确，booking[0] 是 guest 字段。
    assert.equal(booking[2], 500n); // 检查支付金额正确，booking[2] 是 amount 字段。
    assert.equal(booking[3], guestHash); // 检查资料哈希正确，booking[3] 是 guestHash 字段。
    assert.equal(booking[5], checkInCodeHash); // 检查入住密码哈希正确，booking[5] 是 checkInCodeHash 字段。
    const messageHash = keccak256(encodePacked(["address", "bytes32", "bytes32", "bytes32"], [hotel.address, bookingId, guestHash, checkInCodeHash])); // 生成与合约 checkIn 函数一致的签名消息。
    const signature = await guest.signMessage({ message: { raw: messageHash } }); // 让用户钱包签名入住消息。
    await hotel.write.checkIn([bookingId, checkInCode, signature], { account: owner.account }); // 商家提交数字密码和用户签名，完成入住。
    const checkedInBooking = await hotel.read.bookings([bookingId]); // 再次读取链上订单。
    assert.equal(checkedInBooking[6], 2); // 检查订单状态已经变成 CheckedIn，枚举里 CheckedIn 的数字是 2。
  }); // 测试结束。
}); // 测试组结束。
