// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24; // 指定 Solidity 编译器版本，Solidity 是写智能合约的语言。

contract Hotel { // 定义酒店合约，每个酒店部署一个自己的合约。
    enum BookingStatus { None, Paid, CheckedIn, Refunded } // 定义订单状态，None 是不存在，Paid 是已支付，CheckedIn 是已入住，Refunded 是已退款。

    struct Booking { // 定义链上订单结构，结构可以理解为一组固定字段。
        address guest; // 保存用户钱包地址。
        address token; // 保存用户支付的资产地址；MVP 使用 MON 原生币，所以这里固定为 address(0)。
        uint256 amount; // 保存用户支付的数量。
        bytes32 guestHash; // 保存用户资料哈希，不保存姓名电话身份证明文。
        bytes32 offchainOrderId; // 保存链外订单编号的哈希，避免链上暴露业务编号。
        bytes32 checkInCodeHash; // 保存入住密码哈希，链上不保存明文密码。
        BookingStatus status; // 保存订单当前状态。
    } // 订单结构结束。

    address public immutable owner; // 保存酒店商家的钱包地址，immutable 表示部署后不能改。
    string public hotelName; // 保存酒店名称，酒店主体信息保留在链上。
    mapping(bytes32 => Booking) public bookings; // 用订单编号哈希查订单。

    event BookingPaid(bytes32 indexed bookingId, address indexed guest, uint256 amount, bytes32 guestHash, bytes32 checkInCodeHash); // 当用户用 MON 支付订单时发出事件。
    event BookingCheckedIn(bytes32 indexed bookingId, address indexed guest); // 当订单完成入住验证时发出事件。

    modifier onlyOwner() { // 定义只有酒店商家能调用的权限检查。
        require(msg.sender == owner, "ONLY_OWNER"); // 如果调用者不是商家钱包，就终止交易。
        _; // 继续执行被修饰的函数。
    } // 权限检查结束。

    constructor(address owner_, string memory hotelName_, address[] memory) { // 部署酒店合约时运行的初始化函数；第三个参数保留是为了让工厂函数结构稳定。
        owner = owner_; // 记录酒店商家钱包地址。
        hotelName = hotelName_; // 记录酒店名称。
    } // 初始化函数结束。

    function payBooking(bytes32 bookingId, bytes32 offchainOrderId, bytes32 guestHash, bytes32 checkInCodeHash, uint256 amount) external payable { // 用户用 MON 支付订单并创建链上凭证。
        require(amount > 0, "AMOUNT_ZERO"); // 检查声明的支付金额必须大于 0。
        require(msg.value == amount, "BAD_MON_VALUE"); // 检查用户真实发送的 MON 数量必须等于订单金额。
        require(guestHash != bytes32(0), "GUEST_HASH_ZERO"); // 检查用户资料哈希不能为空。
        require(checkInCodeHash != bytes32(0), "CHECK_IN_CODE_HASH_ZERO"); // 检查入住密码哈希不能为空。
        require(bookings[bookingId].status == BookingStatus.None, "BOOKING_EXISTS"); // 检查订单不能重复创建。
        (bool transferred, ) = owner.call{value: msg.value}(""); // 把用户发送的 MON 直接转给酒店商家钱包。
        require(transferred, "MON_TRANSFER_FAILED"); // 如果 MON 转账失败，就终止交易。
        bookings[bookingId] = Booking({ // 创建订单并写入链上。
            guest: msg.sender, // 保存付款用户钱包地址。
            token: address(0), // 保存 address(0)，表示这笔订单使用 MON 原生币支付。
            amount: amount, // 保存付款数量。
            guestHash: guestHash, // 保存用户资料哈希。
            offchainOrderId: offchainOrderId, // 保存链外订单编号哈希。
            checkInCodeHash: checkInCodeHash, // 保存入住密码哈希。
            status: BookingStatus.Paid // 把订单状态设置为已支付。
        }); // 订单写入结束。
        emit BookingPaid(bookingId, msg.sender, amount, guestHash, checkInCodeHash); // 发出支付成功日志。
    } // 支付订单函数结束。

    function checkIn(bytes32 bookingId, string calldata checkInCode, bytes calldata signature) external onlyOwner { // 商家验证用户签名并办理入住。
        Booking storage booking = bookings[bookingId]; // 从链上读取订单。
        require(booking.status == BookingStatus.Paid, "BOOKING_NOT_PAID"); // 检查订单必须已经支付。
        bytes32 suppliedCodeHash = keccak256(bytes(checkInCode)); // 把商家提供的明文数字密码转成哈希。
        require(suppliedCodeHash == booking.checkInCodeHash, "BAD_CHECK_IN_CODE"); // 检查数字密码是否匹配链上保存的密码哈希。
        bytes32 messageHash = keccak256(abi.encodePacked(address(this), bookingId, booking.guestHash, suppliedCodeHash)); // 生成用户需要签名的消息哈希。
        address signer = recoverSigner(toEthSignedMessageHash(messageHash), signature); // 从签名里恢复签名者钱包地址。
        require(signer == booking.guest, "INVALID_GUEST_SIGNATURE"); // 检查签名者必须是订单用户。
        booking.status = BookingStatus.CheckedIn; // 把订单状态改为已入住。
        emit BookingCheckedIn(bookingId, booking.guest); // 发出入住成功日志。
    } // 入住函数结束。

    function toEthSignedMessageHash(bytes32 messageHash) public pure returns (bytes32) { // 把普通哈希转换成钱包签名常用格式。
        return keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", messageHash)); // 返回钱包签名标准哈希。
    } // 钱包签名哈希函数结束。

    function recoverSigner(bytes32 ethSignedMessageHash, bytes memory signature) public pure returns (address) { // 从签名里恢复钱包地址。
        require(signature.length == 65, "BAD_SIGNATURE_LENGTH"); // 检查签名长度必须是 65 字节。
        bytes32 r; // 声明签名的 r 部分。
        bytes32 s; // 声明签名的 s 部分。
        uint8 v; // 声明签名的 v 部分。
        assembly { // 使用底层代码拆分签名，Solidity 里处理签名常见做法。
            r := mload(add(signature, 32)) // 读取签名前 32 字节。
            s := mload(add(signature, 64)) // 读取签名中间 32 字节。
            v := byte(0, mload(add(signature, 96))) // 读取签名最后 1 字节。
        } // 底层拆分结束。
        return ecrecover(ethSignedMessageHash, v, r, s); // 根据签名还原签名者地址。
    } // 恢复签名者函数结束。
} // 酒店合约结束。
