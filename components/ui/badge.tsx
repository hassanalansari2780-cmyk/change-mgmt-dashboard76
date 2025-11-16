import React from "react";

export function Badge({className="", ...props}: any) {
  return <span className={`px-2 py-1 rounded-2xl text-xs bg-gray-200 ${className}`} {...props} />;
}
