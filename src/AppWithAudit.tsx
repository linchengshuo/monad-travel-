import { ArrowLeft, BedDouble, Building2, CheckCircle2, FileUp, Hotel, ImagePlus, KeyRound, LayoutDashboard, ShieldCheck, Store, Upload, Wallet } from "lucide-react"; // 引入页面会用到的图标，图标能让按钮更容易被识别。
import QRCode from "qrcode"; // 引入本地二维码生成库，订单内容不会发送到外部网站。
import { Trash2 } from "lucide-react"; // 单独引入删除图标，给商家下架房型按钮使用。
import { useEffect, useMemo, useState } from "react"; // 引入 React 的状态工具，状态可以理解为页面当前记住的数据。
import { MONAD_TESTNET_CHAIN_ID, isMonadTestnet } from "./config/chains"; // 引入 Monad 测试网配置，用来防止误连主网。
import { hotels, rooms, type HotelCardData, type RoomDetailData } from "./data/hotelData"; // 引入本地酒店和演示房型，Supabase 未配置时用它们兜底。
import { createGuestHash } from "./lib/hash"; // 引入资料哈希函数，哈希可以理解为资料指纹。
import { canUseRealPayment, createBookingHashes, createMerchantHotelContract, createSixDigitCheckInCode, getPaymentConfigIssue, payHotelBooking, signCheckInMessage, submitHotelCheckIn, verifyCheckInSignature } from "./lib/hotelContractClient"; // 引入酒店合约工具，负责订单哈希、支付和入住签名。
import { fetchBookingOrdersByHotel, fetchBookingOrdersByWallet, upsertBookingOrder } from "./lib/bookingOrdersRest"; // 引入订单数据库读写函数。
import { fetchApprovedMerchantByWallet, fetchMerchantApplications, signInReviewer, signOutReviewer, submitMerchantApplication, updateMerchantApplicationStatus, updateMerchantHotelContractAddress } from "./lib/merchantApplicationsRest"; // 引入商家入驻和审核相关数据库函数。
import { createQrPayload } from "./lib/qr"; // 引入二维码内容生成函数。
import { archiveRoomType, createRoomType, fetchActiveRoomTypes, fetchMerchantRoomTypes, increaseBookedInventory } from "./lib/roomTypesRest"; // 引入房型读写数据库函数。
import { isRoomImageStorageUrl, uploadRoomImage } from "./lib/storageRest"; // 引入 Supabase Storage 图片上传函数和图片来源判断函数。
import { isSupabaseConfigured } from "./lib/supabaseRestClient"; // 引入 Supabase 是否已配置的判断。
import type { BookingRecord, GuestDraft } from "./types/booking"; // 引入订单和用户资料类型。
import type { MerchantApplicationInput, MerchantApplicationRecord } from "./types/merchant"; // 引入商家申请类型。
import type { RoomFormState, RoomTypeInput } from "./types/room"; // 引入商家后台房型表单和数据库输入类型。
import { roomRecordToDetail } from "./types/room"; // 引入数据库房型转页面房型的函数。

type ViewName = "entry" | "hotels" | "hotel" | "room" | "userOrders" | "merchantOnboarding" | "merchantPending" | "merchantDashboard" | "audit"; // 定义所有页面名称，避免跳转时写错字符串。
type VisibleRoomData = RoomDetailData & { hotelName?: string; hotelContractAddress?: string }; // 定义用户侧真实房型类型，比普通房型多商家酒店名称和酒店合约地址。

function mapStorageRoomRecords(records: Parameters<typeof roomRecordToDetail>[0][]) { // 定义把数据库房型转成页面房型的函数，并过滤掉旧的占位图片。
  return records.filter((record) => isRoomImageStorageUrl(record.image_url)).map((record) => ({ ...roomRecordToDetail(record), hotelName: record.merchant_name || "已入驻酒店", hotelContractAddress: record.hotel_contract_address })); // 只保留图片来自 Supabase Storage 的房型，并带上商家酒店合约地址。
} // 数据库房型转换函数结束。

const emptyGuest: GuestDraft = { fullName: "", phone: "", identityNumber: "" }; // 定义空用户资料，用户订房前会填写它。

const emptyMerchantForm = { companyName: "", licenseId: "", contactName: "", contactPhone: "", qualification: "", documentUrl: "" }; // 定义空商家入驻表单。

const emptyRoomForm: RoomFormState = { // 定义空房型表单，商家后台新增房型时使用。
  name: "", // 房型名称初始为空。
  description: "", // 房型详情初始为空。
  imageUrl: "", // 图片链接初始为空。
  price: 0.01, // 默认价格给 0.01 MON，方便 MVP 小额测试。
  currency: "MON", // 默认使用 MON。
  validUntil: "2026-12-31", // 默认有效期给到 2026 年底。
  totalInventory: 10, // 默认库存给 10 间。
  area: "", // 面积初始为空。
  bed: "", // 床型初始为空。
  breakfast: "", // 早餐信息初始为空。
  cancellation: "", // 取消规则初始为空。
}; // 空房型表单定义结束。

function shortAddress(address: string) { // 定义缩短钱包地址的函数。
  if (!address) return "连接钱包"; // 如果没有地址，就显示连接钱包。
  return `${address.slice(0, 6)}...${address.slice(-4)}`; // 只显示开头和结尾，避免页面太挤。
} // 缩短地址函数结束。

function getInitialView(): ViewName { // 定义读取初始页面的函数。
  return window.location.pathname.startsWith("/audit") ? "audit" : "entry"; // 如果网址是 /audit，就进入审核页，否则进入身份选择页。
} // 初始页面函数结束。

function getMerchantHotelId(application: MerchantApplicationRecord | null) { // 定义商家当前管理哪家酒店的函数。
  return application?.id ?? hotels[0].id; // 配置 Supabase 后用商家申请编号作为酒店编号，避免所有商家挤到同一个占位酒店。
} // 商家酒店编号函数结束。

function getWalletOrderStorageKey(address: string) { // 定义按钱包生成订单本地存储键名的函数。
  return `monad_hotel_orders_${address.toLowerCase()}`; // 使用小写钱包地址隔离不同用户订单。
} // 订单本地存储键名函数结束。

function loadOrdersForWallet(address: string): BookingRecord[] { // 定义从浏览器本地存储读取某个钱包订单的函数。
  if (!address) return []; // 没有钱包地址时返回空数组。
  try { // 尝试读取和解析本地订单。
    const raw = localStorage.getItem(getWalletOrderStorageKey(address)); // 从 localStorage 读取订单字符串。
    return raw ? JSON.parse(raw) as BookingRecord[] : []; // 有内容就转成订单数组，没有就返回空数组。
  } catch { // 捕获本地数据损坏或 JSON 解析失败。
    return []; // 解析失败时返回空数组，避免页面崩溃。
  } // 读取结束。
} // 读取钱包订单函数结束。

function saveOrdersForWallet(address: string, nextOrders: BookingRecord[]) { // 定义把某个钱包订单保存到浏览器本地存储的函数。
  if (!address) return; // 没有钱包地址时不保存。
  localStorage.setItem(getWalletOrderStorageKey(address), JSON.stringify(nextOrders)); // 把订单数组转成字符串后保存。
} // 保存钱包订单函数结束。

