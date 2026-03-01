"use client"

import React, { useState, useMemo } from "react";
import { updateQuizScore } from '@/pythonServices/VideoPlayerServices';
import { useSelector } from 'react-redux';
import { selectUserId } from '../../../../store/userSlice';

// --- Quiz Parsing Logic ---
function parseQuizContent(content) {
    if (!content) return [];
    
    // console.log("Parsing quiz content:", content);
    
    const questions = [];
    const lines = content.split('\n');
    let currentQuestion = null;
    let currentOptions = [];
    let currentAnswer = '';
    let questionIndex = 0;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        
        // Check if this is a question (starts with number and period)
        if (/^\d+\.\s+/.test(line)) {
            // Save previous question if exists
            if (currentQuestion) {
                questions.push({
                    question: currentQuestion,
                    options: currentOptions,
                    answer: currentAnswer,
                    id: questionIndex++
                });
            }
            
            // Start new question
            currentQuestion = line.replace(/^\d+\.\s+/, '').trim();
            currentOptions = [];
            currentAnswer = '';
            // console.log("Found question:", currentQuestion);
        }
        // Check if this is an option (starts with A), B), C), D))
        else if (/^[A-D]\)\s+/.test(line)) {
            const match = line.match(/^([A-D])\)\s+(.*)$/);
            if (match) {
                currentOptions.push({
                    label: match[1],
                    text: match[2].trim()
                });
                // console.log("Found option:", match[1], match[2].trim());
            }
        }
        // Check if this is an answer
        else if (/^Answer:\s*([A-D])/.test(line)) {
            const match = line.match(/^Answer:\s*([A-D])/);
            if (match) {
                currentAnswer = match[1];
                // console.log("Found answer:", currentAnswer);
            }
        }
    }

    // Don't forget the last question
    if (currentQuestion) {
        questions.push({
            question: currentQuestion,
            options: currentOptions,
            answer: currentAnswer,
            id: questionIndex++
        });
    }

    // console.log("Final parsed questions:", questions);
    return questions;
}

