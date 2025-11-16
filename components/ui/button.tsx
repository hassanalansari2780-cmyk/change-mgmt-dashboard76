import React from "react";

export function Button({className="", ...props}: any) {
  return <button className={`px-4 py-2 rounded-2xl bg-black text-white ${className}`} {...props} />;
}
