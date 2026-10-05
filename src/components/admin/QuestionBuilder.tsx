// Question builder: add, reorder and remove typed questions.
import { ChevronDown, ChevronUp, GripVertical, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { SelectField } from "@/components/field";
import { MuEmpty } from "@/components/admin/mu/MuShell";
import { art } from "@/components/mc/art";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Question, QuestionType, QUESTION_TYPE_LABELS, newQuestion } from "@/lib/matchmaker";

interface Props {
  value: Question[];
  onChange: (next: Question[]) => void;
}

const QuestionBuilder = ({ value, onChange }: Props) => {
  const patch = (i: number, q: Partial<Question>) => {
    const next = [...value];
    next[i] = { ...next[i], ...q };
    onChange(next);
  };

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= value.length) return;
    const next = [...value];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };

  const remove = (i: number) => onChange(value.filter((_, idx) => idx !== i));

  const add = (type: QuestionType) => onChange([...value, newQuestion(type)]);

  const setType = (i: number, type: QuestionType) => {
    const q = value[i];
    const needsOpts = type === "single_select" || type === "multi_select";
    patch(i, {
      type,
      options: needsOpts ? (q.options && q.options.length ? q.options : ["Option 1"]) : undefined,
    });
  };

  return (
    <div className="space-y-3">
      {value.length === 0 && (
        <div className="border border-dashed border-line bg-card">
          <MuEmpty
            art={art.objClipboard}
            title="No questions yet"
            description="Add the first question to gather structured answers from applicants."
          />
        </div>
      )}

      {value.map((q, i) => (
        <div key={q.id} className="border border-line bg-card p-4">
          <div className="flex items-start gap-2">
            <div className="flex flex-col items-center pt-1 text-muted-foreground">
              <GripVertical className="h-4 w-4 opacity-60" />
              <button type="button" onClick={() => move(i, -1)} className="hover:text-foreground" title="Move up" aria-label="Move up">
                <ChevronUp className="h-3.5 w-3.5" />
              </button>
              <button type="button" onClick={() => move(i, 1)} className="hover:text-foreground" title="Move down" aria-label="Move down">
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="flex-1 space-y-3">
              <div className="grid sm:grid-cols-[1fr_180px] gap-2">
                <Input
                  value={q.label}
                  onChange={(e) => patch(i, { label: e.target.value })}
                  aria-label={`Question ${i + 1}`}
                  placeholder={`Question ${i + 1}, for example: why are you a fit for this role?`}
                />
                <SelectField
                  label="Answer type"
                  hideLabel
                  value={q.type}
                  onChange={(v) => { if (v) setType(i, v as QuestionType); }}
                  options={Object.entries(QUESTION_TYPE_LABELS).map(([k, v]) => ({ value: k, label: v }))}
                />
              </div>

              <Input
                value={q.help || ""}
                onChange={(e) => patch(i, { help: e.target.value })}
                aria-label="Helper text"
                placeholder="Helper text (optional)"
                className="text-sm"
              />

              {(q.type === "single_select" || q.type === "multi_select") && (
                <div className="space-y-2 border-l-2 border-line pl-2">
                  {(q.options || []).map((opt, oi) => (
                    <div key={oi} className="flex items-center gap-2">
                      <Input
                        value={opt}
                        onChange={(e) => {
                          const opts = [...(q.options || [])];
                          opts[oi] = e.target.value;
                          patch(i, { options: opts });
                        }}
                        placeholder={`Option ${oi + 1}`}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        aria-label="Remove option"
                        onClick={() => patch(i, { options: (q.options || []).filter((_, x) => x !== oi) })}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => patch(i, { options: [...(q.options || []), `Option ${(q.options?.length || 0) + 1}`] })}
                  >
                    <Plus className="mr-1 h-3.5 w-3.5" />Add option
                  </Button>
                </div>
              )}

              <div className="flex items-center justify-between pt-1">
                <div className="flex items-center gap-2">
                  <Switch checked={q.required} onCheckedChange={(v) => patch(i, { required: v })} />
                  <span className="text-xs text-muted-foreground">{q.required ? "Required" : "Optional"}</span>
                </div>
                <Button type="button" variant="ghost" size="sm" className="text-destructive hover:text-destructive" aria-label="Remove question" onClick={() => remove(i)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      ))}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="outline" size="sm">
            <Plus className="mr-1 h-3.5 w-3.5" />Add question
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          {Object.entries(QUESTION_TYPE_LABELS).map(([k, v]) => (
            <DropdownMenuItem key={k} onClick={() => add(k as QuestionType)}>{v}</DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};

export default QuestionBuilder;