export default function AppWithAudit() { // 定义整个应用的主组件。
  const [view, setView] = useState<ViewName>(getInitialView); // 保存当前页面名称。
  const [walletAddress, setWalletAddress] = useState(""); // 保存当前连接的钱包地址。
  const [chainId, setChainId] = useState<number | null>(null); // 保存当前钱包网络链 ID。
  const [approvedMerchant, setApprovedMerchant] = useState<MerchantApplicationRecord | null>(null); // 保存已审核通过的商家资料。
  const [pendingMerchant, setPendingMerchant] = useState<MerchantApplicationRecord | null>(null); // 保存刚提交但未审核的商家资料。
  const [selectedHotelId, setSelectedHotelId] = useState(hotels[0].id); // 保存当前选中的酒店编号。
  const [selectedRoomId, setSelectedRoomId] = useState(rooms[0].id); // 保存当前选中的房型编号。
  const [guest, setGuest] = useState<GuestDraft>(emptyGuest); // 保存用户填写的入住资料。
  const [orders, setOrders] = useState<BookingRecord[]>([]); // 保存本地演示订单。
  const [notice, setNotice] = useState("请选择身份：用户看酒店和房型，商家连接钱包后进入入驻或管理后台。"); // 保存页面提示信息。
  const [merchantForm, setMerchantForm] = useState(emptyMerchantForm); // 保存商家入驻表单。
  const [roomForm, setRoomForm] = useState<RoomFormState>(emptyRoomForm); // 保存商家后台新增房型表单。
  const [publicRooms, setPublicRooms] = useState<VisibleRoomData[]>(isSupabaseConfigured ? [] : rooms); // 保存用户页面看到的房型；配置了 Supabase 后绝不先显示本地演示房型。
  const [merchantRooms, setMerchantRooms] = useState<RoomDetailData[]>([]); // 保存商家后台自己的房型。
  const [isSavingRoom, setIsSavingRoom] = useState(false); // 保存房型是否正在写入数据库的状态。
  const [isCreatingHotelContract, setIsCreatingHotelContract] = useState(false); // 保存商家是否正在创建酒店合约，避免重复点按钮。
  const [isUploadingRoomImage, setIsUploadingRoomImage] = useState(false); // 保存房型图片是否正在上传到 Supabase Storage。
  const [roomImagePreviewUrl, setRoomImagePreviewUrl] = useState(""); // 保存商家刚选择的本地图片预览地址，上传到 Storage 前也能先看到图片。
  const [roomImageUploadStatus, setRoomImageUploadStatus] = useState<"idle" | "uploading" | "uploaded" | "failed">("idle"); // 保存图片上传状态，用来显示正在上传、已上传或失败。
  const [roomImageUploadError, setRoomImageUploadError] = useState(""); // 保存图片上传失败原因，避免错误只出现在顶部提示里。
  const visibleHotels = useMemo(() => isSupabaseConfigured ? buildHotelsFromRooms(publicRooms) : hotels, [publicRooms]); // 配置 Supabase 后，用户侧酒店列表只从真实上传的房型生成。
  const selectedHotel = useMemo(() => visibleHotels.find((item) => item.id === selectedHotelId) ?? visibleHotels[0] ?? hotels[0], [visibleHotels, selectedHotelId]); // 根据酒店编号找到当前酒店。
  const selectedRoom = useMemo(() => publicRooms.find((item) => item.id === selectedRoomId) ?? publicRooms[0] ?? null, [publicRooms, selectedRoomId]); // 根据房型编号找到当前房型；配置 Supabase 后没有真实房型就返回空。
  const selectedHotelRooms = useMemo(() => publicRooms.filter((room) => room.hotelId === selectedHotel.id), [publicRooms, selectedHotel.id]); // 找到当前酒店下的所有房型。
  const connectedToMonad = chainId === null ? false : isMonadTestnet(chainId); // 判断当前钱包是否连接 Monad 测试网。

  useEffect(() => { // 页面首次加载时执行一次。
    if (window.location.pathname.startsWith("/audit")) setView("audit"); // 如果地址是审核页，就切到审核页。
    void loadPublicRooms(); // 读取 Supabase 中已上架的真实房型。
  }, []); // 空数组表示只在页面加载时执行一次。

  function goTo(targetView: ViewName) { // 定义页面跳转函数。
    setView(targetView); // 更新当前页面。
    window.history.replaceState(null, "", targetView === "audit" ? "/audit" : "/"); // 同步浏览器地址。
  } // 页面跳转函数结束。

  async function loadPublicRooms() { // 定义读取用户可见房型的函数。
    if (!isSupabaseConfigured) { // 如果 Supabase 没配置。
      setPublicRooms(rooms); // 使用本地演示房型兜底。
      return; // 结束函数。
    } // Supabase 配置检查结束。
    try { // 开始请求数据库。
      const records = await fetchActiveRoomTypes(); // 从 Supabase 读取已上架房型。
      setPublicRooms(records.length > 0 ? mapStorageRoomRecords(records) : []); // 把数据库房型转成页面房型并保存；旧默认图记录会被过滤掉。
    } catch (error) { // 捕获读取失败。
      setPublicRooms([]); // 配置了 Supabase 后不再回退到本地演示房型，避免用户把占位内容误认为真实数据。
      setNotice(error instanceof Error ? `读取 Supabase 房型失败：${error.message}` : "读取 Supabase 房型失败。"); // 告诉用户真实错误原因。
    } // 数据库读取结束。
  } // 读取用户可见房型函数结束。

  async function loadMerchantRooms(ownerWallet: string) { // 定义读取商家自己房型的函数。
    if (!isSupabaseConfigured) return; // 如果 Supabase 没配置，就不请求数据库。
    try { // 开始请求数据库。
      const records = await fetchMerchantRoomTypes(ownerWallet); // 读取当前钱包名下的房型。
      setMerchantRooms(mapStorageRoomRecords(records)); // 转成页面房型后保存；只显示真正上传到 Supabase Storage 的图片房型。
    } catch (error) { // 捕获读取失败。
      setNotice(error instanceof Error ? error.message : "读取商家房型失败。"); // 显示错误提示。
    } // 商家房型读取结束。
  } // 读取商家房型函数结束。

  async function loadOrdersForWalletAddress(address: string) { // 定义读取用户钱包订单的函数。
    if (!address) { setOrders([]); return; } // 没有钱包地址就清空订单。
    if (!isSupabaseConfigured) { setOrders(loadOrdersForWallet(address)); return; } // 没配置 Supabase 时读取本地订单。
    try { // 开始读取数据库订单。
      const databaseOrders = await fetchBookingOrdersByWallet(address); // 从 Supabase 读取当前钱包订单。
      setOrders(databaseOrders.length > 0 ? databaseOrders : loadOrdersForWallet(address)); // 优先使用数据库订单，没有数据库订单时回退本地订单。
    } catch { // 如果数据库读取失败。
      setOrders(loadOrdersForWallet(address)); // 回退读取本地订单，避免用户找不到二维码。
    } // 读取用户订单结束。
  } // 用户订单读取函数结束。

  async function loadOrdersForMerchant(application: MerchantApplicationRecord | null) { // 定义读取商家酒店订单的函数。
    if (!application || !isSupabaseConfigured) return; // 没有商家或没配置 Supabase 就不读取。
    try { // 开始读取商家订单。
      const merchantOrders = await fetchBookingOrdersByHotel(getMerchantHotelId(application)); // 从 Supabase 读取这家酒店的订单。
      setOrders(merchantOrders); // 把商家订单保存到页面状态，商家后台会显示它们。
    } catch (error) { // 捕获读取失败。
      setNotice(error instanceof Error ? error.message : "读取商家订单失败。"); // 显示错误。
    } // 商家订单读取结束。
  } // 商家订单读取函数结束。

  useEffect(() => { // 商家后台打开时自动刷新订单。
    if (view !== "merchantDashboard" || !approvedMerchant || !isSupabaseConfigured) return; // 只有进入商家后台且 Supabase 已配置时才轮询。
    void loadOrdersForMerchant(approvedMerchant); // 进入后台时先立刻读取一次订单。
    const timer = window.setInterval(() => { void loadOrdersForMerchant(approvedMerchant); }, 5000); // 每 5 秒重新读取一次，用户到店签名后商家后台会自动看到 signed 状态。
    return () => { window.clearInterval(timer); }; // 离开商家后台时清理定时器，避免重复请求。
  }, [view, approvedMerchant]); // 页面或商家身份变化时重新设置刷新逻辑。

  async function connectWallet() { // 定义连接钱包函数。
    if (!window.ethereum) { // 检查浏览器是否有钱包插件。
      setNotice("没有检测到钱包插件，请先安装 MetaMask 或支持 Monad 的钱包。"); // 提示用户安装钱包。
      return; // 结束函数。
    } // 钱包检查结束。
    const accounts = (await window.ethereum.request({ method: "eth_requestAccounts" })) as string[]; // 请求用户授权读取钱包账户。
    const chainHex = (await window.ethereum.request({ method: "eth_chainId" })) as string; // 读取当前钱包网络链 ID。
    const address = accounts[0] ?? ""; // 取第一个钱包地址。
    const normalizedAddress = address.toLowerCase(); // 把新钱包地址转成小写，方便和旧地址稳定比较。
    const normalizedCurrentWallet = walletAddress.toLowerCase(); // 把当前页面记住的钱包地址转成小写。
    if (normalizedAddress && normalizedCurrentWallet && normalizedAddress !== normalizedCurrentWallet) { // 如果用户切换到了另一个钱包。
      setGuest(emptyGuest); // 清空上一个用户填写的姓名、电话和证件号。
      setApprovedMerchant(null); // 清空旧钱包对应的商家身份。
      setMerchantRooms([]); // 清空旧商家的房型列表。
    } // 换钱包清理结束。
    setWalletAddress(address); // 保存钱包地址。
    await loadOrdersForWalletAddress(address); // 读取这个钱包保存过的订单，避免换钱包时看到上一个用户订单。
    setChainId(Number.parseInt(chainHex, 16)); // 把十六进制链 ID 转成数字并保存。
    setNotice("钱包已连接，正在检查商家审核状态。"); // 更新提示。
    if (isSupabaseConfigured && address) { // 如果 Supabase 已配置且地址存在。
      try { // 开始查询商家状态。
        const approved = await fetchApprovedMerchantByWallet(address); // 查询当前钱包是否有已通过商家申请。
        setApprovedMerchant(approved); // 保存审核通过资料。
        if (approved) { // 如果商家已通过审核。
          await loadMerchantRooms(address); // 读取这个商家的真实房型。
          await loadOrdersForMerchant(approved); // 读取这个商家的酒店订单。
          goTo("merchantDashboard"); // 自动进入商家后台。
          setNotice("已识别为审核通过商家，正在显示你的房型管理界面。"); // 更新提示。
        } // 已审核商家处理结束。
      } catch (error) { // 捕获查询失败。
        setNotice(error instanceof Error ? error.message : "检查商家状态失败。"); // 显示错误。
      } // 查询结束。
    } // Supabase 查询条件结束。
  } // 连接钱包函数结束。

  async function switchToMonadTestnet() { // 定义切换 Monad 测试网函数。
    if (!window.ethereum) return; // 如果没有钱包就结束。
    await window.ethereum.request({ method: "wallet_addEthereumChain", params: [{ chainId: "0x279F", chainName: "Monad Testnet", nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 }, rpcUrls: ["https://testnet-rpc.monad.xyz"], blockExplorerUrls: ["https://testnet.monadscan.com"] }] }); // 请求钱包添加或切换到 Monad 测试网。
    setChainId(MONAD_TESTNET_CHAIN_ID); // 保存 Monad 测试网链 ID。
    setNotice("已请求切换到 Monad 测试网；本项目禁止在主网测试。"); // 更新提示。
  } // 切换 Monad 测试网函数结束。

  function openHotel(hotel: HotelCardData) { // 定义打开酒店主页函数。
    setSelectedHotelId(hotel.id); // 保存选中的酒店编号。
    goTo("hotel"); // 跳到酒店主页。
    setNotice(`已进入 ${hotel.name}，下面的房型优先来自 Supabase 数据库。`); // 更新提示。
  } // 打开酒店函数结束。

  function openRoom(room: RoomDetailData) { // 定义打开房型详情函数。
    setSelectedRoomId(room.id); // 保存选中的房型编号。
    goTo("room"); // 跳到房型详情页。
    setNotice(`正在查看 ${room.name}。`); // 更新提示。
  } // 打开房型函数结束。

  async function enterMerchantFlow() { // 定义进入商家流程函数。
    if (!walletAddress) { // 如果还没连接钱包。
      setNotice("商家需要先连接钱包；入驻申请会绑定到这个钱包地址。"); // 提示先连接钱包。
      return; // 结束函数。
    } // 钱包检查结束。
    if (approvedMerchant) { // 如果已审核通过。
      await loadMerchantRooms(walletAddress); // 读取商家真实房型。
      await loadOrdersForMerchant(approvedMerchant); // 读取商家收到的订单。
      goTo("merchantDashboard"); // 进入后台。
      return; // 结束函数。
    } // 已审核判断结束。
    goTo("merchantOnboarding"); // 未审核通过则进入入驻页。
    setNotice("请填写企业主体、资质和联系人信息，提交后等待审核。"); // 更新提示。
  } // 商家流程函数结束。

  async function openUserOrders() { // 定义打开用户订单栏的函数。
    if (walletAddress) await loadOrdersForWalletAddress(walletAddress); // 打开前按当前钱包重新读取订单，避免仍显示商家后台订单。
    goTo("userOrders"); // 跳转到用户订单栏页面。
  } // 打开用户订单栏函数结束。

  async function submitMerchant() { // 定义提交商家入驻函数。
    if (!walletAddress) { // 检查钱包地址。
      setNotice("请先连接钱包，再提交商家入驻资料。"); // 提示连接钱包。
      return; // 结束函数。
    } // 钱包检查结束。
    if (!merchantForm.companyName || !merchantForm.licenseId || !merchantForm.contactName || !merchantForm.contactPhone) { // 检查必填项。
      setNotice("请填写商家名称、营业执照编号、联系人和联系电话。"); // 提示补全信息。
      return; // 结束函数。
    } // 必填检查结束。
    const input: MerchantApplicationInput = { owner_wallet: walletAddress.toLowerCase(), company_name: merchantForm.companyName, license_id: merchantForm.licenseId, contact_name: merchantForm.contactName, contact_phone: merchantForm.contactPhone, qualification: merchantForm.qualification, document_url: merchantForm.documentUrl }; // 组织数据库需要的商家申请数据。
    if (!isSupabaseConfigured) { // 如果 Supabase 未配置。
      setPendingMerchant({ ...input, id: "local-preview", status: "pending", reviewer_note: "", reviewed_by: null, reviewed_at: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }); // 创建本地预览申请。
      goTo("merchantPending"); // 跳到等待审核页。
      setNotice("Supabase 尚未配置：当前只是本地预览，配置数据库后才会真正写入。"); // 更新提示。
      return; // 结束函数。
    } // Supabase 检查结束。
    try { // 开始提交数据库。
      const record = await submitMerchantApplication(input); // 调用数据库提交函数。
      setPendingMerchant(record); // 保存待审核记录。
      goTo("merchantPending"); // 跳转等待审核页。
      setNotice("商家入驻资料已提交，审核通过后才能进入商家管理界面。"); // 更新提示。
    } catch (error) { // 捕获提交失败。
      setNotice(error instanceof Error ? error.message : "提交商家入驻资料失败。"); // 显示错误。
    } // 提交结束。
  } // 提交商家函数结束。

  async function uploadRoomImageFile(file: File) { // 定义上传房型图片文件的函数。
    if (!approvedMerchant || !walletAddress) { // 检查商家是否已经审核通过并连接钱包。
      setNotice("只有审核通过并连接钱包的商家才能上传房型图片。"); // 提示当前没有上传权限。
      return; // 结束函数。
    } // 商家权限检查结束。
    if (!isSupabaseConfigured) { // 检查 Supabase 是否已经配置。
      setNotice("Supabase 尚未配置，不能上传图片到 Storage。"); // 提示缺少数据库配置。
      return; // 结束函数。
    } // Supabase 配置检查结束。
    const previewUrl = URL.createObjectURL(file); // 为用户选择的本地图片创建临时预览地址，不需要等 Storage 上传成功。
    if (roomImagePreviewUrl) URL.revokeObjectURL(roomImagePreviewUrl); // 如果之前已经有临时预览地址，就释放旧地址，避免浏览器内存浪费。
    setRoomImagePreviewUrl(previewUrl); // 先显示本地图片预览，让用户确认选中的图片正确。
    setRoomImageUploadStatus("uploading"); // 标记图片正在上传。
    setRoomImageUploadError(""); // 清空旧的上传错误。
    try { // 开始上传图片。
      setIsUploadingRoomImage(true); // 标记正在上传，避免用户重复选择文件。
      const imageUrl = await uploadRoomImage(file, walletAddress); // 上传图片到 Supabase Storage 并拿到公开 URL。
      setRoomForm((current) => ({ ...current, imageUrl })); // 把图片 URL 保存进页面状态，页面不会让用户手动编辑这个链接。
      if (!roomForm.name) setRoomForm((current) => ({ ...current, name: file.name.replace(/\.[^.]+$/, "") || current.name })); // 如果还没填房型名，就用文件名临时填入房型名。
      setRoomImageUploadStatus("uploaded"); // 标记图片已经真正上传到 Supabase Storage。
      setNotice("房型图片已上传。请点击“保存当前房型”，保存后会同步到已上传房型和用户界面。"); // 告诉用户图片已经上传，下一步需要保存房型信息。
      return; // 图片上传完成后结束函数，房型写入数据库交给保存按钮。
    } catch (error) { // 捕获上传失败。
      const message = error instanceof Error ? error.message : "上传房型图片失败。"; // 生成可读错误文本。
      setRoomImageUploadStatus("failed"); // 标记图片上传失败。
      setRoomImageUploadError(message); // 把错误保存到上传区域，用户能直接看到。
      setNotice(message); // 同步显示顶部提示。
    } finally { // 无论成功失败都执行。
      setIsUploadingRoomImage(false); // 解除上传中状态。
    } // 上传流程结束。
  } // 上传房型图片文件函数结束。

  async function saveRoomType(imageUrlOverride?: string, fallbackName?: string) { // 定义保存房型到 Supabase 的函数，图片上传后也可以把新 URL 直接传进来。
    if (!approvedMerchant || !walletAddress) { // 检查商家是否已审核通过并连接钱包。
      setNotice("只有审核通过并连接钱包的商家才能保存房型。"); // 提示权限不足。
      return; // 结束函数。
    } // 商家权限检查结束。
    if (!approvedMerchant.hotel_contract_address) { // 检查商家是否已经创建酒店合约。
      setNotice("请先在商家后台创建酒店合约，再上传和保存房型；用户支付需要这个合约地址。"); // 提示先创建合约。
      return; // 结束函数。
    } // 酒店合约检查结束。
    if (!isSupabaseConfigured) { // 检查 Supabase 配置。
      setNotice("Supabase 尚未配置，不能把房型写入数据库。"); // 提示配置缺失。
      return; // 结束函数。
    } // Supabase 检查结束。
    const finalImageUrl = imageUrlOverride ?? roomForm.imageUrl; // 确定最终图片链接，只允许使用商家上传后得到的真实图片链接。
    if (!finalImageUrl) { // 如果没有真实图片链接。
      setNotice("请先选择房型图片上传；当前版本不再用默认图片创建房型。"); // 明确提示必须先上传图片。
      return; // 停止保存，避免数据库继续写默认占位图片。
    } // 图片链接检查结束。
    if (!isRoomImageStorageUrl(finalImageUrl)) { // 如果图片地址不是当前 Supabase Storage 返回的地址。
      setNotice("房型图片必须先上传到 Supabase Storage，不能继续使用外部图片或旧默认图片。"); // 告诉用户必须走上传入口。
      return; // 停止保存，避免用户界面再次显示占位图。
    } // Storage 图片地址检查结束。
    const finalName = roomForm.name || fallbackName || "未命名房型"; // 确定最终房型名称；没填时用文件名或默认名称兜底。
    const finalDescription = roomForm.description || "商家尚未填写房型详情。"; // 确定最终房型详情；没填时用默认详情兜底。
    const payload: RoomTypeInput = { // 组织 Supabase room_types 表需要的数据。
      merchant_application_id: approvedMerchant.id, // 记录这个房型属于哪条已审核商家申请。
      merchant_name: approvedMerchant.company_name, // 记录商家名称，用户侧酒店列表会显示它。
      owner_wallet: walletAddress.toLowerCase(), // 记录商家钱包地址。
      hotel_id: getMerchantHotelId(approvedMerchant), // MVP 阶段把商家房型绑定到第一家酒店。
      hotel_contract_address: approvedMerchant.hotel_contract_address, // 写入酒店合约地址，让用户侧可以真实支付。
      name: finalName, // 写入房型名称。
      description: finalDescription, // 写入房型详情。
      image_url: finalImageUrl, // 写入房型主图链接。
      gallery_urls: [finalImageUrl], // 先把主图也放入图片组。
      price: roomForm.price, // 写入价格。
      currency: roomForm.currency, // 写入币种。
      valid_until: roomForm.validUntil, // 写入有效期。
      total_inventory: roomForm.totalInventory, // 写入总库存。
      booked_inventory: 0, // 新房型刚创建时已订库存为 0。
      area: roomForm.area || "未填写面积", // 写入面积，没有填写就给默认文本。
      bed: roomForm.bed || "未填写床型", // 写入床型，没有填写就给默认文本。
      breakfast: roomForm.breakfast || "未填写早餐信息", // 写入早餐信息。
      cancellation: roomForm.cancellation || "未填写取消规则", // 写入取消规则。
      is_active: true, // 新增房型默认上架，用户页面可以看到。
    }; // 房型写入数据组织结束。
    try { // 开始写入数据库。
      setIsSavingRoom(true); // 标记正在保存，避免用户重复点击。
      const createdRoom = await createRoomType(payload); // 调用 Supabase 新增房型接口，并拿到数据库刚创建的记录。
      const createdVisibleRooms = mapStorageRoomRecords([createdRoom]); // 把刚创建的数据库记录转成页面可显示的房型。
      setMerchantRooms((current) => [...createdVisibleRooms, ...current.filter((room) => room.id !== createdRoom.id)]); // 先把新房型立即放进“已有房型”，避免等待重新读取时页面看起来没反应。
      setPublicRooms((current) => [...createdVisibleRooms, ...current.filter((room) => room.id !== createdRoom.id)]); // 同步更新用户侧房型列表，让用户界面也能马上看到。
      await loadMerchantRooms(walletAddress); // 保存成功后强制重新读取商家房型，确保“已有房型”显示的是数据库真实结果。
      await loadPublicRooms(); // 保存成功后强制重新读取用户侧房型，确保用户页面也立刻看到真实房型。
      setRoomForm(emptyRoomForm); // 清空表单，方便继续新增。
      setRoomImagePreviewUrl(""); // 清空图片预览，表示这一条房型已经保存完成。
      setRoomImageUploadStatus("idle"); // 重置图片上传状态，方便继续新增下一条房型。
      setRoomImageUploadError(""); // 清空上传错误。
      setNotice("房型已保存到 Supabase，用户酒店页会读取这条真实房型。"); // 更新提示。
    } catch (error) { // 捕获保存失败。
      setNotice(error instanceof Error ? error.message : "保存房型失败。"); // 显示错误。
    } finally { // 无论成功失败都执行。
      setIsSavingRoom(false); // 解除正在保存状态。
    } // 保存结束。
  } // 保存房型函数结束。

  async function deleteRoomType(room: RoomDetailData) { // 定义商家删除房型的函数。
    if (!approvedMerchant || !walletAddress) { setNotice("只有审核通过并连接钱包的商家才能删除房型。"); return; } // 检查商家身份和钱包。
    if (!isSupabaseConfigured) { setNotice("Supabase 尚未配置，不能删除数据库里的房型。"); return; } // 没配置数据库就停止。
    try { // 开始删除房型。
      await archiveRoomType(room.id, walletAddress); // 把房型改成下架状态，而不是物理删除数据库行。
      setMerchantRooms((current) => current.filter((item) => item.id !== room.id)); // 立即从商家后台列表移除这个房型。
      setPublicRooms((current) => current.filter((item) => item.id !== room.id)); // 立即从用户侧房型列表移除这个房型。
      await loadMerchantRooms(walletAddress); // 重新读取商家房型，确保页面和数据库一致。
      await loadPublicRooms(); // 重新读取用户侧房型，确保酒店列表也同步变化。
      setNotice(`房型「${room.name}」已下架；历史订单仍然保留。`); // 告诉商家删除结果。
    } catch (error) { // 捕获删除失败。
      setNotice(error instanceof Error ? error.message : "删除房型失败。"); // 显示错误。
    } // 删除房型流程结束。
  } // 商家删除房型函数结束。

  async function createHotelContractForMerchant() { // 定义商家创建酒店合约并写回数据库的函数。
    if (!approvedMerchant || !walletAddress) { // 检查商家是否已审核通过并连接钱包。
      setNotice("只有审核通过并连接钱包的商家才能创建酒店合约。"); // 提示权限不足。
      return; // 结束函数。
    } // 商家权限检查结束。
    if (!connectedToMonad) { // 检查钱包是否在 Monad 测试网。
      setNotice("请先切换到 Monad 测试网，再创建酒店合约。"); // 提示切换网络。
      return; // 结束函数。
    } // 测试网检查结束。
    if (approvedMerchant.hotel_contract_address) { // 如果已经有酒店合约地址。
      setNotice(`这家酒店已经有合约地址：${approvedMerchant.hotel_contract_address}`); // 提示已有地址。
      return; // 结束函数。
    } // 已有地址检查结束。
    try { // 开始创建酒店合约。
      setIsCreatingHotelContract(true); // 标记正在创建，避免重复点击。
      setNotice("请在钱包里确认创建酒店合约交易；这会消耗 Monad 测试网 MON 作为 gas。"); // 提示用户看钱包。
      const hotelContractAddress = await createMerchantHotelContract({ hotelName: approvedMerchant.company_name }); // 让商家钱包调用 Factory 创建酒店合约。
      const updatedMerchant = await updateMerchantHotelContractAddress(approvedMerchant.id, walletAddress, hotelContractAddress); // 把新酒店合约地址写回 Supabase。
      setApprovedMerchant(updatedMerchant); // 更新当前商家状态。
      await loadMerchantRooms(walletAddress); // 重新读取商家房型，让旧房型也带上合约地址。
      await loadOrdersForMerchant(updatedMerchant); // 重新读取商家订单，让后台保持最新。
      await loadPublicRooms(); // 重新读取用户侧房型，让酒店卡片带上合约地址。
      setNotice(`酒店合约已创建并写回数据库：${hotelContractAddress}`); // 提示成功。
    } catch (error) { // 捕获创建或写库失败。
      setNotice(error instanceof Error ? `酒店合约没有创建完成：${error.message}` : "酒店合约没有创建完成。"); // 显示错误。
    } finally { // 无论成功失败都执行。
      setIsCreatingHotelContract(false); // 解除创建中状态。
    } // 创建酒店合约流程结束。
  } // 商家创建酒店合约函数结束。

  async function createBooking() { // 定义创建订单函数。
    if (!selectedRoom) { setNotice("当前没有可预订的真实房型。请先让商家在后台上传房型。"); return; } // 没有真实房型就停止，避免使用占位房型下单。
    if (!walletAddress) { setNotice("请先连接钱包，再支付订单。"); return; } // 没钱包就停止。
    if (!connectedToMonad) { setNotice("请先切换到 Monad 测试网，禁止在主网测试。"); return; } // 不是测试网就停止。
    if (!guest.fullName || !guest.phone || !guest.identityNumber) { setNotice("请填写姓名、电话和证件号；页面只会上链资料哈希。"); return; } // 资料不完整就停止。
    if (selectedRoom.bookedInventory >= selectedRoom.totalInventory) { setNotice("这个房型已经没有剩余库存，不能继续支付。"); return; } // 库存卖完时阻止继续下单。
    const shouldPayOnchain = canUseRealPayment(selectedHotel.contractAddress, selectedRoom.currency); // 判断是否已经配置真实酒店合约和测试网代币地址。
    if (!shouldPayOnchain) { setNotice(`还不能支付：${getPaymentConfigIssue(selectedHotel.contractAddress, selectedRoom.currency) || "支付配置不完整，请检查酒店合约地址和测试网代币地址。"}`); return; } // 没有真实支付配置就停止，避免用户误以为已经支付。
    const orderId = `offchain-${Date.now()}`; // 生成链外订单编号，真实版本会来自后端订单表。
    const guestHash = await createGuestHash(guest); // 生成用户资料哈希；它会作为支付交易参数一起上链，但不会被单独保存成订单。
    const checkInCode = createSixDigitCheckInCode(); // 生成用户到店时使用的 6 位数字密码。
    const hashes = createBookingHashes(orderId, guestHash, checkInCode); // 生成链上订单 ID、链外订单哈希和入住密码哈希。
    try { // 开始真实支付流程。
      const paymentTxHash = await payHotelBooking({ hotelAddress: selectedHotel.contractAddress, tokenSymbol: selectedRoom.currency, amount: selectedRoom.price, orderId, guestHash, checkInCode }); // 调用酒店合约并使用 MON 支付。
      const order: BookingRecord = { id: orderId, hotelId: selectedHotel.id, roomTypeId: selectedRoom.id, walletAddress, guestHash, status: "paid", qrPayload: "", paymentToken: selectedRoom.currency, paymentAmount: selectedRoom.price, chainBookingId: hashes.chainBookingId, offchainOrderHash: hashes.offchainOrderHash, checkInCode, checkInCodeHash: hashes.checkInCodeHash, hotelContractAddress: selectedHotel.contractAddress, paymentTxHash, createdAt: new Date().toISOString(), source: "chain" }; // 只有支付交易确认后，才创建前端订单。
      order.qrPayload = createQrPayload(order); // 生成二维码内容。
      let inventoryWarning = ""; // 保存库存同步警告，避免后面的订单同步提示把它覆盖掉。
      setOrders((current) => { const nextOrders = [order, ...current]; saveOrdersForWallet(walletAddress, nextOrders); return nextOrders; }); // 保存订单到页面状态和当前钱包的本地存储。
      if (isSupabaseConfigured) { // 如果 Supabase 已配置。
        try { // 开始更新库存。
          const updatedRoom = await increaseBookedInventory(selectedRoom.id, selectedRoom.bookedInventory); // 支付成功后把这个房型的已订库存加 1。
          const updatedVisibleRoom = mapStorageRoomRecords([updatedRoom])[0]; // 把数据库房型记录转成页面房型。
          if (updatedVisibleRoom) setPublicRooms((current) => current.map((room) => room.id === updatedVisibleRoom.id ? updatedVisibleRoom : room)); // 立即更新用户侧房型库存显示。
          if (updatedVisibleRoom) setMerchantRooms((current) => current.map((room) => room.id === updatedVisibleRoom.id ? updatedVisibleRoom : room)); // 如果当前也是商家页面数据，就同步更新商家房型库存。
        } catch (error) { // 捕获库存更新失败。
          inventoryWarning = error instanceof Error ? `库存自动减少失败：${error.message}` : "库存自动减少失败。"; // 记录库存同步失败原因，稍后和支付结果一起展示。
        } // 库存更新结束。
      } // Supabase 库存更新结束。
      if (isSupabaseConfigured) { // 如果 Supabase 已经配置。
        try { // 开始同步订单到数据库。
          await upsertBookingOrder(order); // Supabase 已配置时同步写入订单表，让商家后台能找到这笔订单。
          setNotice(inventoryWarning ? `支付交易已确认，订单已同步商家后台，但${inventoryWarning}` : "支付交易已在 Monad 测试网确认，订单凭证和商家二维码已生成，库存已自动减少。"); // 更新提示。
        } catch (error) { // 捕获数据库同步失败。
          setNotice(error instanceof Error ? `支付已确认，订单已保存在本机，但同步商家后台失败：${error.message}` : "支付已确认，订单已保存在本机，但同步商家后台失败。"); // 明确区分链上支付成功和数据库同步失败。
        } // 数据库同步结束。
      } else { // 如果 Supabase 没配置。
        setNotice("支付交易已在 Monad 测试网确认，订单凭证已保存在当前钱包的本机订单栏。"); // 更新提示。
      } // 同步提示结束。
    } catch (error) { // 捕获钱包拒签、余额不足、授权失败、合约失败等错误。
      setNotice(error instanceof Error ? `支付没有完成，因此没有生成订单：${error.message}` : "支付没有完成，因此没有生成订单。"); // 明确告诉用户没有支付就没有订单。
    } // 真实支付流程结束。
  } // 创建订单函数结束。

  async function signCheckIn(order: BookingRecord) { // 定义到店签名函数。
    if (!window.ethereum) { setNotice("没有检测到钱包插件，不能到店签名。"); return; } // 没钱包就停止。
    if (!walletAddress) { setNotice("请先连接下单的钱包，再到店签名。"); return; } // 没连接钱包就停止。
    if (walletAddress.toLowerCase() !== order.walletAddress.toLowerCase()) { setNotice("当前连接的钱包不是这笔订单的下单钱包，不能冒名到店签名。"); return; } // 当前钱包必须等于订单钱包。
    try { // 开始请求用户签名。
      const signature = await signCheckInMessage({ hotelAddress: order.hotelContractAddress, chainBookingId: order.chainBookingId, guestHash: order.guestHash, checkInCode: order.checkInCode }); // 让下单钱包签出与合约一致的入住消息。
      const verified = await verifyCheckInSignature({ hotelAddress: order.hotelContractAddress, chainBookingId: order.chainBookingId, guestHash: order.guestHash, checkInCode: order.checkInCode, expectedWalletAddress: order.walletAddress, signature }); // 在前端立即验证签名是否确实来自订单钱包。
      if (!verified) { setNotice("签名验证失败：签名者不是订单钱包，不能给用户开房。"); return; } // 验证失败时不更新订单。
      const signedOrder: BookingRecord = { ...order, status: "signed", checkInSignature: signature }; // 生成已到店签名订单；signed 表示用户已证明自己控制下单钱包。
      setOrders((current) => { const nextOrders = current.map((item) => item.id === order.id ? signedOrder : item); saveOrdersForWallet(order.walletAddress, nextOrders.filter((item) => item.walletAddress.toLowerCase() === order.walletAddress.toLowerCase())); return nextOrders; }); // 更新页面状态，并只把这个用户自己的订单写回这个钱包的本地存储。
      if (isSupabaseConfigured) await upsertBookingOrder(signedOrder); // 把 signed 状态同步到 Supabase，商家后台轮询后会自动看到。
      setNotice("到店签名已完成，并已验证签名钱包就是下单钱包；商家后台现在可以提交链上入住核验。"); // 更新提示。
    } catch (error) { // 捕获用户拒签或钱包异常。
      setNotice(error instanceof Error ? `到店签名没有完成：${error.message}` : "到店签名没有完成。"); // 显示失败原因。
    } // 到店签名流程结束。
  } // 到店签名函数结束。

  async function submitCheckInToChain(order: BookingRecord) { // 定义商家提交入住核验到链上的函数。
    if (!order.checkInSignature) { setNotice("这笔订单还没有用户到店签名，不能提交链上入住核验。"); return; } // 没有用户签名就停止。
    if (!canUseRealPayment(order.hotelContractAddress, order.paymentToken)) { setNotice("当前订单是本地预览或缺少合约地址，不能提交真实链上入住核验。"); return; } // 缺少真实合约配置就停止。
    try { // 开始商家核验流程。
      const verified = await verifyCheckInSignature({ hotelAddress: order.hotelContractAddress, chainBookingId: order.chainBookingId, guestHash: order.guestHash, checkInCode: order.checkInCode, expectedWalletAddress: order.walletAddress, signature: order.checkInSignature }); // 商家提交前再次验证签名者是否等于订单钱包。
      if (!verified) { setNotice("商家后台核验失败：用户签名和订单钱包不匹配，不能给用户开房。"); return; } // 验证失败就停止。
      const checkInTxHash = await submitHotelCheckIn({ hotelAddress: order.hotelContractAddress, chainBookingId: order.chainBookingId, checkInCode: order.checkInCode, signature: order.checkInSignature }); // 调用酒店合约 checkIn 完成入住核验。
      const checkedOrder: BookingRecord = { ...order, status: "checkedIn", checkInTxHash }; // 生成已入住订单状态。
      setOrders((current) => current.map((item) => item.id === order.id ? checkedOrder : item)); // 更新商家后台页面状态。
      if (isSupabaseConfigured) await upsertBookingOrder(checkedOrder); // 把 checkedIn 状态同步到 Supabase，用户订单栏下次也能看到。
      setNotice("商家已核对签名钱包并提交到 Monad 测试网，链上入住核验完成，可以给用户开房。"); // 更新提示。
    } catch (error) { // 捕获链上提交失败。
      setNotice(error instanceof Error ? `入住核验没有完成：${error.message}` : "入住核验没有完成。"); // 显示失败原因。
    } // 商家核验流程结束。
  } // 商家提交入住核验函数结束。

  return ( // 返回页面内容。
    <main className="app-shell"> {/* 页面根容器。 */}
      <header className="topbar"> {/* 顶部导航栏。 */}
        <button className="brand-button" onClick={() => goTo("entry")}><Building2 size={24} />Monad 酒店 DApp</button> {/* 品牌按钮。 */}
        <div className="topbar-actions"> {/* 顶部操作区。 */}
          <button className="ghost-button" onClick={() => goTo("audit")}>审核入口</button> {/* 审核入口按钮。 */}
          <button className="ghost-button" onClick={() => { void openUserOrders(); }}>我的订单</button> {/* 用户订单入口，重新连接同一钱包后可以找回本地保存的订单。 */}
          <button className="ghost-button" onClick={switchToMonadTestnet}>切到测试网</button> {/* 切换 Monad 测试网按钮。 */}
          <button className="primary-button" onClick={connectWallet}><Wallet size={18} />{shortAddress(walletAddress)}</button> {/* 连接钱包按钮。 */}
        </div> {/* 顶部操作区结束。 */}
      </header> {/* 顶部导航栏结束。 */}
      <p className="notice">{notice}</p> {/* 页面提示。 */}
      {view !== "entry" && view !== "audit" && <button className="back-button" onClick={() => goTo("entry")}><ArrowLeft size={18} />返回身份选择</button>} {/* 返回入口按钮。 */}
      {view === "entry" && <EntryView onUser={() => goTo("hotels")} onMerchant={enterMerchantFlow} />} {/* 身份选择页。 */}
      {view === "hotels" && <HotelListView hotelsToShow={visibleHotels} onOpenHotel={openHotel} roomCountByHotel={countRoomsByHotel(publicRooms)} />} {/* 酒店列表页。 */}
      {view === "userOrders" && <UserOrdersView walletAddress={walletAddress} orders={orders} onSign={signCheckIn} />} {/* 用户订单栏。 */}
      {view === "hotel" && <HotelHomeView hotel={selectedHotel} rooms={selectedHotelRooms} onOpenRoom={openRoom} onBack={() => goTo("hotels")} />} {/* 酒店主页。 */}
      {view === "room" && selectedRoom && <RoomDetailView hotel={selectedHotel} room={selectedRoom} guest={guest} setGuest={setGuest} onBook={createBooking} orders={orders} onSign={signCheckIn} onBack={() => goTo("hotel")} />} {/* 房型详情页。 */}
      {view === "room" && !selectedRoom && <section className="page-section"><p className="empty-state">当前没有可显示的真实房型，请先让商家在后台上传房型。</p></section>} {/* 没有真实房型时不显示本地占位详情。 */}
      {view === "merchantOnboarding" && <MerchantOnboardingView form={merchantForm} setForm={setMerchantForm} onSubmit={submitMerchant} walletAddress={walletAddress} />} {/* 商家入驻页。 */}
      {view === "merchantPending" && <MerchantPendingView application={pendingMerchant} />} {/* 商家待审核页。 */}
      {view === "merchantDashboard" && <MerchantDashboardView form={roomForm} setForm={setRoomForm} merchantName={approvedMerchant?.company_name ?? "已审核商家"} hotelContractAddress={approvedMerchant?.hotel_contract_address ?? ""} rooms={merchantRooms} orders={orders.filter((order) => order.hotelId === getMerchantHotelId(approvedMerchant))} onCreateHotelContract={createHotelContractForMerchant} isCreatingHotelContract={isCreatingHotelContract} onSubmitCheckIn={submitCheckInToChain} onDeleteRoom={deleteRoomType} onUploadImage={uploadRoomImageFile} imagePreviewUrl={roomImagePreviewUrl} uploadStatus={roomImageUploadStatus} uploadError={roomImageUploadError} isUploadingImage={isUploadingRoomImage} onSave={() => saveRoomType()} isSaving={isSavingRoom} />} {/* 商家后台页。 */}
      {view === "audit" && <AuditView />} {/* 审核页。 */}
    </main> // 页面根容器结束。
  ); // 页面返回结束。
} // 主组件结束。

