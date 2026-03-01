import React from "react";
import Skeleton from "../ui/Skeleton";

const ProfileLoader = () => {
    return (
        <div className="bg-darkBlueGray h-[calc(100vh-4rem)] overflow-hidden px-2 sm:px-4 md:px-6 lg:px-8 py-4 sm:py-6">
            {/* Mobile layout */}
            <div className="block xl:hidden space-y-4 sm:space-y-6">
                {/* Profile card */}
                <div className="bg-darkBlueGray border border-white rounded-2xl sm:rounded-3xl p-4 sm:p-6 text-center mx-auto max-w-md">
                    <div className="mx-auto mb-4 sm:mb-6 flex items-center justify-center">
                        <Skeleton width="8rem" height="8rem" rounded="full" className="sm:w-[8rem] sm:h-[8rem]" />
                    </div>
                    <div className="space-y-2 sm:space-y-3">
                        <Skeleton width="60%" height="1.5rem" className="mx-auto" />
                        <Skeleton width="70%" height="1.1rem" className="mx-auto" />
                        <Skeleton width="40%" height="1.1rem" className="mx-auto" />
                    </div>
                    <div className="mt-4 sm:mt-6 flex justify-center">
                        <Skeleton width="9rem" height="2.25rem" rounded="full" />
                    </div>
                </div>

                {/* Stats + heatmap */}
                <div className="bg-darkBlueGray border border-white rounded-2xl sm:rounded-3xl p-4 sm:p-6 mx-auto max-w-4xl">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mb-4 sm:mb-6 text-center">
                        <Skeleton width="100%" height="4.5rem" className="rounded-lg" />
                        <Skeleton width="100%" height="4.5rem" className="rounded-lg" />
                        <Skeleton width="100%" height="4.5rem" className="rounded-lg sm:col-span-2 lg:col-span-1" />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-4 sm:mb-6">
                        <Skeleton width="100%" height="6rem" className="rounded-lg" />
                        <Skeleton width="100%" height="6rem" className="rounded-lg" />
                    </div>
                    <div className="border border-green-400 rounded-lg p-2 sm:p-4">
                        <Skeleton width="100%" height="10rem" className="rounded-md" />
                    </div>
                </div>

                {/* Badges Container - Mobile */}
                <div className="bg-darkBlueGray border border-white rounded-2xl sm:rounded-3xl p-6 sm:p-8 mx-auto max-w-4xl min-h-[200px] sm:min-h-[250px]">
                    <div className="text-center">
                        <Skeleton width="8rem" height="1.5rem" className="mx-auto mb-4" />
                        <div className="flex justify-center items-center gap-6">
                            <Skeleton width="7rem" height="7rem" rounded="full" className="sm:w-8 sm:h-8 md:w-9 md:h-9" />
                            <Skeleton width="7rem" height="7rem" rounded="full" className="sm:w-8 sm:h-8 md:w-9 md:h-9" />
                        </div>
                    </div>
                </div>
            </div>

            {/* Desktop layout */}
            <div className="hidden xl:block">
                <div className="grid grid-cols-7 grid-rows-5 gap-4">
                    <div className="col-span-2 row-span-5 bg-darkBlueGray border border-white h-[35rem] relative top-5 left-4 rounded-3xl text-center flex flex-col items-center justify-center p-6">
                        <Skeleton width="10rem" height="10rem" rounded="full" className="mb-6" />
                        <div className="w-full flex flex-col items-center gap-3 mb-6">
                            <Skeleton width="60%" height="1.5rem" />
                            <Skeleton width="70%" height="1.1rem" />
                            <Skeleton width="40%" height="1.1rem" />
                        </div>
                        <Skeleton width="10rem" height="2.5rem" rounded="full" />
                    </div>

                    <div className="col-span-5 row-span-3 col-start-3 bg-darkBlueGray border border-white h-[22rem] relative top-5 left-5 w-[95%] rounded-3xl p-6">
                        <div className="grid grid-cols-6 grid-rows-1 gap-4 relative top-2 left-[18.5rem] w-[70%] text-center">
                            <Skeleton width="100%" height="2.5rem" className="col-span-2" />
                            <Skeleton width="100%" height="2.5rem" className="col-span-2 col-start-3" />
                            <Skeleton width="100%" height="2.5rem" className="col-span-2 col-start-5" />
                        </div>
                        <div className="grid grid-cols-7 grid-rows-4 gap-4 relative top-7">
                            <Skeleton width="100%" height="8rem" className="col-span-2 row-span-2 rounded-lg" />
                            <Skeleton width="100%" height="8rem" className="col-span-2 row-span-2 col-start-1 row-start-3 rounded-lg relative bottom-4" />
                            <div className="col-span-5 row-span-4 col-start-3 row-start-1 border border-green-400 h-[16rem] rounded-lg relative right-3 overflow-hidden p-4">
                                <Skeleton width="100%" height="100%" className="rounded-md" />
                            </div>
                        </div>
                    </div>

                    {/* Badges Section - Desktop */}
                    <div className="col-span-5 row-span-2 col-start-3 row-start-4 bg-darkBlueGray border border-white h-[14rem] relative top-5 left-5 w-[95%] rounded-3xl flex items-center justify-center">
                        <div className="text-center">
                            <Skeleton width="8rem" height="1.5rem" className="mx-auto mb-4" />
                            <div className="flex justify-center items-center gap-6">
                                <Skeleton width="7rem" height="7rem" rounded="full" className="sm:w-8 sm:h-8 md:w-9 md:h-9" />
                                <Skeleton width="7rem" height="7rem" rounded="full" className="sm:w-8 sm:h-8 md:w-9 md:h-9" />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default ProfileLoader;


