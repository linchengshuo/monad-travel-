// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24; // 指定 Solidity 编译器版本。

contract MockERC20 { // 定义测试用 ERC20 代币合约，真实项目不会部署这个当正式支付币。
    string public name = "Mock USD"; // 设置测试代币名称。
    string public symbol = "mUSD"; // 设置测试代币符号。
    uint8 public decimals = 6; // 设置测试代币小数位，USDT/USDC 常见是 6 位。
    mapping(address => uint256) public balanceOf; // 保存每个地址的余额。
    mapping(address => mapping(address => uint256)) public allowance; // 保存授权额度。

    function mint(address to, uint256 amount) external { // 铸造测试代币。
        balanceOf[to] += amount; // 给目标地址增加余额。
    } // 铸造函数结束。

    function approve(address spender, uint256 amount) external returns (bool) { // 授权别人使用自己的代币。
        allowance[msg.sender][spender] = amount; // 记录授权额度。
        return true; // 返回授权成功。
    } // 授权函数结束。

    function transferFrom(address from, address to, uint256 amount) external returns (bool) { // 从一个地址转账到另一个地址。
        require(balanceOf[from] >= amount, "BALANCE_LOW"); // 检查付款人余额足够。
        require(allowance[from][msg.sender] >= amount, "ALLOWANCE_LOW"); // 检查调用者授权额度足够。
        allowance[from][msg.sender] -= amount; // 扣减授权额度。
        balanceOf[from] -= amount; // 扣减付款人余额。
        balanceOf[to] += amount; // 增加收款人余额。
        return true; // 返回转账成功。
    } // 转账函数结束。
} // 测试代币合约结束。