function countRoomsByHotel(roomList: RoomDetailData[]) { // 定义统计每家酒店房型数量的函数。
  return roomList.reduce<Record<string, number>>((result, room) => { // 遍历所有房型并累计数量。
    result[room.hotelId] = (result[room.hotelId] ?? 0) + 1; // 给对应酒店数量加一。
    return result; // 返回累计对象。
  }, {}); // 统计初始值为空对象。
} // 房型数量统计函数结束。

function buildHotelsFromRooms(roomList: VisibleRoomData[]) { // 定义从真实房型反推酒店列表的函数。
  const hotelMap = new Map<string, HotelCardData>(); // 创建一个 Map，Map 可以理解为按酒店编号去重的字典。
  for (const room of roomList) { // 遍历 Supabase 返回的每一个真实房型。
    if (!hotelMap.has(room.hotelId)) { // 如果这个酒店还没有被加入列表。
      hotelMap.set(room.hotelId, { id: room.hotelId, name: room.hotelName ?? "已入驻酒店", city: "链外房型", district: "Supabase", coverImage: room.imageUrl, contractAddress: room.hotelContractAddress ?? "", rating: 5, summary: room.description, tags: [room.currency, "商家上传", room.hotelContractAddress ? "可链上支付" : "待创建合约"] }); // 用第一条房型生成酒店卡片，并带上商家酒店合约地址。
    } // 酒店去重判断结束。
  } // 房型遍历结束。
  return Array.from(hotelMap.values()); // 把 Map 里的酒店卡片转成数组返回。
} // 从真实房型生成酒店列表函数结束。

