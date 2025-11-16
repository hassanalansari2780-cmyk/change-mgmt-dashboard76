import React from "react";

export function Input({className="", ...props}: any) {
  return <input className={`border px-3 py-2 rounded-2xl ${className}`} {...props} />;
}
