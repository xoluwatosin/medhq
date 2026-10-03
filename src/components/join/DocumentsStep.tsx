import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Upload, FileText, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface DocumentsStepProps {
  data: { cvUrl: string; cvFileName: string; message: string; declarationAccepted: boolean };
  errors: Record<string, string | undefined>;
  onChange: (field: string, value: any) => void;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ACCEPTED_TYPES = ["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];

const DocumentsStep = ({ data, errors, onChange }: DocumentsStepProps) => {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError("");
    if (!ACCEPTED_TYPES.includes(file.type)) { setUploadError("Only PDF, DOC, or DOCX files are accepted."); return; }
    if (file.size > MAX_FILE_SIZE) { setUploadError("File must be under 10 MB."); return; }
    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `cvs/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("applications").upload(path, file, { cacheControl: "3600", upsert: false });
    if (error) {
      setUploadError("Upload failed. Please try again.");
      if (import.meta.env.DEV) console.error("CV upload error:", error);
    } else {
      onChange("cvUrl", path);
      onChange("cvFileName", file.name);
    }
    setUploading(false);
  };

  return (
    <div className="space-y-6">
      <h3 className="text-xl font-semibold">Documents &amp; Declaration</h3>
      <div className="space-y-2">
        <Label>Upload your CV (PDF, DOC, DOCX, max 10 MB) *</Label>
        {data.cvUrl ? (
          <div className="flex items-center gap-2 p-3 rounded-xl border bg-background">
            <FileText className="h-5 w-5 text-primary" />
            <span className="text-sm flex-1 truncate">{data.cvFileName || "CV uploaded"}</span>
            <label className="text-xs text-primary cursor-pointer hover:underline">Replace<input type="file" className="hidden" accept=".pdf,.doc,.docx" onChange={handleFileChange} /></label>
          </div>
        ) : (
          <label className={`flex flex-col items-center gap-2 p-6 rounded-xl border-2 border-dashed cursor-pointer hover:border-primary bg-background ${errors.cvUrl ? "border-destructive" : "border-border"}`}>
            {uploading ? <Loader2 className="h-8 w-8 animate-spin text-primary" /> : <Upload className="h-8 w-8 text-muted-foreground" />}
            <span className="text-sm text-muted-foreground">{uploading ? "Uploading..." : "Click to upload your CV"}</span>
            <input type="file" className="hidden" accept=".pdf,.doc,.docx" onChange={handleFileChange} disabled={uploading} />
          </label>
        )}
        {uploadError && <p className="text-destructive text-sm">{uploadError}</p>}
        {errors.cvUrl && <p className="text-destructive text-sm">{errors.cvUrl}</p>}
      </div>

      <div className="space-y-1.5">
        <Label>Cover note / additional message (optional)</Label>
        <Textarea value={data.message} onChange={(e) => onChange("message", e.target.value)} maxLength={1000} rows={4} className="rounded-xl bg-background" placeholder="Anything else you'd like us to know?" />
        <p className="text-xs text-muted-foreground text-right">{data.message.length}/1000</p>
      </div>

      <div className="space-y-2 p-4 rounded-xl border bg-muted/50">
        <label className="flex items-start gap-3 cursor-pointer">
          <Checkbox checked={data.declarationAccepted} onCheckedChange={(checked) => onChange("declarationAccepted", !!checked)} className="mt-0.5" />
          <span className="text-sm leading-relaxed">I certify that the information provided is true and accurate to the best of my knowledge. I understand that any false information may result in disqualification or termination.</span>
        </label>
        {errors.declarationAccepted && <p className="text-destructive text-sm">{errors.declarationAccepted}</p>}
      </div>
    </div>
  );
};

export default DocumentsStep;