function EntryView({ onUser, onMerchant }: { onUser: () => void; onMerchant: () => void }) { // 定义身份选择组件。
  return <section className="entry-grid"><button className="entry-card user-card" onClick={onUser}><Hotel size={34} /><span>我是用户</span><p>浏览酒店，进入酒店主页，选择真实商家上传的房型。</p></button><button className="entry-card merchant-card" onClick={onMerchant}><Store size={34} /><span>我是商家</span><p>连接钱包后提交入驻；审核通过后进入房型管理后台。</p></button></section>; // 返回身份选择卡片。
} // 身份选择组件结束。

function HotelListView({ hotelsToShow, onOpenHotel, roomCountByHotel }: { hotelsToShow: HotelCardData[]; onOpenHotel: (hotel: HotelCardData) => void; roomCountByHotel: Record<string, number> }) { // 定义酒店列表组件。
  return <section className="page-section"><div className="section-title"><h1>选择酒店</h1><p>配置 Supabase 后，这里只显示商家真实上传过房型的酒店。</p></div>{hotelsToShow.length === 0 && <p className="empty-state">当前数据库里还没有商家上传的房型，所以用户侧不显示任何占位酒店。</p>}<div className="hotel-grid">{hotelsToShow.map((hotel) => <button className="hotel-card" key={hotel.id} onClick={() => onOpenHotel(hotel)}><img src={hotel.coverImage} alt={hotel.name} /><span>{hotel.city} / {hotel.district}</span><strong>{hotel.name}</strong><p>{hotel.summary}</p><small>{hotel.tags.join(" / ")} / 可订房型 {roomCountByHotel[hotel.id] ?? 0} 种</small></button>)}</div></section>; // 返回酒店卡片列表。
} // 酒店列表组件结束。

