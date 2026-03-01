import React from "react";
import Skeleton from "../ui/Skeleton";

const SearchVideosLoader = ({ count = 9 }) => {
    const items = Array.from({ length: count });
    return (
        <div className="w-[90vw] max-w-[1600px] mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {items.map((_, idx) => (
                <div key={idx} className="relative block aspect-[16/9] rounded-xl border border-green-300/20 bg-black/20 overflow-hidden">
                    <Skeleton className="absolute inset-0" width="100%" height="100%" rounded="xl" />
                    <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/70 via-black/40 to-transparent">
                        <Skeleton width="80%" height="0.9rem" className="mb-2" />
                        <Skeleton width="50%" height="0.75rem" />
                    </div>
                </div>
            ))}
        </div>
    );
};

export default SearchVideosLoader;


