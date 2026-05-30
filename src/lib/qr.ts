import type { BookingRecord } from "../types/booking"; // 引入订单类型，保证二维码内容来自订单字段。

export function createQrPayload(booking: BookingRecord): string { // 定义生成二维码内容的函数。
  const payload = { // 创建二维码里真正需要的验证数据。
    orderId: booking.id, // 放入链外订单编号，商家用它找到订单。
    hotelId: booking.hotelId, // 放入酒店编号，避免扫到别的酒店订单。
    roomTypeId: booking.roomTypeId, // 放入房型编号，方便商家知道用户订了哪种房。
    chainBookingId: booking.chainBookingId, // 放入链上订单 ID，方便商家核验合约订单。
    guestHash: booking.guestHash, // 放入用户资料哈希，不放姓名、电话、证件号明文。
    walletAddress: booking.walletAddress, // 放入用户钱包地址，到店签名时用来比对签名者。
    hotelContractAddress: booking.hotelContractAddress, // 放入酒店合约地址，避免商家扫错合约。
    checkInCode: booking.checkInCode, // 放入数字密码，用户也可以到店直接提供这串数字。
  }; // 二维码数据对象结束。
  return JSON.stringify(payload); // 把对象转成字符串，真实版本会再渲染成二维码图片。
} // 生成二维码内容函数结束。