function HotelHomeView({ hotel, rooms: hotelRooms, onOpenRoom, onBack }: { hotel: HotelCardData; rooms: RoomDetailData[]; onOpenRoom: (room: RoomDetailData) => void; onBack: () => void }) { // 定义酒店主页组件。
  return <section className="page-section"><button className="text-button" onClick={onBack}><ArrowLeft size={16} />返回酒店列表</button><div className="hotel-hero"><img src={hotel.coverImage} alt={hotel.name} /><div><h1>{hotel.name}</h1><p>{hotel.city} / {hotel.district}</p><p>{hotel.summary}</p><p className="contract-line">酒店合约：{hotel.contractAddress}</p></div></div><div className="section-title"><h2>选择房型</h2><p>这里不再固定使用占位房型；Supabase 有房型时会显示商家上传的数据。</p></div>{hotelRooms.length === 0 && <p className="empty-state">这家酒店暂时没有商家上传的房型。</p>}<div className="room-grid">{hotelRooms.map((room) => <button className="room-tile" key={room.id} onClick={() => onOpenRoom(room)}><img src={room.imageUrl} alt={room.name} /><strong>{room.name}</strong><span>{room.price} {room.currency}</span><small>剩余 {room.totalInventory - room.bookedInventory} 间 / {room.bed}</small></button>)}</div></section>; // 返回酒店主页内容。
} // 酒店主页组件结束。

