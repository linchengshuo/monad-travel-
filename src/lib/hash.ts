import type { GuestDraft } from "../types/booking"; // 引入用户资料类型，方便检查输入字段。

const encoder = new TextEncoder(); // 创建文本编码器，用来把文字变成浏览器能哈希的字节。

export async function createGuestHash(guest: GuestDraft): Promise<string> { // 定义生成用户资料哈希的函数。
  const normalizedGuest = { // 创建标准化后的用户资料，避免空格造成不同哈希。
    fullName: guest.fullName.trim(), // 去掉姓名前后的空格。
    phone: guest.phone.trim(), // 去掉电话前后的空格。
    identityNumber: guest.identityNumber.trim(), // 去掉证件号前后的空格。
  }; // 标准化资料结束。
  const guestJson = JSON.stringify(normalizedGuest); // 把资料变成稳定的 JSON 字符串。
  const guestBytes = encoder.encode(guestJson); // 把字符串变成字节。
  const digest = await crypto.subtle.digest("SHA-256", guestBytes); // 用浏览器内置能力计算 SHA-256 哈希。
  const hashArray = Array.from(new Uint8Array(digest)); // 把哈希结果变成数字数组。
  const hashHex = hashArray.map((byte) => byte.toString(16).padStart(2, "0")).join(""); // 把数字数组变成十六进制字符串。
  return `0x${hashHex}`; // 返回带 0x 前缀的哈希，方便和链上格式保持一致。
} // 生成哈希函数结束。
