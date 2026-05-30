import { describe, expect, it } from "vitest"; // 引入 Vitest 测试工具。
import { createQrPayload } from "../src/lib/qr"; // 引入生成二维码内容的函数。
import type { BookingRecord } from "../src/types/booking"; // 引入订单类型。

describe("createQrPayload", () => { // 定义二维码内容测试组。
  it("二维码只包含验证所需字段", () => { // 测试二维码字段是否精简。
    const booking: BookingRecord = { // 创建一笔演示订单。
      id: "offchain-1", // 设置链外订单编号。
      hotelId: "hotel-1", // 设置酒店编号。
      roomTypeId: "room-1", // 设置房型编号。
      walletAddress: "0x0000000000000000000000000000000000000001", // 设置用户钱包地址。
      guestHash: "0xabc", // 设置用户资料哈希。
      status: "paid", // 设置订单状态。
      qrPayload: "", // 二维码字段先留空。
      paymentToken: "MON", // 设置支付币种。
      paymentAmount: 88, // 设置支付金额。
      chainBookingId: "0xchain", // 设置链上订单编号。
      offchainOrderHash: "0xoffchain", // 设置链外订单哈希。
      checkInCode: "123456", // 设置入住数字密码。
      checkInCodeHash: "0xcode", // 设置入住数字密码哈希。
      hotelContractAddress: "0x0000000000000000000000000000000000000002", // 设置酒店合约地址。
      createdAt: "2026-05-29T00:00:00.000Z", // 设置订单创建时间。
      source: "local-preview", // 设置订单来源为本地预览。
    }; // 演示订单结束。
    const payload = JSON.parse(createQrPayload(booking)); // 生成二维码内容并转回对象。
    expect(payload.orderId).toBe("offchain-1"); // 检查订单编号存在。
    expect(payload.guestHash).toBe("0xabc"); // 检查资料哈希存在。
    expect(payload.roomTypeId).toBe("room-1"); // 检查二维码包含房型编号，方便商家识别订单房型。
    expect(payload.checkInCode).toBe("123456"); // 检查二维码包含到店核验数字密码。
    expect(payload.fullName).toBeUndefined(); // 检查二维码不包含姓名明文。
    expect(payload.phone).toBeUndefined(); // 检查二维码不包含电话明文。
    expect(payload.identityNumber).toBeUndefined(); // 检查二维码不包含证件号明文。
  }); // 测试结束。
}); // 测试组结束。
