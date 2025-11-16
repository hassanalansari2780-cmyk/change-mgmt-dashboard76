import React from "react";

export function Progress({value}: {value:number}) {
  return (
    <div className="w-full h-2 bg-gray-200 rounded">
      <div className="h-2 bg-green-600 rounded" style={{width: `${value}%`}}></div>
    </div>
  );
}
