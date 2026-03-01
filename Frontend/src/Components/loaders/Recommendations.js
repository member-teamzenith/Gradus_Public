import React from "react";
import Skeleton from "../ui/Skeleton";

export function VideoSkeletonRow() {
  return (
    <div className="flex items-center bg-darkBlueGray rounded-[10px] mb-6 px-2 md:px-4 py-3 border border-white w-full">
      <Skeleton width="140px" height="80px" rounded="md" className="mr-2 md:mr-4" />
      <div className="flex-1">
        <Skeleton width="80%" height="16px" className="mb-2" />
        <Skeleton width="100px" height="28px" rounded="md" />
      </div>
    </div>
  );
}

function SectionSkeleton({ title }) {
  return (
    <div className="bg-darkBlueGray p-[15px] md:p-[25px] border border-white rounded-[12px] mb-[30px] w-full md:w-[400px]">
      <h3 className='text-white border-b-2 border-b-green-400 pb-[10px] mt-0'>{title}</h3>
      <div className="mt-[15px]">
        {[0,1,2].map((i) => (
          <VideoSkeletonRow key={i} />
        ))}
      </div>
    </div>
  );
}

export default function RecommendationsLoader() {
  return (
    <div className="w-full md:w-[28%] p-[10px] md:p-[20px] mr-0 top-[20px] relative right-0 self-start max-h-[600px] overflow-y-auto rec-scroll">
      {/* Category and Primary Topic Skeletons */}
      <div className="flex flex-row justify-start flex-wrap gap-[20px] mb-[20px] bg-darkBlueGray py-[15px] px-[10px] rounded-none w-full md:w-[400px] border border-white">
        <div className="bg-darkBlueGray p-[12px] rounded-[8px] w-full border border-white">
          <div className='mb-[8px] flex items-center'>
            <span className="mr-[8px] font-bold text-white text-sm">Category:</span>
            <Skeleton width="140px" height="16px" />
          </div>
          <div className='mb-0 flex items-center'>
            <span className="mr-[8px] font-bold text-white text-sm">Primary Topic:</span>
            <Skeleton width="180px" height="16px" />
          </div>
        </div>
      </div>

      {/* 3 sections x 3 rows = 9 placeholders */}
      <SectionSkeleton title="Similar Topic Videos" />
      <SectionSkeleton title="Prerequisite Videos" />
      <SectionSkeleton title="Next Topic Videos" />
    </div>
  );
}


