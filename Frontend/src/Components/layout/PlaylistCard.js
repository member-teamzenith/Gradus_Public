"use client";

import Link from "next/link";

const PlaylistCard = ({ playlist, playlistId }) => {
  console.log(playlistId)
  return (
    <Link href={`/playlist/${playlistId}`} className="min-w-[380px] w-[380px] flex flex-col rounded-lg border border-green-200 transition-transform hover:scale-105">
      <div className="w-full aspect-video p-2 rounded-lg overflow-hidden">
        <img
          src={playlist?.playThumbnail}
          width={380} 
          height={214} 
          className="w-full h-full object-cover rounded-md"
          alt="Playlist Thumbnail"
          
        />
      </div>
      <div className="p-2">
        <h1 className="text-white text-base font-medium line-clamp-2">
          {playlist?.playName.slice(0, 40)}..
        </h1>
        <p className="text-green-200 font-bold text-sm mt-1">{playlist?.channelName || 'dummy channel'}</p>
      </div>
    </Link>
  );
};

export default PlaylistCard;