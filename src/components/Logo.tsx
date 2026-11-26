import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { LOGO_SRC } from "@/lib/constants";

// Shows your logo from /public. If the file is missing, it falls back to the shield icon.
export function Logo({ className = "size-11" }: { className?: string }) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <span
        className={`${className} flex items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-400`}
      >
        <ShieldCheck className="size-1/2" />
      </span>
    );
  }
  return (
    <img
      src={LOGO_SRC}
      alt=""
      className={`${className} rounded-xl object-contain`}
      onError={() => setFailed(true)}
    />
  );
}