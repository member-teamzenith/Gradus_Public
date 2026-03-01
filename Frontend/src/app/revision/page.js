'use client';

import RecentVideos from "@/Components/sections/RecentVideos";
import PreviousVideos from "@/Components/sections/PreviousVideos";
import Navbar from "@/Components/common/Navbar";

const RevsiePage = () => {
    return (
        <div>
            <Navbar />
            <div>
                <RecentVideos />
                <PreviousVideos />
            </div>
            
        </div>
    )
}

export default RevsiePage