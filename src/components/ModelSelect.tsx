import { useEffect, useState } from "react";
import { AI_MODELS } from "@/lib/models";
import { getJson } from "@/lib/api";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function ModelSelect({
  value,
  onChange,
  label = "Model AI",
  disabled = false,
}: {
  value: string;
  onChange: (v: string) => void;
  label?: string;
  disabled?: boolean;
}) {
  const [models, setModels] = useState<string[]>(AI_MODELS);
  const [source, setSource] = useState<"router" | "fallback" | "admin-allowed">("fallback");

  useEffect(() => {
    getJson<{ models: string[]; source: "router" | "fallback" | "admin-allowed" }>("/api/ai/models")
      .then((r) => {
        if (r.models?.length) setModels(r.models);
        setSource(r.source);
      })
      .catch(() => undefined);
  }, []);

  const options = value && !models.includes(value) ? [value, ...models] : models;

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Select value={value} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger disabled={disabled}>
          <SelectValue placeholder="Pilih model" />
        </SelectTrigger>
        <SelectContent>
          {options.map((m) => (
            <SelectItem key={m} value={m}>
              {m}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-xs text-muted-foreground">
        {source === "router"
          ? `Terdeteksi otomatis dari router (${models.length} model).`
          : source === "admin-allowed"
            ? `Model yang diizinkan Administrator (${models.length} model).`
            : "Memakai daftar cadangan. Simpan API Key agar model terdeteksi otomatis."}
      </p>
    </div>
  );
}
