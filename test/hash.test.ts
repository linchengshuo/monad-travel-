import { describe, expect, it } from "vitest"; // 引入 Vitest 测试工具，Vitest 可以理解为前端代码的考试工具。
import { createGuestHash } from "../src/lib/hash"; // 引入生成用户资料哈希的函数。

describe("createGuestHash", () => { // 定义用户资料哈希测试组。
  it("为相同资料生成相同哈希", async () => { // 测试相同资料是否得到相同哈希。
    const firstHash = await createGuestHash({ fullName: "张三", phone: "13800000000", identityNumber: "ID001" }); // 第一次生成哈希。
    const secondHash = await createGuestHash({ fullName: " 张三 ", phone: "13800000000 ", identityNumber: " ID001" }); // 第二次生成哈希，并故意加空格。
    expect(firstHash).toBe(secondHash); // 检查两次哈希必须相同。
    expect(firstHash.startsWith("0x")).toBe(true); // 检查哈希必须带 0x 前缀。
  }); // 第一个测试结束。

  it("不会把用户明文资料放进哈希结果", async () => { // 测试哈希结果不能包含明文资料。
    const hash = await createGuestHash({ fullName: "李四", phone: "13900000000", identityNumber: "ID002" }); // 生成哈希。
    expect(hash.includes("李四")).toBe(false); // 检查哈希里不能出现姓名。
    expect(hash.includes("13900000000")).toBe(false); // 检查哈希里不能出现电话。
    expect(hash.includes("ID002")).toBe(false); // 检查哈希里不能出现证件号。
  }); // 第二个测试结束。
}); // 测试组结束。
