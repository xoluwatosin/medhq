import { NotchTag } from "@/components/mc/brand";
import { cn } from "@/lib/utils";
import type { GovernedFee } from "@/content/seo/governed-modules";

/**
 * What care costs: example fees as "from" prices, or a quoted panel when no
 * fee is published, with the one-off home assessment always shown apart so
 * the two are never confused. Shared by the service pages and the SEO pages.
 */
const FeePanel = ({ fees, quoted }: { fees: GovernedFee[]; quoted?: string }) => (
  <div className="grid gap-5 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:gap-7">
    <div>
      {fees.length > 0 ? (
        <>
        <p className="text-[13px] font-extrabold uppercase tracking-[0.14em] text-brand">Care, by way of example</p>
        <ul className={cn("mt-3 grid grid-cols-1 gap-2.5 sm:gap-4", fees.length === 4 || fees.length === 2 ? "sm:grid-cols-2" : "sm:grid-cols-3")}>
          {fees.map((f) => (
            <li key={f.sku} className="flex items-center justify-between gap-3 border-2 border-navy bg-white px-4 py-3 sm:flex-col sm:items-stretch sm:justify-start sm:gap-2 sm:p-5">
              {/* Prices read as "from" with no hours or units, so the label drops any duration too. */}
              <p className="text-[16px] font-extrabold leading-[1.25] text-navy">{f.label.replace(/,\s*\d+\s*hours?$/i, "")}</p>
              <p className="shrink-0 whitespace-nowrap text-[22px] font-black tracking-[-0.04em] text-price tabular-nums sm:mt-auto sm:pt-2 sm:text-[28px]">
                <span className="mr-1.5 text-[15px] font-bold tracking-normal text-ink">from</span>₦{f.amountNaira.toLocaleString("en-NG")}
              </p>
            </li>
          ))}
        </ul>
        </>
      ) : (
        <div className="flex h-full flex-col justify-center gap-2 border-2 border-navy bg-white p-6">
          <p className="text-[13px] font-extrabold uppercase tracking-[0.14em] text-brand">The care</p>
          <p className="text-[26px] font-black leading-[1.1] tracking-[-0.04em] text-navy">Quoted after the assessment</p>
          <p className="text-[15.5px] leading-[1.6] text-body">{quoted}</p>
        </div>
      )}
    </div>
    <div className="relative mt-4 flex flex-col gap-3 bg-navy p-6 pt-8 shadow-offset-blue lg:mt-0">
      <NotchTag tone="tint" outlined size="sm" className="absolute -top-3 left-6">
        One-off, before care starts
      </NotchTag>
      <p className="text-[18px] font-extrabold leading-[1.25] text-white">The home assessment</p>
      <p className="text-[34px] font-black tracking-[-0.04em] text-white tabular-nums">₦35,000</p>
      <p className="text-[15px] leading-[1.6] text-body-navy">
        A care coordinator visits once, before any care begins, to understand the needs and the home and agree the care
        plan with you. It is separate from the price of the care itself.
      </p>
    </div>
  </div>
);

export default FeePanel;
