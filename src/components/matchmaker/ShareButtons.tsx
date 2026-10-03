import { MessageCircle, Mail, Copy, Check } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { logShare } from "@/lib/matchmaker";

interface Props {
  opportunityId: string | null;
  title: string;
  url: string;
}

export const ShareButtons = ({ opportunityId, title, url }: Props) => {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();
  // No em dashes. Warmer phrasing for both single opportunities and the landing page.
  const isLanding = !opportunityId;
  const message = isLanding
    ? `Healthcare opportunities currently being placed through Medic Connect's Matchmakers Network. Worth a look:\n\n${url}`
    : `Sharing a healthcare opportunity I thought you'd want to see: ${title}.\n\nDetails and how to apply here:\n${url}`;

  const onWhatsApp = () => {
    logShare(opportunityId, "whatsapp");
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, "_blank", "noopener,noreferrer");
  };
  const onEmail = () => {
    logShare(opportunityId, "email");
    window.location.href = `mailto:?subject=${encodeURIComponent(`Opportunity: ${title}`)}&body=${encodeURIComponent(message)}`;
  };
  const onCopy = async () => {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
    logShare(opportunityId, "copy");
    toast({ title: "Link copied" });
  };

  return (
    <div className="flex flex-wrap gap-2">
      <Button onClick={onWhatsApp} variant="outline" size="sm" className="rounded-full">
        <MessageCircle className="mr-2 h-4 w-4" />Share on WhatsApp
      </Button>
      <Button onClick={onEmail} variant="outline" size="sm" className="rounded-full">
        <Mail className="mr-2 h-4 w-4" />Share by email
      </Button>
      <Button onClick={onCopy} variant="outline" size="sm" className="rounded-full">
        {copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
        {copied ? "Copied" : "Copy link"}
      </Button>
    </div>
  );
};

export default ShareButtons;
