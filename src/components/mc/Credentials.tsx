import { Stamp } from "@/components/mc/brand";

/** Credentials, each a fact Medic Connect already publishes (see llms.txt). */
const credentials = [
  { title: "HEFAMAA", sub: "ACCREDITED", text: "Licensed and accredited by HEFAMAA, Lagos State's health facility regulator." },
  { title: "INSURED", sub: "INDEMNITY COVER", text: "Medic Connect holds professional indemnity insurance." },
  { title: "HFN", sub: "MEMBER", text: "A member of the Healthcare Federation of Nigeria." },
  { title: "VETTED", sub: "EVERY PROFESSIONAL", text: "Identity, registration, qualifications and references checked for every professional." },
];

/** The four credential stamps with a line each: a 2 by 2 grid on phones, one row on desktop. */
const Credentials = ({ className }: { className?: string }) => (
  <ul className={className ?? "grid grid-cols-2 gap-x-4 gap-y-8 lg:grid-cols-4 lg:gap-8"}>
    {credentials.map((c, i) => (
      <li key={c.title} className="flex flex-col gap-4">
        <Stamp title={c.title} sub={c.sub} tone={i % 2 ? "navy" : "blue"} tilt={i % 2 ? 4 : -5} className="self-start bg-white" />
        <p className="text-[14px] leading-[1.55] text-body lg:text-[15px]">{c.text}</p>
      </li>
    ))}
  </ul>
);

export default Credentials;
