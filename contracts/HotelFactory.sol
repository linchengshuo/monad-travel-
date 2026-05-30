// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24; // 指定 Solidity 编译器版本。

import "./Hotel.sol"; // 引入酒店合约，让工厂可以创建酒店。

contract HotelFactory { // 定义酒店工厂合约，工厂可以理解为专门创建酒店合约的机器。
    address[] public hotels; // 保存所有已经创建的酒店合约地址。
    mapping(address => address[]) public ownerHotels; // 保存每个商家创建过哪些酒店。

    event HotelCreated(address indexed owner, address indexed hotel, string hotelName); // 酒店创建成功时发出日志。

    function createHotel(string calldata hotelName, address[] calldata acceptedTokens) external returns (address) { // 创建新酒店合约。
        Hotel hotel = new Hotel(msg.sender, hotelName, acceptedTokens); // 部署一个新的酒店合约，商家是当前调用者。
        address hotelAddress = address(hotel); // 把酒店合约转换成普通地址。
        hotels.push(hotelAddress); // 把酒店地址加入总列表。
        ownerHotels[msg.sender].push(hotelAddress); // 把酒店地址加入商家的列表。
        emit HotelCreated(msg.sender, hotelAddress, hotelName); // 发出酒店创建日志。
        return hotelAddress; // 返回新酒店合约地址。
    } // 创建酒店函数结束。

    function getHotels() external view returns (address[] memory) { // 查询所有酒店地址。
        return hotels; // 返回酒店地址数组。
    } // 查询所有酒店函数结束。

    function getOwnerHotels(address owner) external view returns (address[] memory) { // 查询某个商家的酒店地址。
        return ownerHotels[owner]; // 返回这个商家的酒店地址数组。
    } // 查询商家酒店函数结束。
} // 酒店工厂合约结束。
