"use client";

import { useState } from "react";

export function PortalSearch({ label, placeholder, onSearch, admin = false }: {
  label: string;
  placeholder: string;
  onSearch: (query: string) => void;
  admin?: boolean;
}) {
  const [value, setValue] = useState("");
  return <form role="search" aria-label={label}
    className={admin ? "admin-toolbar" : "mt-6 mb-6 flex flex-wrap items-center gap-3"}
    onSubmit={(event) => { event.preventDefault(); onSearch(value.trim()); }}>
    <label className={admin ? "admin-customer-search" : "min-w-0 flex-[1_1_240px] max-w-xl"}>
      <span className="sr-only">{label}</span>
      <input type="search" value={value} maxLength={80} placeholder={placeholder}
        className="min-h-12 w-full rounded border border-border bg-transparent px-3"
        onChange={(event) => {
          setValue(event.target.value);
          if (!event.target.value) onSearch("");
        }} />
    </label>
    <button type="submit" className={admin ? "admin-button" : "bg-cocoa text-cream min-h-12 rounded px-5 font-semibold"}>Search</button>
    {value && <button type="button"
      className={admin ? "admin-button admin-button-secondary" : "min-h-12 rounded border border-border px-4 font-semibold"}
      onClick={() => { setValue(""); onSearch(""); }}>Clear</button>}
  </form>;
}
