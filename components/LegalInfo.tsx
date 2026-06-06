import { COMPANY } from "@/lib/site";

export default function LegalInfo() {
  const rows: Array<[string, string]> = [
    ["旅行社", COMPANY.companyName],
    ["車隊", COMPANY.fleetCompanyName],
    ["品牌", COMPANY.siteName],
    ["統一編號", COMPANY.taxId],
    ["品保會員", COMPANY.memberVerify],
    ["履約保證", COMPANY.performanceBond],
    ["電話", COMPANY.phone],
    ["傳真", COMPANY.fax],
    ["Email", COMPANY.email],
    ["地址", COMPANY.address],
  ];

  return (
    <section className="legal-info" aria-label="公司合法資訊">
      <h2 className="legal-info__title">公司資訊</h2>
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
