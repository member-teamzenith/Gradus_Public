"use client";
import React from 'react';
import Link from 'next/link';

const IncompleteOnboarding = ({ open, onClose }) => {
    if (!open) return null;
    return (
        <div className="fixed inset-0 z-[1002] bg-black bg-opacity-70 flex items-center justify-center">
            <div className="relative bg-[#0b0b0b] text-white rounded-2xl shadow-xl w-full max-w-md border border-white/20">
                <button
                    aria-label="Close"
                    onClick={onClose}
                    className="absolute top-3 right-3 text-white/80 hover:text-white"
                >
                    ✕
                </button>
                <div className="p-6 flex flex-col items-center text-center">
                    <img
                        src="/Chill.png"
                        alt="Join Gradus"
                        className="w-40 h-40 object-contain mb-4"
                    />
                    <h2 className="text-xl font-semibold mb-2">Onboarding Incomplete</h2>
                    <p className="text-white/80 mb-5">
                        Looks Like you onBoarding is not complete , please complete that first
                    </p>
                    <Link
                        href="/auth/onBoarding/course-interests"
                        className="inline-flex items-center justify-center rounded-full px-5 py-3 bg-green-400 text-black font-medium hover:bg-green-500 transition-colors"
                    >
                        Complete Onboarding
                    </Link>
                </div>
            </div>
        </div>
    );
};

export default IncompleteOnboarding;
