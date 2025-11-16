import React from "react";

export function Card({className="", ...props}: any) {
  return <div className={`rounded-2xl border bg-white shadow ${className}`} {...props} />;
}
export function CardContent({className="", ...props}: any) {
  return <div className={`p-4 ${className}`} {...props} />;
}
