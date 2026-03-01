// components/ui/Skeleton.js
import React from "react";

const Skeleton = ({ width = "100%", height = "1rem", rounded = "md", className = "" }) => {
  return (
    <div
      className={`animate-pulse bg-gray-300 dark:bg-gray-700 rounded-${rounded} ${className}`}
      style={{ width, height }}
    />
  );
};

export default Skeleton;