function UserOrdersView({ walletAddress, orders, onSign }: { walletAddress: string; orders: BookingRecord[]; onSign: (order: BookingRecord) => void }) { // 定义用户订单栏组件。
  return <section className="page-section"><div className="section-title"><h1>我的订单</h1><p>{walletAddress ? `当前钱包：${shortAddress(walletAddress)}` : "请先连接钱包；订单按钱包地址保存在本机浏览器。"}</p></div>{!walletAddress && <p className="empty-state">连接钱包后，这里会读取该钱包本地保存的订单。</p>}{walletAddress && orders.length === 0 && <p className="empty-state">这个钱包当前没有本地订单。支付成功后，订单二维码会自动保存到这里。</p>}{orders.length > 0 && <OrderPanel orders={orders} onSign={onSign} />}</section>; // 返回用户订单栏内容。
} // 用户订单栏组件结束。

function RoomDetailView({ hotel, room, guest, setGuest, onBook, orders, onSign, onBack }: { hotel: HotelCardData; room: RoomDetailData; guest: GuestDraft; setGuest: (guest: GuestDraft) => void; onBook: () => void; orders: BookingRecord[]; onSign: (order: BookingRecord) => void; onBack: () => void }) { // 定义房型详情组件。
  return <section className="page-section"><button className="text-button" onClick={onBack}><ArrowLeft size={16} />返回酒店主页</button><div className="room-detail"><img src={room.imageUrl} alt={room.name} /><div><h1>{room.name}</h1><p>{hotel.name} / {room.area} / {room.bed}</p><p>{room.description}</p><div className="fact-grid"><span>{room.price} {room.currency}</span><span>剩余 {room.totalInventory - room.bookedInventory} 间</span><span>{room.breakfast}</span><span>{room.cancellation}</span></div></div></div><div className="booking-layout"><div className="workflow-panel"><h2>填写入住资料</h2><div className="form-grid"><label>姓名<input value={guest.fullName} onChange={(event) => setGuest({ ...guest, fullName: event.target.value })} /></label><label>电话<input value={guest.phone} onChange={(event) => setGuest({ ...guest, phone: event.target.value })} /></label><label>证件号<input value={guest.identityNumber} onChange={(event) => setGuest({ ...guest, identityNumber: event.target.value })} /></label></div><button className="primary-button wide" onClick={onBook}><CheckCircle2 size={18} />支付并生成订单</button><p className="helper-text">MVP 阶段直接通过酒店合约收 MON，不再使用 USDC 或 USDT。</p></div><OrderPanel orders={orders.filter((order) => order.roomTypeId === room.id)} onSign={onSign} /></div></section>; // 返回房型详情内容。
} // 房型详情组件结束。

