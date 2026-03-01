"use client";
import React from 'react';
import Image from 'next/image';

const Batches = ({ firstFlame, bugHunter }) => {
    const hasBadges = firstFlame || bugHunter;

    return (
        <div className="flex flex-col items-center space-y-6">
            <h3 className="text-white text-xl font-semibold mb-4">Achievement Badges</h3>
            
            {!hasBadges ? (
                <div className="flex items-center justify-center h-40">
                    <p className="text-gray-400 text-xl font-medium">No badges</p>
                </div>
            ) : (
                <div className="flex flex-wrap justify-center gap-6">
                    {firstFlame && (
                        <div className="flex flex-col items-center">
                            <div className="relative w-28 h-28 sm:w-32 sm:h-32 md:w-36 md:h-36 animate-float">
                                <Image
                                    src="/FirstFlame.png"
                                    alt="First Flame Badge"
                                    fill
                                    className="object-contain"
                                    priority
                                />
                            </div>
                        </div>
                    )}
                    
                    {bugHunter && (
                        <div className="flex flex-col items-center">
                            <div className="relative w-28 h-28 sm:w-32 sm:h-32 md:w-36 md:h-36 animate-float-delayed">
                                <Image
                                    src="/BugHunter.png"
                                    alt="Bug Hunter Badge"
                                    fill
                                    className="object-contain"
                                    priority
                                />
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default Batches;