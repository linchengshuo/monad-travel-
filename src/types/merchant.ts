export type MerchantApplicationStatus = "pending" | "approved" | "rejected"; // 定义商家申请状态，只能是待审核、通过、拒绝。

export interface MerchantApplicationInput { // 定义商家提交入驻时需要填写的数据。
  owner_wallet: string; // 商家钱包地址。
  company_name: string; // 商家名称。
  license_id: string; // 营业执照编号。
  contact_name: string; // 联系人姓名。
  contact_phone: string; // 联系人电话。
  qualification: string; // 资质说明。
  document_url: string; // 资质文件链接。
  hotel_contract_address?: string; // 酒店链上合约地址；审核通过后由商家钱包创建合约并写回。
} // 商家提交数据定义结束。

export interface MerchantApplicationRecord extends MerchantApplicationInput { // 定义数据库里完整的商家申请记录。
  id: string; // 申请编号。
  status: MerchantApplicationStatus; // 审核状态。
  reviewer_note: string; // 审核备注。
  reviewed_by: string | null; // 审核人员编号。
  reviewed_at: string | null; // 审核时间。
  created_at: string; // 创建时间。
  updated_at: string; // 更新时间。
} // 商家申请记录定义结束。
