'use client';

import { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { useRouter } from 'next/navigation';
import Loader from '../common/Loader';
import {auth, db} from '../../lib/Firebase'
import { API_URL } from "@/server";

const PlaylistViewer = ({ playlistId }) => {
    const router = useRouter()
    const [playlistData, setPlaylistData] = useState({ videos: [] });
    const [playId, setPlayId] = useState(null);
    const [loading, setLoading] = useState(true);
    const [userId, setUserId] = useState("")

      useEffect(() => {
        const unsubscribe = auth.onAuthStateChanged(async (user) => {
          if (user) {
            setUserId(user.uid);
          }
            
        });
    
        return () => unsubscribe();
      }, []);

    useEffect(() => {
        const fetchPlaylistData = async () => {
            setLoading(true);
            try {
                const response = await axios.get(`${API_URL}/playlist/${playlistId}`);
                setPlaylistData(response.data);
            } catch (error) {
                console.error('Error fetching playlist:', error);
            } finally {
                setLoading(false);
            }
        };
        
        if (playlistId) fetchPlaylistData();
    }, [playlistId]);

    const transformPlaylistData = (playlistData, userId) => {
        const { playListName, channelName, playlistThumbnail, videos } = playlistData;
        const transformedVideos = {};

        videos.forEach(video => {
            if (video.videoThumbnail && video.videoTitle !== 'Private video' && video.videoTitle !== 'Deleted video') {
                transformedVideos[video.videoId] = {
                    channelName,
                    thumbnail: video.videoThumbnail,
                    title: video.videoTitle
                };
            }
        });

        

        return {
            userId,
            playlistData: {
                channelName,
                playThumbnail: playlistThumbnail,
                playName: playListName,
                videos: transformedVideos
            }
        };
    };


      const handleVideoClick = (videoId)=>{
        
            router.push(`/videoplayer/${videoId}`)
        
      }

    const savePlaylist = async () => {
        const unsubscribe = auth.onAuthStateChanged(async (user) => {
            if (user) {
              
              try {
                const playData = transformPlaylistData(playlistData, user.uid);
                const response = await axios.post(`${API_URL}/savePlaylist`, playData);
                setPlayId(response?.data?.playlistId);
                router.push(`/saved-playlist/${response?.data?.playlistId}`);
            } catch (error) {
                console.error('Error saving playlist:', error);
            }
            }
              
          });
        
    };

    const loadMoreVideos = async () => {
        if (!playlistData.nextPageToken || loading) return;
        setLoading(true);

        try {
            const response = await axios.get(`/api/playlist/${playlistId}`, {
                params: { pageToken: playlistData.nextPageToken }
            });
            
            setPlaylistData(prevData => ({
                ...prevData,
                nextPageToken: response.data.nextPageToken,
                videos: [...prevData.videos, ...response.data.videos]
            }));
        } catch (error) {
            console.error('Error loading more videos:', error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
        {loading && 
            <div className='flex items-center justify-center min-h-screen'>
            <Loader />
            </div>
        }
        <div className="flex text-white min-h-screen h-screen mt-10">
            
            
                <>
                    <div className="w-1/3 p-6 border-r border-green-200 sticky">
                        <div className="mb-6">
                            <img
                                src={playlistData.playlistThumbnail} 
                                alt="Playlist thumbnail" 
                                width={500} 
                                height={300} 
                                className="w-full h-auto rounded-md"
                            />
                        </div>
                        <div className="mb-6">
                            <h1 className="text-2xl font-bold mb-2">{playlistData.playListName}</h1>
                            <p className="text-gray-200">Channel Name: {playlistData.channelName}</p>
                            <p className="text-gray-200 mt-1">{playlistData.totalVideos} videos</p>
                        </div>
                        <button 
                            className="bg-green-400 text-black font-bold py-2 px-6 rounded-full hover:bg-green-500 transition" 
                            onClick={savePlaylist}
                        >
                            Start learning
                        </button>
                    </div>
                    <div className="w-2/3 p-6 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                        <div className="grid grid-cols-1 gap-10">
                            {playlistData.videos?.map((video, index) => (
                                <div onClick={()=>{
                                    handleVideoClick(video.videoId)
                                }} key={index} className="flex items-center space-x-4 border border-green-200 cursor-pointer rounded p-2">
                                    <div className="flex-shrink-0">
                                        <img
                                            src={video.videoThumbnail} 
                                            alt={`Thumbnail for ${video.videoTitle}`} 
                                            width={144} 
                                            height={90} 
                                            className="w-36 h-auto rounded-md"
                                        />
                                    </div>
                                    <div className='flex flex-col'>
                                        <h3 className="text-lg font-semibold">
                                            {video.videoTitle.length > 60 
                                                ? video.videoTitle.substring(0, 100) + '...' 
                                                : video.videoTitle}
                                        </h3>
                                        <p className="text-gray-400">{playlistData.channelName}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                        {playlistData.nextPageToken && (
                            <div className="mt-8 text-center">
                                <button 
                                    onClick={loadMoreVideos} 
                                    disabled={loading}
                                    className="bg-gray-800 hover:bg-gray-700 text-white font-bold py-2 px-8 rounded-md disabled:opacity-50"
                                >
                                    {loading ? 'Loading...' : 'Load More'}
                                </button>
                            </div>
                        )}
                    </div>
                </>
            
        </div>
        </>
    );
};

export default PlaylistViewer;
