import React, { useMemo, useState, useEffect } from 'react';

const SummaryFormatter = ({ content }) => {
    // Check if content appears to be streaming (incomplete)
    const isStreaming = content && content.length > 0 && (
        content.trim().endsWith('...') || 
        content.trim().endsWith('*') ||
        content.trim().endsWith('**') ||
        content.trim().endsWith('###') ||
        content.trim().endsWith('####') ||
        content.trim().endsWith('-') ||
        content.trim().endsWith('1.') ||
        content.trim().endsWith('2.') ||
        content.trim().endsWith('3.') ||
        content.trim().endsWith('4.') ||
        content.trim().endsWith('5.') ||
        content.trim().endsWith('6.') ||
        content.trim().endsWith('7.') ||
        content.trim().endsWith('8.') ||
        content.trim().endsWith('9.') ||
        content.trim().endsWith('0.') ||
        content.trim().endsWith('[') ||
        content.trim().endsWith('`') ||
        content.trim().endsWith('**') ||
        content.trim().endsWith('*') ||
        content.trim().endsWith('_') ||
        content.trim().endsWith('##') ||
        content.trim().endsWith('###') ||
        content.trim().endsWith('####') ||
        content.trim().endsWith('#####') ||
        content.trim().endsWith('######')
    );

    const formatContent = (content) => {
        // Ensure content is a string
        if (!content) return '';
        if (typeof content !== 'string') {
            content = String(content);
        }
        
        // Preserve fenced code blocks first by extracting them and restoring after formatting
        const codeBlocks = [];

        function escapeHtml(str) {
            return String(str)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;');
        }

        content = content.replace(/```(\w+)?\s*[\r\n]([\s\S]*?)```/g, (match, lang, code) => {
            const index = codeBlocks.length;
            const language = (lang || '').toLowerCase();
            const escaped = escapeHtml(code);
            const html = `<pre class="bg-[#111827] text-[#e5e7eb] p-3 md:p-4 rounded-md overflow-x-auto"><code class="language-${language}">${escaped}</code></pre>`;
            codeBlocks.push(html);
            return `%%CODEBLOCK_${index}%%`;
        });

        // Handle incomplete markdown patterns that might occur during streaming
        // Clean up incomplete markdown patterns
        content = content.replace(/###\s*$/gm, ''); // Remove incomplete ### headers
        content = content.replace(/####\s*$/gm, ''); // Remove incomplete #### headers
        content = content.replace(/\*\*\s*$/gm, ''); // Remove incomplete ** bold
        content = content.replace(/\*\s*$/gm, ''); // Remove incomplete * italic
        content = content.replace(/`\s*$/gm, ''); // Remove incomplete ` code
        content = content.replace(/\[\s*$/gm, ''); // Remove incomplete [ links
        content = content.replace(/-\s*$/gm, ''); // Remove incomplete - list items
        content = content.replace(/\d+\.\s*$/gm, ''); // Remove incomplete numbered lists
        
        // Convert ### Main Points to a Tailwind-styled bullet
        content = content.replace(
            /^### (.*$)/gm,
            '<div class="mt-4 mb-2 flex items-start"><span class="text-xl text-teal-400 mr-2 leading-none">•</span><span class="font-bold text-[1.1rem] text-gray-100">$1</span></div>'
        );

        // Convert #### Subheadings
        content = content.replace(
            /^#### (.*$)/gm,
            '<div class="my-2 ml-[22px] flex items-start"><span class="text-teal-400 text-base mr-2 leading-tight">▪</span><span class="text-teal-300 font-medium">$1</span></div>'
        );

        // Text emphasis
        content = content.replace(/\*\*(.*?)\*\*/g, '<strong class="bg-yellow-900\/30 px-1 rounded font-semibold text-yellow-200">$1<\/strong>');
        content = content.replace(/\*(.*?)\*/g, '<em class="text-gray-300 italic">$1<\/em>');

        // Unordered lists
        content = content.replace(/^\s*[-*]\s(.*)$/gm, '<li class="my-2 leading-relaxed text-gray-200">$1<\/li>');
        content = content.replace(/((?:<li class="my-2 leading-relaxed">.*<\/li>\n?)+)/g, '<ul class="pl-8 my-4 list-disc text-gray-200">$1<\/ul>');

        // Numbered lists
        content = content.replace(/^\d+\.\s(.*)$/gm, '<li class="my-2 leading-relaxed text-gray-200">$1<\/li>');
        content = content.replace(/((?:<li class="my-2 leading-relaxed">.*<\/li>\n?)+)/g, '<ol class="pl-8 my-4 list-decimal text-gray-200">$1<\/ol>');

        // Inline code and key concepts
        content = content.replace(/`(.*?)`/g, '<code class="bg-[#111827] px-1 rounded font-mono text-pink-300">$1<\/code>');
        content = content.replace(/\[KEY\](.*?)\[\/KEY\]/g, '<span class="bg-teal-900\/30 px-2 rounded text-teal-200 font-medium">$1<\/span>');
        content = content.replace(/\[DEF\](.*?)\[\/DEF\]/g, '<div class="bg-[#0b0b0b] border-l-4 border-teal-500 p-4 my-4 rounded-r text-gray-200">$1<\/div>');

        // Section breaks
        content = content.replace(/---/g, '<hr class="border-0 h-px bg-gray-700 my-8">');

        // Paragraphs
        content = content.replace(/^(?!<([duo]|li|h|c|s|b|\/)).+$/gm, '<p class="my-4 text-gray-200 leading-8">$&<\/p>');

        // Restore fenced code blocks
        content = content.replace(/%%CODEBLOCK_(\d+)%%/g, (_, idx) => codeBlocks[Number(idx)] || '');

        return content;
    };

    const formattedContent = useMemo(() => formatContent(content || ''), [content]);

    // Animated loading state when content is not yet available
    const loadingMessages = [
        'Generating…',
        'Great things take time…',
        'Polishing insights…',
        'Almost ready…'
    ];
    const [msgIndex, setMsgIndex] = useState(0);
    useEffect(() => {
        if (content) return; // don't animate when content exists
        const id = setInterval(() => {
            setMsgIndex((i) => (i + 1) % loadingMessages.length);
        }, 2200);
        return () => clearInterval(id);
    }, [content]);

    if (!content) {
        return (
            <div className='flex flex-col items-center justify-center p-4 md:p-6 text-center'>
                <div className='flex items-center text-teal-300'>
                    <svg className='w-5 h-5 mr-2 animate-spin' viewBox='0 0 24 24' fill='none'>
                        <circle className='opacity-25' cx='12' cy='12' r='10' stroke='currentColor' strokeWidth='4'></circle>
                        <path className='opacity-75' fill='currentColor' d='M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z'></path>
                    </svg>
                    <span className='text-sm md:text-base'>{loadingMessages[msgIndex]}</span>
                </div>
                <div className='mt-3 flex space-x-1 text-teal-400'>
                    <span className='w-2 h-2 bg-teal-400 rounded-full animate-bounce'></span>
                    <span className='w-2 h-2 bg-teal-400 rounded-full animate-bounce' style={{ animationDelay: '0.12s' }}></span>
                    <span className='w-2 h-2 bg-teal-400 rounded-full animate-bounce' style={{ animationDelay: '0.24s' }}></span>
                </div>
            </div>
        );
    }

    return (
        <>
            <div className="font-sans leading-relaxed text-white bg-darkBlueGray w-full h-full p-3 md:p-5">
                <div dangerouslySetInnerHTML={{ __html: formattedContent }} />
                {isStreaming && (
                    <div className="flex items-center justify-center mt-4 text-teal-400">
                        <div className="animate-pulse flex space-x-1">
                            <div className="w-2 h-2 bg-teal-400 rounded-full animate-bounce"></div>
                            <div className="w-2 h-2 bg-teal-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                            <div className="w-2 h-2 bg-teal-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                        </div>
                        <span className="ml-2 text-sm">Streaming...</span>
                    </div>
                )}
            </div>
            <style jsx global>{`
                /* Minimal dark scrollbars for Summary and Recommendations */
                .summary-scroll::-webkit-scrollbar,
                .rec-scroll::-webkit-scrollbar { width: 6px; height: 6px; }
                .summary-scroll::-webkit-scrollbar-track,
                .rec-scroll::-webkit-scrollbar-track { background: #0b0b0b; }
                .summary-scroll::-webkit-scrollbar-thumb,
                .rec-scroll::-webkit-scrollbar-thumb { background: #111111; border-radius: 6px; }
                .summary-scroll::-webkit-scrollbar-thumb:hover,
                .rec-scroll::-webkit-scrollbar-thumb:hover { background: #1a1a1a; }

                .summary-scroll { scrollbar-width: thin; scrollbar-color: #111111 #0b0b0b; }
                .rec-scroll { scrollbar-width: thin; scrollbar-color: #111111 #0b0b0b; }
            `}</style>
        </>
    );
};

export default SummaryFormatter;
