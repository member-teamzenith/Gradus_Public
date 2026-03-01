"use client"

import React, { useState, useEffect, useCallback } from 'react';
import { searchRecommendations } from '@/utils/recommendations';
import { saveRecommendations } from '@/services/videoPlayerServices';
import Link from 'next/link';
import RecommendationsLoader, { VideoSkeletonRow } from "../../loaders/Recommendations";
import Skeleton from "../../ui/Skeleton";

const VideoRecommendation = ({ videoId, userId, recommendations, insufficientTokens = false, transcriptFailed = false }) => {
    const [subjectCategory, setSubjectCategory] = useState("");
    const [primaryTopic, setPrimaryTopic] = useState("");
    const [similarTopicsObj, setSimilarTopicsObj] = useState({});
    const [prerequisiteTopicsObj, setPrerequisiteTopicsObj] = useState({});
    const [nextTopicsObj, setNextTopicsObj] = useState({});
    const [isLoading, setIsLoading] = useState(false);

    // Fetch recommendations function using /search API
    const fetchRecommendations = useCallback(async (videoId, passedRecommendations) => {
        // console.log('fetchRecommendations called with videoId:', videoId);

        try {
            setIsLoading(true);

            // Use passed recommendations directly since we're not fetching from backend anymore
            if (passedRecommendations) {
                // console.log('Using passed recommendations');
                const recData = {
                    subjectCategory: passedRecommendations.subjectCategory || "",
                    primaryTopic: passedRecommendations.primaryTopic || "",
                    similarTopics: passedRecommendations.similarTopics || [],
                    prerequisiteTopics: passedRecommendations.prerequisiteTopics || [],
                    nextTopics: passedRecommendations.nextTopics || []
                };

                // Save recommendations to Redis cache (only if they have actual content)
                const hasContent = recData.subjectCategory ||
                    recData.primaryTopic ||
                    recData.similarTopics.length > 0 ||
                    recData.prerequisiteTopics.length > 0 ||
                    recData.nextTopics.length > 0;

                if (hasContent) {
                    try {
                        await saveRecommendations(videoId, recData);
                        // console.log('Recommendations saved to Redis cache');
                    } catch (saveError) {
                        // console.error('Failed to save recommendations to cache:', saveError);
                        // Non-fatal error, continue with displaying recommendations
                    }
                }

                return recData;
            }

            return null;
        } catch (error) {
            // console.error("Recommendations generation error:", error);
            throw error;
        } finally {
            setIsLoading(false);
        }
    }, []);

    // Initialize recommendations when videoId changes
    useEffect(() => {
        if (!videoId) return;
        if (insufficientTokens) return; // skip fetching when we know budget blocks generation

        const initializeRecommendations = async () => {
            try {
                const recData = await fetchRecommendations(videoId, recommendations);
                if (recData) {
                    // console.log('VideoRecommendation received recommendations:', recData);
                    setSubjectCategory(recData.subjectCategory || "");
                    setPrimaryTopic(recData.primaryTopic || "");
                    const buildObj = arr => Object.fromEntries((arr || []).map(q => [q, null]));
                    setSimilarTopicsObj(buildObj(recData.similarTopics));
                    setPrerequisiteTopicsObj(buildObj(recData.prerequisiteTopics));
                    setNextTopicsObj(buildObj(recData.nextTopics));
                }
            } catch (error) {
                // console.error('Failed to fetch recommendations:', error);
            }
        };

        initializeRecommendations();
    }, [videoId, fetchRecommendations, insufficientTokens]); // Removed recommendations from dependencies

    // Handle recommendations updates separately to avoid infinite loops
    useEffect(() => {
        if (!recommendations) return;

        // Update state when recommendations change
        setSubjectCategory(recommendations.subjectCategory || "");
        setPrimaryTopic(recommendations.primaryTopic || "");
        const buildObj = arr => Object.fromEntries((arr || []).map(q => [q, null]));
        setSimilarTopicsObj(buildObj(recommendations.similarTopics));
        setPrerequisiteTopicsObj(buildObj(recommendations.prerequisiteTopics));
        setNextTopicsObj(buildObj(recommendations.nextTopics));

        // Save recommendations to Redis cache when they change (only if they have actual content)
        if (videoId && recommendations) {
            const recData = {
                subjectCategory: recommendations.subjectCategory || "",
                primaryTopic: recommendations.primaryTopic || "",
                similarTopics: recommendations.similarTopics || [],
                prerequisiteTopics: recommendations.prerequisiteTopics || [],
                nextTopics: recommendations.nextTopics || []
            };

            // Only save to Redis if we have meaningful data (not just empty strings/arrays)
            const hasContent = recData.subjectCategory ||
                recData.primaryTopic ||
                recData.similarTopics.length > 0 ||
                recData.prerequisiteTopics.length > 0 ||
                recData.nextTopics.length > 0;

            if (hasContent) {
                // Save to Redis cache (non-blocking)
                saveRecommendations(videoId, recData).catch(error => {
                    // console.error('Failed to save recommendations to cache:', error);
                    // Non-fatal error, continue with displaying recommendations
                });
            }
        }
    }, [recommendations?.subjectCategory, recommendations?.primaryTopic, recommendations?.similarTopics, recommendations?.prerequisiteTopics, recommendations?.nextTopics, videoId]);

    // Removed metadata and Python recommendation fetch; now using passed arrays
    const hasPopulated = React.useRef(false);

    // Reset population flag when inputs change (e.g., on refresh or new video)
    useEffect(() => {
        hasPopulated.current = false;
    }, [videoId, recommendations]);

    // Populate in rounds: 1st query for each category, then 2nd, then 3rd
    useEffect(() => {
        if (hasPopulated.current) return;

        const keysReady =
            Object.keys(similarTopicsObj).length > 0 ||
            Object.keys(prerequisiteTopicsObj).length > 0 ||
            Object.keys(nextTopicsObj).length > 0;
        if (!keysReady) return;

        const usedVideoIds = new Set();

        const similarKeys = Object.keys(similarTopicsObj);
        const prereqKeys = Object.keys(prerequisiteTopicsObj);
        const nextKeys = Object.keys(nextTopicsObj);
        const maxLen = Math.max(similarKeys.length, prereqKeys.length, nextKeys.length);
        const maxRounds = Math.min(3, maxLen);

        (async () => {
            let currentSimilar = { ...similarTopicsObj };
            let currentPrereq = { ...prerequisiteTopicsObj };
            let currentNext = { ...nextTopicsObj };

            for (let round = 0; round < maxRounds; round++) {
                const updates = [];

                const sKey = similarKeys[round];
                if (sKey && !currentSimilar[sKey]) {
                    updates.push((async () => {
                        currentSimilar[sKey] = await fetchVideoDetailsForQuery(sKey, usedVideoIds, 2);
                    })());
                }

                const pKey = prereqKeys[round];
                if (pKey && !currentPrereq[pKey]) {
                    updates.push((async () => {
                        currentPrereq[pKey] = await fetchVideoDetailsForQuery(pKey, usedVideoIds, 2);
                    })());
                }

                const nKey = nextKeys[round];
                if (nKey && !currentNext[nKey]) {
                    updates.push((async () => {
                        currentNext[nKey] = await fetchVideoDetailsForQuery(nKey, usedVideoIds, 2);
                    })());
                }

                if (updates.length > 0) {
                    await Promise.all(updates);
                    setSimilarTopicsObj({ ...currentSimilar });
                    setPrerequisiteTopicsObj({ ...currentPrereq });
                    setNextTopicsObj({ ...currentNext });
                }
            }
            hasPopulated.current = true;
        })();
    }, [similarTopicsObj, prerequisiteTopicsObj, nextTopicsObj]);

    // Duration helper: returns seconds from common fields or ISO8601 strings
    function parseDurationToSeconds(item) {
        try {
            if (!item) return 0;
            if (typeof item.duration === 'number') return Math.max(0, Math.floor(item.duration / 1000));
            if (typeof item.durationSeconds === 'number') return item.durationSeconds;
            if (typeof item.lengthSeconds === 'number') return item.lengthSeconds;
            const iso = item.duration || item.contentDetails?.duration; // e.g., PT1H2M3S
            if (!iso || typeof iso !== 'string') return 0;
            const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
            if (!m) return 0;
            const hours = parseInt(m[1] || '0', 10);
            const minutes = parseInt(m[2] || '0', 10);
            const seconds = parseInt(m[3] || '0', 10);
            return hours * 3600 + minutes * 60 + seconds;
        } catch {
            return 0;
        }
    }

    // Fetch video details for a single query using your API/backend
    async function fetchVideoDetailsForQuery(query, usedVideoIds, maxCandidates = 6) {
        try {
            const resp = await searchRecommendations(query, Math.max(6, maxCandidates));
            if (!resp || resp.success === false || !Array.isArray(resp.items)) return null;
            // Pick first unique by id; if none unique, skip (avoid duplicates)
            const uniqueItems = resp.items.filter((v) => v && v.id && (!usedVideoIds || !usedVideoIds.has(v.id)));
            // Choose first video >= 5 minutes if available
            const longEnough = uniqueItems.filter((v) => parseDurationToSeconds(v) >= 300);
            const chosen = (longEnough[0] || uniqueItems[0]) || null;
            if (!chosen) return null;
            if (usedVideoIds && chosen.id) usedVideoIds.add(chosen.id);
            // Map extension result to component's expected shape
            return {
                id: chosen.id,
                duration: typeof chosen.duration === 'number' ? chosen.duration : (chosen.duration || chosen.contentDetails?.duration || null),
                durationSeconds: (typeof chosen.durationSeconds === 'number') ? chosen.durationSeconds : (typeof chosen.lengthSeconds === 'number') ? chosen.lengthSeconds : undefined,
                snippet: {
                    title: chosen.title || '',
                    thumbnail: chosen.thumbnail?.url || chosen.thumbnail || ''
                }
            };
        } catch (error) {
            // console.error('Error fetching video details:', error);
            return null;
        }
    }

    async function fetchAndUpdateTopicDetails(topicQueries, setTopicObj, usedVideoIds) {
        const queries = Object.keys(topicQueries);
        const updatedObj = {};
        for (const query of queries) {
            updatedObj[query] = await fetchVideoDetailsForQuery(query, usedVideoIds);
        }
        setTopicObj(updatedObj);
        // console.log("Fetched video details for:", updatedObj);
    }

    function VideoCard({ video }) {
        if (!video) return null;
        const { snippet, id } = video;

        // Truncate title if more than 30 characters on desktop, 20 on mobile
        const truncatedTitle = snippet.title.length > 30
            ? snippet.title.substring(0, 30) + '...'
            : snippet.title;

        return (
            <div className="flex items-center bg-darkBlueGray rounded-[10px] mb-6 px-2 md:px-4 py-3 border border-white transition duration-200 w-full">
                <img
                    src={snippet.thumbnail}
                    alt={snippet.title}
                    className="w-[100px] h-[60px] md:w-[140px] md:h-[80px] rounded-[5px] object-cover mr-2 md:mr-4"
                />
                <div className="flex-1">
                    <h4 className="text-white font-semibold text-sm md:text-base mb-2 leading-tight">{truncatedTitle}</h4>
                    <Link
                        className="mt-2 px-3 md:px-4 py-1 bg-green-400 text-black rounded-[6px] text-xs hover:bg-green-500 focus:outline-none inline-block"
                        href={`/videoplayer/${id}`}
                    >
                        Watch Video
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <>
            {transcriptFailed ? (
                <div className="w-full md:w-[28%] p-[10px] md:p-[20px] mr-0 top-[20px] relative right-0 self-start max-h-[600px] overflow-y-auto rec-scroll">
                    <div className="bg-darkBlueGray p-[20px] border border-white rounded-[12px] w-full md:w-[400px] flex flex-col items-center justify-center h-[200px]">
                        <div className='text-6xl mb-4'>⚠️</div>
                        <div className='text-lg font-semibold text-red-400 mb-2'>Service Not Available</div>
                        <div className='text-sm text-gray-400 text-center'>
                            This video's transcript cannot be accessed due to the video owner's permission restrictions.
                        </div>
                    </div>
                </div>
            ) : insufficientTokens ? (
                <div className="w-full md:w-[28%] p-[10px] md:p-[20px] mr-0 top-[20px] relative right-0 self-start max-h-[600px] overflow-y-auto rec-scroll">
                    <div className="bg-darkBlueGray p-[20px] border border-white rounded-[12px] w-full md:w-[400px] flex items-center justify-center h-[150px]">
                        <div className="text-red-400 text-center">not enough tokens</div>
                    </div>
                </div>
            ) : isLoading ? (
                <RecommendationsLoader />
            ) : (
                <div className="w-full md:w-[28%] p-[10px] md:p-[20px] mr-0 top-[20px] relative right-0 self-start max-h-[600px] overflow-y-auto rec-scroll">

                    {/* Category and Primary Topic */}
                    <div className="flex flex-row justify-start flex-wrap gap-[20px] mb-[20px] bg-darkBlueGray py-[15px] px-[10px] rounded-none w-full md:w-[400px] border border-white">
                        <div className="bg-darkBlueGray p-[12px] rounded-[8px] w-full border border-white">
                            <div className='mb-[8px] flex items-center'>
                                <span className="mr-[8px] font-bold text-white text-sm">Category:</span>
                                {subjectCategory ? (
                                    <span className="text-green-400 text-sm">{subjectCategory}</span>
                                ) : (
                                    <span className="flex-1"><Skeleton width="140px" height="16px" /></span>
                                )}
                            </div>
                            <div className='mb-0 flex items-center'>
                                <span className="mr-[8px] font-bold text-white text-sm">Primary Topic:</span>
                                {primaryTopic ? (
                                    <span className="text-green-400 text-sm">{primaryTopic}</span>
                                ) : (
                                    <span className="flex-1"><Skeleton width="180px" height="16px" /></span>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Similar Topic Videos */}
                    <div className="bg-darkBlueGray p-[15px] md:p-[25px] border border-white rounded-[12px] mb-[30px] w-full md:w-[400px]">
                        <h3 className='text-white border-b-2 border-b-green-400 pb-[10px] mt-0'>Similar Topic Videos</h3>
                        <div className="mt-[15px]">
                            {Array.from({ length: 3 }).map((_, idx) => {
                                const items = Object.values(similarTopicsObj);
                                const filtered = items.filter((v) => parseDurationToSeconds(v) >= 300);
                                const item = filtered[idx];
                                return item ? <VideoCard video={item} key={idx} /> : <VideoSkeletonRow key={idx} />;
                            })}
                        </div>
                    </div>

                    {/* Prerequisite Videos */}
                    <div className="bg-darkBlueGray p-[15px] md:p-[25px] border border-white rounded-[12px] mb-[30px] w-full md:w-[400px]">
                        <h3 className='text-white border-b-2 border-b-green-400 pb-[10px] mt-0'>Prerequisite Videos</h3>
                        <div className="mt-[15px]">
                            {Array.from({ length: 3 }).map((_, idx) => {
                                const items = Object.values(prerequisiteTopicsObj);
                                const filtered = items.filter((v) => parseDurationToSeconds(v) >= 300);
                                const item = filtered[idx];
                                return item ? <VideoCard video={item} key={idx} /> : <VideoSkeletonRow key={idx} />;
                            })}
                        </div>
                    </div>

                    {/* Next Topic Videos */}
                    <div className="bg-darkBlueGray p-[15px] md:p-[25px] border border-white rounded-[12px] mb-[30px] w-full md:w-[400px]">
                        <h3 className='text-white border-b-2 border-b-green-400 pb-[10px] mt-0'>Next Topic Videos</h3>
                        <div className="mt-[15px]">
                            {Array.from({ length: 3 }).map((_, idx) => {
                                const items = Object.values(nextTopicsObj);
                                const filtered = items.filter((v) => parseDurationToSeconds(v) >= 300);
                                const item = filtered[idx];
                                return item ? <VideoCard video={item} key={idx} /> : <VideoSkeletonRow key={idx} />;
                            })}
                        </div>
                    </div>
                </div>
            )}
            <style jsx>{`
            .rec-scroll::-webkit-scrollbar { width: 6px; height: 6px; }
            .rec-scroll::-webkit-scrollbar-track { background: #0b0b0b; }
            .rec-scroll::-webkit-scrollbar-thumb { background: #111111; border-radius: 6px; }
            .rec-scroll::-webkit-scrollbar-thumb:hover { background: #1a1a1a; }
            .rec-scroll { scrollbar-width: thin; scrollbar-color: #111111 #0b0b0b; }
        `}</style>
        </>
    );
};

export default VideoRecommendation;
