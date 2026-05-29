import { COMPANY } from "@/lib/site";

export default function LegalInfo() {
  const rows: Array<[string, string]> = [
    ["公司名稱", COMPANY.companyName],
    ["品牌名稱", COMPANY.siteName],
    ["網站", COMPANY.url],
    ["旅行業種類", COMPANY.agencyType],
    ["旅行業註冊編號", COMPANY.registrationNo],
    ["統一編號", COMPANY.taxId],
    ["公司地址", COMPANY.address],
    ["電話", COMPANY.phone],
    ["傳真", COMPANY.fax],
    ["Email", COMPANY.email],
    ["聯絡人", COMPANY.contactPerson],
    ["品保協會會員編號", "北2760"],
    ["履約保證保險", COMPANY.performanceBond],
    ["責任保險", COMPANY.liabilityInsurance || "待補充"],
  ];

  return (
    <section className="legal-info" aria-label="旅行業法定資訊">
      <h2 className="legal-info__title">旅行業法定資訊</h2>
      <dl className="legal-info__grid">
        {rows.map(([label, value]) => (
          <div className="legal-info__row" key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
