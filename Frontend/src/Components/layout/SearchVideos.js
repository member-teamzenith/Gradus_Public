"use client";
import React from 'react';
import Link from 'next/link';

const formatDuration = (ms) => {
    if (!ms || typeof ms !== 'number' || ms <= 0) return null;
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    if (hours > 0) return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    return `${minutes}:${String(seconds).padStart(2, '0')}`;
};

const SearchVideos = ({ items = [] }) => {
    const fiveMinutesMs = 2 * 60 * 1000;
    const videos = Array.isArray(items)
        ? items.filter((v) => {
            const dur = typeof v?.duration === 'number' ? v.duration : 0;
            return dur >= fiveMinutesMs;
        }).slice(0, 25)
        : [];
    return (
        <div className="w-[90vw] max-w-[1600px] mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {videos.map((v, idx) => {
                const id = v?.id || v?.videoId || `item-${idx}`;
                const title = v?.title || v?.name || 'Untitled';
                const thumb = v?.thumbnail?.url || v?.thumbnail?.url?.url || v?.thumbnail_url || v?.thumb || v?.thumbnail || null;
                const channel = v?.channel?.name || v?.author || v?.uploader || '';
                const duration = formatDuration(typeof v?.duration === 'number' ? v.duration : 0);
                const href = id ? `/videoplayer/${id}` : '#';
                return (
                    <Link key={`${id}-${idx}`} href={href} className="group relative block aspect-[16/9] rounded-xl border border-green-300/30 hover:border-[#18cb96] transition-colors bg-black/20 backdrop-blur-md overflow-hidden transform transition-transform duration-300 ease-out hover:scale-105">
                        {/* Thumbnail */}
                        <div className="absolute inset-0 flex items-center justify-center bg-black">
                            {thumb ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={thumb} alt={title} className="w-full h-full object-contain" />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-gray-400">No thumbnail</div>
                            )}
                        </div>
                        {/* Duration badge */}
                        {duration && (
                            <span className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-0.5 rounded z-10">
                                {duration}
                            </span>
                        )}
                        {/* Centered hover CTA */}
                        <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
                            <span className="pointer-events-auto inline-block bg-[#18cb96] text-black font-semibold rounded-full px-4 py-2 text-sm sm:text-base transition-all opacity-0 scale-95 group-hover:opacity-100 group-hover:scale-100">
                                Watch Now
                            </span>
                        </div>
                        {/* Bottom overlay content */}
                        <div className="absolute inset-x-0 bottom-0 z-10 p-3 pb-2 bg-gradient-to-t from-black/90 via-black/70 to-transparent">
                            <h3 className="text-white text-base sm:text-lg font-semibold truncate" title={title}>{title}</h3>
                            {channel && (
                                <p className="text-gray-200 text-xs mt-0.5 truncate">{channel}</p>
                            )}
                        </div>
                    </Link>
                );
            })}
        </div>
    );
};

export default SearchVideos;
