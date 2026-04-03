"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import type { FormData, FormField } from "@/lib/types";

interface InlineFormProps {
  form: FormData;
  onSubmit: (values: Record<string, string | boolean>) => void;
}

export default function InlineForm({ form, onSubmit }: InlineFormProps) {
  const [values, setValues] = useState<Record<string, string | boolean>>({});

  const handleChange = (name: string, value: string | boolean) => {
    setValues((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(values);
  };

  return (
    <div className="my-4 rounded-xl border border-[#2C2B27] bg-[#1A1917] p-5">
      <h4 className="font-display text-sm text-[#D4A07A] mb-4">
        {form.title}
      </h4>
      <form onSubmit={handleSubmit} className="space-y-4">
        {form.fields.map((field) => (
          <div key={field.name} className="space-y-2">
            <Label className="text-xs text-[#9C9789] uppercase tracking-wider">
              {field.label}
            </Label>
            {renderField(field, values[field.name], (val) =>
              handleChange(field.name, val)
            )}
          </div>
        ))}
        <Button
          type="submit"
          className="w-full bg-[#C17F59] hover:bg-[#D4A07A] text-[#0F0F0E] font-medium tracking-wider uppercase text-xs py-5 rounded-full transition-all"
        >
          Run Analysis
        </Button>
      </form>
    </div>
  );
}

function renderField(
  field: FormField,
  value: string | boolean | undefined,
  onChange: (val: string | boolean) => void
) {
  switch (field.type) {
    case "select":
      return (
        <Select
          value={value as string}
          onValueChange={(val) => onChange(val ?? "")}
        >
          <SelectTrigger className="bg-[#22211E] border-[#2C2B27] text-[#F5F0EB]">
            <SelectValue placeholder={`Select ${field.label}`} />
          </SelectTrigger>
          <SelectContent className="bg-[#22211E] border-[#2C2B27]">
            {field.options?.map((opt) => (
              <SelectItem
                key={opt}
                value={opt}
                className="text-[#F5F0EB] focus:bg-[#2C2B27] focus:text-[#D4A07A]"
              >
                {opt}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    case "input":
      return (
        <Input
          value={(value as string) || ""}
          onChange={(e) => onChange(e.target.value)}
          className="bg-[#22211E] border-[#2C2B27] text-[#F5F0EB] focus:border-[#C17F59]"
          placeholder={field.defaultValue || ""}
        />
      );
    case "number":
      return (
        <Input
          type="number"
          value={(value as string) || ""}
          onChange={(e) => onChange(e.target.value)}
          className="bg-[#22211E] border-[#2C2B27] text-[#F5F0EB] focus:border-[#C17F59]"
        />
      );
    case "checkbox":
      return (
        <div className="flex items-center gap-2">
          <Checkbox
            checked={value as boolean}
            onCheckedChange={(checked) => onChange(!!checked)}
            className="border-[#2C2B27] data-[state=checked]:bg-[#C17F59] data-[state=checked]:border-[#C17F59]"
          />
          <span className="text-sm text-[#9C9789]">{field.label}</span>
        </div>
      );
    default:
      return null;
  }
}
