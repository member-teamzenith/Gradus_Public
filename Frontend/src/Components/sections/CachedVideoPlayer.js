import React, { memo } from 'react';

const CachedVideoPlayer = memo(({ videoUrl }) => {
    // Debug log to show when the player renders (or comes from cache)
    console.log('[UI Cache] Rendering Video Player', videoUrl);

    return (
        <div className="flex gap-[15px] w-full p-[10px] items-start bg-[#121212] mt-[20px] h-[300px] sm:h-[400px] md:h-[550px]">
            <iframe
                id="player"
                allowFullScreen
                className="w-full h-full border-0"
                src={videoUrl}
                title="Video player"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            />
        </div>
    );
}, (prevProps, nextProps) => {
    const isEqual = prevProps.videoUrl === nextProps.videoUrl;
    if (isEqual) {
        console.log('[UI Cache] Hit! Video player retrieved from cache.');
    }
    return isEqual;
});

CachedVideoPlayer.displayName = 'CachedVideoPlayer';

export default CachedVideoPlayer;
