import React from 'react';
import Skeleton from '../ui/Skeleton';
import Navbar from '../common/Navbar';

const VideoPlayerLoader = () => {
    return (
        <div className="bg-black min-h-screen" style={{ background: 'black', backgroundImage: 'none' }}>
            <style jsx global>{`
                /* Hide scrollbar for the entire page */
                html, body {
                    scrollbar-width: none; /* Firefox */
                    -ms-overflow-style: none; /* Internet Explorer 10+ */
                }
                html::-webkit-scrollbar, body::-webkit-scrollbar {
                    display: none; /* WebKit */
                }
            `}</style>
            <Navbar />
            
            <div className='relative'>
                {/* Video Player Section and Controls */}
                <div className="flex flex-col md:flex-row gap-[20px] mb-[30px] text-white items-start">
                    {/* Video Player Container */}
                    <div className="w-full md:w-[70%] mb-[30px] px-4 md:pl-[50px]">
                        <div className="flex gap-[15px] w-full p-[10px] items-start bg-[#121212] mt-[20px] h-[300px] sm:h-[400px] md:h-[550px]">
                            {/* Video Player Skeleton */}
                            <Skeleton 
                                width="100%" 
                                height="100%" 
                                rounded="none" 
                                className="bg-gray-600 dark:bg-gray-800" 
                            />
                        </div>
                        
                        {/* Video Title Skeleton */}
                        <div className="mx-[15px] my-0 px-0 py-[1px]">
                            <Skeleton 
                                width="80%" 
                                height="2rem" 
                                rounded="md" 
                                className="my-[10px]" 
                            />
                        </div>
                        
                        {/* Action Buttons Skeleton */}
                        <div className="flex flex-col sm:flex-row gap-[12px] mt-[8px]">
                            <Skeleton width="120px" height="40px" rounded="full" />
                            <Skeleton width="160px" height="40px" rounded="full" />
                            <Skeleton width="80px" height="40px" rounded="full" />
                        </div>
                    </div>

                    {/* Notes Container Skeleton - Hidden on small screens, shown on medium+ */}
                    <div className="hidden md:block w-[30%] p-[15px] bg-darkBlueGray h-[525px] border border-white mt-[20px] text-white rounded-3xl">
                        <div className="flex justify-between align-center mb-[15px]">
                            <Skeleton width="60px" height="1.5rem" rounded="md" />
                            <Skeleton width="150px" height="32px" rounded="full" />
                        </div>
                        <Skeleton 
                            width="100%" 
                            height="440px" 
                            rounded="md" 
                            className="bg-gray-700 dark:bg-gray-800" 
                        />
                    </div>
                </div>

                {/* Desktop Layout - Hidden on small screens */}
                <div className='hidden md:flex gap-0 m-0 justify-between'>
                    <div className='flex flex-col gap-[12px] w-[70%] h-auto relative left-0'>
                        {/* Tab Buttons Skeleton */}
                        <div className='flex gap-[8px] ml-4'>
                            <Skeleton width="100px" height="40px" rounded="md" />
                            <Skeleton width="80px" height="40px" rounded="md" />
                        </div>

                        {/* Content Area Skeleton */}
                        <div className="w-full h-[580px] bg-darkBlueGray border border-white rounded-md">
                            <div className="p-4 space-y-4">
                                <Skeleton width="100%" height="2rem" rounded="md" />
                                <Skeleton width="100%" height="1.5rem" rounded="md" />
                                <Skeleton width="95%" height="1.5rem" rounded="md" />
                                <Skeleton width="90%" height="1.5rem" rounded="md" />
                                <div className="space-y-2 mt-6">
                                    <Skeleton width="100%" height="1rem" rounded="md" />
                                    <Skeleton width="98%" height="1rem" rounded="md" />
                                    <Skeleton width="96%" height="1rem" rounded="md" />
                                    <Skeleton width="94%" height="1rem" rounded="md" />
                                    <Skeleton width="92%" height="1rem" rounded="md" />
                                </div>
                                <div className="space-y-2 mt-6">
                                    <Skeleton width="85%" height="1rem" rounded="md" />
                                    <Skeleton width="88%" height="1rem" rounded="md" />
                                    <Skeleton width="91%" height="1rem" rounded="md" />
                                    <Skeleton width="87%" height="1rem" rounded="md" />
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    {/* Recommendations Skeleton */}
                    <div className="w-[30%] p-[15px] bg-darkBlueGray border border-white rounded-3xl mt-[52px] h-[580px]">
                        <div className="space-y-4">
                            <Skeleton width="80%" height="1.5rem" rounded="md" />
                            <div className="space-y-3">
                                <Skeleton width="100%" height="60px" rounded="md" />
                                <Skeleton width="100%" height="60px" rounded="md" />
                                <Skeleton width="100%" height="60px" rounded="md" />
                                <Skeleton width="100%" height="60px" rounded="md" />
                            </div>
                            <div className="mt-6 space-y-3">
                                <Skeleton width="70%" height="1.25rem" rounded="md" />
                                <Skeleton width="100%" height="40px" rounded="md" />
                                <Skeleton width="100%" height="40px" rounded="md" />
                                <Skeleton width="100%" height="40px" rounded="md" />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Mobile Layout - Visible only on small screens */}
                <div className='md:hidden flex flex-col gap-[12px] w-full px-4'>
                    {/* Mobile Toggle Buttons Skeleton */}
                    <div className='flex gap-[8px] overflow-x-auto'>
                        <Skeleton width="80px" height="36px" rounded="md" />
                        <Skeleton width="70px" height="36px" rounded="md" />
                        <Skeleton width="120px" height="36px" rounded="md" />
                        <Skeleton width="60px" height="36px" rounded="md" />
                    </div>

                    {/* Mobile Content Container Skeleton */}
                    <div className="w-full h-[400px] bg-darkBlueGray border border-white rounded-md">
                        <div className="p-4 space-y-4">
                            <Skeleton width="100%" height="1.5rem" rounded="md" />
                            <Skeleton width="95%" height="1.25rem" rounded="md" />
                            <Skeleton width="90%" height="1.25rem" rounded="md" />
                            <div className="space-y-2 mt-4">
                                <Skeleton width="100%" height="1rem" rounded="md" />
                                <Skeleton width="98%" height="1rem" rounded="md" />
                                <Skeleton width="96%" height="1rem" rounded="md" />
                                <Skeleton width="94%" height="1rem" rounded="md" />
                            </div>
                            <div className="space-y-2 mt-4">
                                <Skeleton width="88%" height="1rem" rounded="md" />
                                <Skeleton width="92%" height="1rem" rounded="md" />
                                <Skeleton width="85%" height="1rem" rounded="md" />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default VideoPlayerLoader;