function OrderPanel({ orders, onSign }: { orders: BookingRecord[]; onSign: (order: BookingRecord) => void }) { // 定义订单面板组件。
  return <div className="workflow-panel"><h2>订单二维码</h2>{orders.length === 0 && <p className="empty-state">还没有这个房型的订单。</p>}{orders.map((order) => <article className="order-card" key={order.id}><div><strong>{order.id}</strong><p>支付：{order.paymentAmount} {order.paymentToken} / {order.source === "chain" ? "已提交链上" : "本地预览"}</p><p>资料哈希：{order.guestHash.slice(0, 18)}...</p><p>链上订单：{order.chainBookingId.slice(0, 18)}...</p><p>入住数字密码：{order.checkInCode}</p><p>状态：{order.status}</p>{order.paymentTxHash && <p>支付交易：{order.paymentTxHash.slice(0, 18)}...</p>}{order.checkInSignature && <p>到店签名：{order.checkInSignature.slice(0, 18)}...</p>}{order.checkInTxHash && <p>入住交易：{order.checkInTxHash.slice(0, 18)}...</p>}<QrImage payload={order.qrPayload} /></div><button className="ghost-button" onClick={() => onSign(order)} disabled={order.status === "signed" || order.status === "checkedIn"}><KeyRound size={18} />{order.status === "checkedIn" ? "已入住" : order.status === "signed" ? "已签名" : "到店签名"}</button></article>)}</div>; // 返回订单列表。
} // 订单面板组件结束。

function QrImage({ payload }: { payload: string }) { // 定义二维码图片组件，把订单 JSON 转成可扫描图片。
  const [qrUrl, setQrUrl] = useState(""); // 保存二维码图片的 data URL，data URL 可以理解为图片内容直接写在字符串里。
  const [qrError, setQrError] = useState(""); // 保存二维码生成失败时的错误文本。
  useEffect(() => { // 当订单内容变化时重新生成二维码。
    let active = true; // 标记当前组件是否还在页面上，避免异步完成后更新已卸载组件。
    setQrUrl(""); // 清空旧二维码，避免短暂显示上一笔订单二维码。
    setQrError(""); // 清空旧错误。
    QRCode.toDataURL(payload, { errorCorrectionLevel: "M", margin: 2, scale: 6, width: 220 }).then((url) => { if (active) setQrUrl(url); }).catch((error) => { if (active) setQrError(error instanceof Error ? error.message : "二维码生成失败。"); }); // 用本地库生成二维码图片，成功就保存图片，失败就保存错误。
    return () => { active = false; }; // 组件卸载时关闭更新开关。
  }, [payload]); // 依赖订单内容，内容变了才重新生成。
  if (qrError) return <pre className="qr-payload">{payload}</pre>; // 如果生成失败，就退回显示原始内容，避免订单无法核验。
  if (!qrUrl) return <div className="qr-box qr-loading">正在生成二维码...</div>; // 图片还没生成时显示加载状态。
  return <img className="qr-image" src={qrUrl} alt="订单二维码" />; // 返回可扫描的二维码图片。
} // 二维码图片组件结束。

function MerchantOnboardingView({ form, setForm, onSubmit, walletAddress }: { form: typeof emptyMerchantForm; setForm: (form: typeof emptyMerchantForm) => void; onSubmit: () => void; walletAddress: string }) { // 定义商家入驻组件。
  return <section className="page-section narrow-section"><div className="section-title"><h1>商家入驻</h1><p>当前绑定钱包：{walletAddress ? shortAddress(walletAddress) : "未连接"}</p><p>这里填写企业主体内容和资质材料；审核通过后才会进入房型管理流程。</p></div><div className="workflow-panel"><div className="form-grid"><label>商家名称<input value={form.companyName} onChange={(event) => setForm({ ...form, companyName: event.target.value })} /></label><label>营业执照编号<input value={form.licenseId} onChange={(event) => setForm({ ...form, licenseId: event.target.value })} /></label><label>联系人<input value={form.contactName} onChange={(event) => setForm({ ...form, contactName: event.target.value })} /></label><label>联系电话<input value={form.contactPhone} onChange={(event) => setForm({ ...form, contactPhone: event.target.value })} /></label><label className="full-field">资质说明<input value={form.qualification} onChange={(event) => setForm({ ...form, qualification: event.target.value })} /></label><label className="full-field">资质文件链接<input value={form.documentUrl} onChange={(event) => setForm({ ...form, documentUrl: event.target.value })} placeholder="先填写文件链接，后续接 Supabase Storage 上传" /></label></div><button className="upload-box"><FileUp size={20} />上传营业执照、经营许可、酒店资质</button><button className="primary-button wide" onClick={onSubmit}><ShieldCheck size={18} />提交审核</button></div></section>; // 返回入驻表单。
} // 商家入驻组件结束。

function MerchantPendingView({ application }: { application: MerchantApplicationRecord | null }) { // 定义商家等待审核组件。
  return <section className="page-section narrow-section"><div className="workflow-panel"><h1>等待审核</h1><p className="helper-text">你的商家入驻资料已经提交。审核通过前，不能进入商家房型管理界面。</p><p>商家名称：{application?.company_name ?? "本地预览商家"}</p><p>审核状态：{application?.status ?? "pending"}</p></div></section>; // 返回等待审核内容。
} // 商家等待审核组件结束。