const Quiz = ({ quizContent, onClose, insufficientTokens = false, videoId }) => {
    const userId = useSelector(selectUserId);
    const questions = useMemo(() => {
        const parsed = parseQuizContent(quizContent || "");
        // console.log("Parsed questions:", parsed);
        return parsed;
    }, [quizContent]);
    const [current, setCurrent] = useState(0);
    const [answers, setAnswers] = useState(Array(questions.length).fill(null));
    const [finished, setFinished] = useState(false);
    const [score, setScore] = useState(0);

    if (insufficientTokens) {
        return (
            <div className="bg-[#0b0b0b] text-white rounded-2xl border border-white/20">
                <div className='max-w-[800px] mx-auto p-5 relative z-[1] text-center'>
                    <button
                        className="absolute top-4 right-4 text-2xl text-white/80 hover:text-white font-bold z-10"
                        onClick={onClose}
                    >
                        &times;
                    </button>
                    <h1 className='text-center text-[#86efac] text-3xl font-bold mb-7'>Test Your Knowledge</h1>
                    <div className="p-8">
                        <div className="text-red-400 font-semibold">not enought tokens</div>
                    </div>
                </div>
            </div>
        );
    }

    if (!quizContent || questions.length === 0) 
        return (
            <div className="text-white text-center p-8 bg-[#0b0b0b] border border-white/20 rounded-xl">
                <div className="text-white/90">No quiz loaded.</div>
                <div className="text-sm mt-2 text-white/60">Content: {quizContent ? 'Present' : 'Missing'}</div>
                <div className="text-sm text-white/60">Questions parsed: {questions.length}</div>
            </div>
        );

    const handleOptionChange = (option) => {
        // console.log("Option selected:", option, "for question:", current);
        setAnswers(a => {
            const next = [...a];
            next[current] = option;
            // console.log("Updated answers:", next);
            return next;
        });
    };

    const nextQuestion = () => setCurrent(c => Math.min(c + 1, questions.length - 1));
    const prevQuestion = () => setCurrent(c => Math.max(c - 1, 0));
    const handleSubmit = async (e) => {
        e.preventDefault();
        let count = 0;
        for (let i = 0; i < questions.length; ++i) {
            if (answers[i] && answers[i] === questions[i].answer) count++;
        }
        setScore(count);
        setFinished(true);
        
        // Update quiz score in analytics
        if (userId && videoId) {
            try {
                await updateQuizScore(userId, videoId, count);
                console.log('Quiz score updated successfully');
            } catch (error) {
                console.error('Failed to update quiz score:', error);
            }
        }
    };

    let resultText = "";
    if (finished) {
        if (score < 5) resultText = "Better luck next time";
        else if (score <= 7) resultText = "Keep it up";
        else resultText = "Great work";
    }

    const currentQ = questions[current];
    
    // console.log("Current question:", currentQ);
    // console.log("Current answers:", answers);
    // console.log("Current answer for this question:", answers[current]);

    return (
        <div className="bg-[#0b0b0b] text-white rounded-2xl border border-white/20">
            <div className='max-w-[800px] mx-auto p-5 relative z-[1]'>
                {/* Close button */}
                <button
                    className="absolute top-4 right-4 text-2xl text-white/80 hover:text-white font-bold z-10"
                    onClick={onClose}
                >
                    &times;
                </button>
                <h1 className='text-center text-[#86efac] text-3xl font-bold mb-7'>Test Your Knowledge</h1>
                <form onSubmit={handleSubmit}>
                    {!finished ? (
                        <>
                            <div className='text-center mb-[10px] text-white/80 font-medium text-lg'>Question {current + 1} of {questions.length}</div>
                            <div className='bg-[#0b0b0b] border border-white/20 rounded-[14px] p-8 my-5 min-h-[300px] relative'>
                                <div className="mb-6 text-white font-semibold text-lg">{currentQ.question}</div>
                                <div className="flex flex-col gap-4">
                                    {currentQ.options.length === 0 ? (
                                        <div className="text-red-400">No options found for this question</div>
                                    ) : (
                                        currentQ.options.map(opt => {
                                            // console.log("Rendering option:", opt);
                                            return (
                                                <label key={opt.label} className={`flex items-center cursor-pointer transition-all 
                                                    ${answers[current] === opt.label
                                                    ? 'bg-[#22c55e] text-black border border-transparent' 
                                                    : 'bg-[#111111] text-white border border-white/20'} 
                                                    rounded-md px-4 py-3`}>
                                                    <input
                                                        type="radio"
                                                        name={`q${current}`}
                                                        value={opt.label}
                                                        checked={answers[current] === opt.label}
                                                        onChange={() => handleOptionChange(opt.label)}
                                                        className="mr-3 accent-[#22c55e]"
                                                    />
                                                    <span className="">{`${opt.label}) ${opt.text}`}</span>
                                                </label>
                                            );
                                        })
                                    )}
                                </div>
                            </div>
                            <div className="flex justify-between px-1">
                                <button
                                    type="button"
                                    className="bg-gray-700 hover:bg-gray-800 text-white px-5 py-2 rounded-md font-medium border border-white/10 disabled:bg-gray-600"
                                    disabled={current === 0}
                                    onClick={prevQuestion}
                                >Previous</button>
                                {current !== questions.length - 1 ? (
                                    <button
                                        type="button"
                                        onClick={nextQuestion}
                                        className="bg-[#22c55e] hover:bg-[#16a34a] text-black px-8 py-2 rounded-md font-medium disabled:bg-gray-600 disabled:cursor-not-allowed"
                                        disabled={answers[current] === null}
                                    >Next</button>
                                ) : (
                                    <button
                                        type="submit"
                                        className="bg-[#22c55e] hover:bg-[#16a34a] text-black px-8 py-2 rounded-md font-medium disabled:bg-gray-600 disabled:cursor-not-allowed"
                                        disabled={answers[current] === null}
                                    >Submit</button>
                                )}
                            </div>
                        </>
                    ) : (
                        <div className='bg-[#0b0b0b] border border-white/20 rounded-[14px] p-10 my-10 text-center'>
                            <h2 className="text-3xl font-bold mb-4 text-[#22c55e]">Your Score: {score} / {questions.length}</h2>
                            <p className="text-xl text-white/90 font-semibold mb-6">{resultText}</p>
                            <button
                                className="bg-[#22c55e] hover:bg-[#16a34a] text-black px-8 py-2 rounded-md font-medium mt-3"
                                onClick={() => { setFinished(false); setCurrent(0); setAnswers(Array(questions.length).fill(null)); setScore(0); }}
                            >
                                Try Again
                            </button>
                        </div>
                    )}
                </form>
            </div>
        </div>
    );
};

export default Quiz;