function MerchantDashboardView({ form, setForm, merchantName, hotelContractAddress, rooms: merchantRooms, orders, onCreateHotelContract, isCreatingHotelContract, onSubmitCheckIn, onDeleteRoom, onUploadImage, imagePreviewUrl, uploadStatus, uploadError, isUploadingImage, onSave, isSaving }: { form: RoomFormState; setForm: (form: RoomFormState) => void; merchantName: string; hotelContractAddress: string; rooms: RoomDetailData[]; orders: BookingRecord[]; onCreateHotelContract: () => void; isCreatingHotelContract: boolean; onSubmitCheckIn: (order: BookingRecord) => void; onDeleteRoom: (room: RoomDetailData) => void; onUploadImage: (file: File) => void; imagePreviewUrl: string; uploadStatus: "idle" | "uploading" | "uploaded" | "failed"; uploadError: string; isUploadingImage: boolean; onSave: () => void; isSaving: boolean }) { // 定义商家后台组件。
  return <section className="page-section"><div className="section-title"><h1>{merchantName} 商家主页</h1><p>这里管理链外房型，并查看用户支付后生成的订单二维码和入住数字密码。</p></div><div className="dashboard-grid"><div className="workflow-panel"><h2><ShieldCheck size={20} />酒店合约</h2><p className="contract-line">当前酒店合约：{hotelContractAddress || "尚未创建"}</p><button className="primary-button wide" onClick={onCreateHotelContract} disabled={Boolean(hotelContractAddress) || isCreatingHotelContract}>{isCreatingHotelContract ? "正在创建酒店合约..." : hotelContractAddress ? "酒店合约已创建" : "创建酒店合约"}</button><p className="helper-text">商家钱包创建合约后，用户才能对这个酒店使用 MON 支付。</p></div><div className="workflow-panel"><h2><LayoutDashboard size={20} />房型管理</h2><div className="form-grid"><label>房型名字<input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label><label>价格 MON<input type="number" step="0.001" value={form.price} onChange={(event) => setForm({ ...form, price: Number(event.target.value) })} /></label><label>收款币种<input value="MON" disabled /></label><label>有效期<input type="date" value={form.validUntil} onChange={(event) => setForm({ ...form, validUntil: event.target.value })} /></label><label>总库存<input type="number" value={form.totalInventory} onChange={(event) => setForm({ ...form, totalInventory: Number(event.target.value) })} /></label><label>面积<input value={form.area} onChange={(event) => setForm({ ...form, area: event.target.value })} /></label><label>床型<input value={form.bed} onChange={(event) => setForm({ ...form, bed: event.target.value })} /></label><label>早餐<input value={form.breakfast} onChange={(event) => setForm({ ...form, breakfast: event.target.value })} /></label><label>取消规则<input value={form.cancellation} onChange={(event) => setForm({ ...form, cancellation: event.target.value })} /></label><label className="full-field">房型详情<textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label></div>{imagePreviewUrl && <><img className="room-image-preview" src={imagePreviewUrl} alt="房型图片预览" /><p className={uploadStatus === "failed" ? "upload-status upload-status-error" : "upload-status"}>{uploadStatus === "uploaded" ? "已上传" : uploadStatus === "uploading" ? "正在上传" : uploadStatus === "failed" ? "上传失败" : ""}</p>{uploadError && <p className="upload-error">{uploadError}</p>}</>}<label className="upload-box"><ImagePlus size={20} />{isUploadingImage ? "正在上传图片..." : "上传房型图片"}<input className="hidden-file-input" type="file" accept="image/*" disabled={isUploadingImage || isSaving || !hotelContractAddress} onChange={(event) => { const file = event.target.files?.[0]; if (file) onUploadImage(file); event.currentTarget.value = ""; }} /></label><button className="primary-button wide" onClick={onSave} disabled={isSaving || isUploadingImage || uploadStatus !== "uploaded" || !form.imageUrl || !hotelContractAddress}><Upload size={18} />{isSaving ? "正在保存并刷新列表..." : "保存当前房型"}</button></div><div className="workflow-panel"><h2><BedDouble size={20} />已上传房型</h2>{merchantRooms.length === 0 && <p className="empty-state">还没有保存成功的房型。先创建酒店合约，再上传图片并保存房型。</p>}{merchantRooms.map((room) => <article className="merchant-room" key={room.id}><img src={room.imageUrl} alt={room.name} /><div><strong>{room.name}</strong><p>{room.description}</p><small>{room.price} {room.currency} / 总库存 {room.totalInventory} / 已订 {room.bookedInventory}</small><button className="ghost-button wide" onClick={() => onDeleteRoom(room)}><Trash2 size={18} />删除房型</button></div></article>)}</div><div className="workflow-panel order-inbox"><h2><KeyRound size={20} />收到的订单</h2>{orders.length === 0 && <p className="empty-state">当前还没有用户订单。</p>}{orders.map((order) => <article className="order-card" key={order.id}><div><strong>{order.id}</strong><p>支付：{order.paymentAmount} {order.paymentToken}</p><p>链上订单：{order.chainBookingId.slice(0, 18)}...</p><p>入住数字密码：{order.checkInCode}</p><p>状态：{order.status}</p>{order.checkInSignature && <p>用户签名：{order.checkInSignature.slice(0, 18)}...</p>}{order.checkInTxHash && <p>入住交易：{order.checkInTxHash.slice(0, 18)}...</p>}<QrImage payload={order.qrPayload} /></div><button className="ghost-button" onClick={() => onSubmitCheckIn(order)} disabled={!order.checkInSignature || Boolean(order.checkInTxHash)}><KeyRound size={18} />{order.checkInTxHash ? "已提交链上" : "提交入住核验"}</button></article>)}</div></div></section>; // 返回商家后台内容。
} // 商家后台组件结束。

function AuditView() { // 定义审核页面组件。
  const [email, setEmail] = useState(""); // 保存审核员邮箱。
  const [password, setPassword] = useState(""); // 保存审核员密码。
  const [applications, setApplications] = useState<MerchantApplicationRecord[]>([]); // 保存商家申请列表。
  const [isLoadingApplications, setIsLoadingApplications] = useState(false); // 保存是否正在读取申请。
  const [auditNotice, setAuditNotice] = useState(isSupabaseConfigured ? "审核人员请输入邮箱和密码登录。" : "Supabase 尚未配置，审核页只能展示界面。"); // 保存审核页提示。
  async function login() { // 定义审核员登录函数。
    setIsLoadingApplications(true); // 标记正在读取。
    setAuditNotice("正在登录审核员账号并读取商家申请..."); // 更新提示。
    try { await signInReviewer(email, password); const list = await fetchMerchantApplications(); setApplications(list); setAuditNotice(list.length === 0 ? "登录成功，但当前没有可显示的商家申请。" : `登录成功，已读取 ${list.length} 条商家入驻申请。`); } catch (error) { setAuditNotice(error instanceof Error ? error.message : "审核员登录失败。"); } finally { setIsLoadingApplications(false); } // 登录读取结束。
  } // 审核员登录函数结束。
  async function updateStatus(application: MerchantApplicationRecord, status: "approved" | "rejected") { // 定义审核状态更新函数。
    const note = status === "approved" ? "审核通过" : "审核拒绝"; // 生成审核备注。
    try { const updated = await updateMerchantApplicationStatus(application.id, status, note); setApplications((current) => current.map((item) => item.id === updated.id ? updated : item)); setAuditNotice(`${application.company_name} 已${status === "approved" ? "通过" : "拒绝"}。`); } catch (error) { setAuditNotice(error instanceof Error ? error.message : "更新审核状态失败。"); } // 更新结束。
  } // 审核状态更新函数结束。
  async function logout() { // 定义退出登录函数。
    await signOutReviewer(); // 清除审核员登录状态。
    setApplications([]); // 清空申请列表。
    setAuditNotice("已退出审核账号。"); // 更新提示。
  } // 退出登录函数结束。
  return <section className="page-section"><div className="section-title"><h1>商家入驻审核</h1><p>审核网址：/audit。审核人员使用 Supabase Auth 的邮箱密码登录。</p></div><p className="notice">{auditNotice}</p><div className="audit-layout"><div className="workflow-panel"><h2>审核员登录</h2><div className="form-grid"><label>邮箱<input value={email} onChange={(event) => setEmail(event.target.value)} /></label><label>密码<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} /></label></div><button className="primary-button wide" onClick={login} disabled={isLoadingApplications}>{isLoadingApplications ? "正在读取申请..." : "登录并读取申请"}</button><button className="ghost-button wide" onClick={logout}>退出登录</button></div><div className="workflow-panel"><h2>入驻申请</h2><p className="helper-text">当前显示 {applications.length} 条申请。</p>{applications.length === 0 && <p className="empty-state">暂无可显示的申请。请先登录审核员账号，或确认商家已经提交申请。</p>}{applications.map((application) => <article className="audit-card" key={application.id}><strong>{application.company_name}</strong><p>状态：{application.status}</p><p>钱包：{application.owner_wallet}</p><p>营业执照：{application.license_id}</p><p>联系人：{application.contact_name} / {application.contact_phone}</p><p>资质说明：{application.qualification || "未填写"}</p><p>资质文件：{application.document_url || "未上传"}</p><div className="audit-actions"><button className="primary-button" onClick={() => updateStatus(application, "approved")}>通过</button><button className="ghost-button" onClick={() => updateStatus(application, "rejected")}>拒绝</button></div></article>)}</div></div></section>; // 返回审核页内容。
} // 审核页面组件结束。
