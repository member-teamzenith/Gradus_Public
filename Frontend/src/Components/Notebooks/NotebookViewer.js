"use client";

import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { selectUserId } from '../../../store/userSlice';
import { getUserBlueprints, shareBlueprint } from '../../services/blueprintsServices';
import SummaryFormatter from '../VideoPlayer/watch/SummaryContainer';
import NavbarWithSearch from '../common/NavbarWithSearch';


const NotebookViewer = () => {
    const userId = useSelector(selectUserId);
    const [notebooks, setNotebooks] = useState({});
    const [blueprints, setBlueprints] = useState([]);
    const [viewMode, setViewMode] = useState('notebooks'); // 'notebooks' | 'blueprints'
    const [selectedNotebook, setSelectedNotebook] = useState(null); // reusable for selected blueprint name/ID
    const [selectedModule, setSelectedModule] = useState(0); // Index of selected module for blueprint view
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Share State
    const [shareUrl, setShareUrl] = useState(null);
    const [isSharing, setIsSharing] = useState(false);

    // Edit State
    const [editingNoteId, setEditingNoteId] = useState(null);
    const [editText, setEditText] = useState('');

    // Drag and Drop State
    const [draggedNoteId, setDraggedNoteId] = useState(null);
    const [dragOverNoteId, setDragOverNoteId] = useState(null);

    useEffect(() => {
        if (userId) {
            if (viewMode === 'notebooks') {
                fetchNotebooks();
            } else {
                fetchBlueprintsList();
            }
        } else {
            setLoading(false);
        }
    }, [userId, viewMode]);

    // Reset selected module when switching blueprints
    useEffect(() => {
        setSelectedModule(0);
        setShareUrl(null); // Reset share URL when switching
    }, [selectedNotebook]);

    const handleShare = async (blueprintName) => {
        if (!userId || !blueprintName) return;

        try {
            setIsSharing(true);
            const result = await shareBlueprint(userId, blueprintName);
            if (result.success) {
                // Construct full URL (assuming client side knows domain, or just use relative if navigating)
                // Actually need full URL for sharing. window.location.origin + result.url
                const fullUrl = `${window.location.origin}${result.url}`;
                setShareUrl(fullUrl);
                navigator.clipboard.writeText(fullUrl); // Auto-copy
                alert('Link copied to clipboard!');
            }
        } catch (err) {
            console.error('Share failed:', err);
            alert('Failed to share blueprint.');
        } finally {
            setIsSharing(false);
        }
    };

    const fetchNotebooks = async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await fetch(`http://localhost:4000/get-notebooks/${userId}`);
            if (!response.ok) {
                throw new Error('Failed to fetch notebooks');
            }
            const data = await response.json();
            setNotebooks(data.notebooks || {});
        } catch (err) {
            console.error('Error fetching notebooks:', err);
            setError('Failed to load notebooks. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const fetchBlueprintsList = async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await getUserBlueprints(userId);
            if (response.success) {
                setBlueprints(response.data || []);
            } else {
                // If success is false but no throw
                setBlueprints([]);
            }
        } catch (err) {
            console.error('Error fetching blueprints:', err);
            setError('Failed to load blueprints.');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async () => {
        if (!selectedNotebook || !userId) return;

        if (window.confirm(`Are you sure you want to delete "${selectedNotebook}"?`)) {
            try {
                const response = await fetch('http://localhost:4000/delete-notebook', {
                    method: 'DELETE',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        uid: userId,
                        notebookName: selectedNotebook
                    })
                });

                if (response.ok) {
                    setSelectedNotebook(null);
                    fetchNotebooks();
                } else {
                    alert('Failed to delete notebook.');
                }
            } catch (err) {
                console.error('Error deleting notebook:', err);
                alert('Error deleting notebook.');
            }
        }
    };

    const parseContent = (content) => {
        if (!content) return [];

        const parts = content.split('--- Added on ');
        const parsedNotes = [];

        if (parts[0] && parts[0].trim()) {
            parsedNotes.push({
                id: 'initial',
                timestamp: 'Initial Note',
                source: null,
                text: parts[0].trim(),
                isStarred: parts[0].includes('[IMPORTANT]')
            });
        }

        for (let i = 1; i < parts.length; i++) {
            const part = parts[i];
            const endOfTimestamp = part.indexOf(' ---');
            if (endOfTimestamp === -1) continue;

            const timestamp = part.substring(0, endOfTimestamp).trim();
            const rest = part.substring(endOfTimestamp + 4);

            const sourceMatch = rest.match(/\nSource: (.*?)\n/);
            let source = null;
            let text = rest;

            if (sourceMatch) {
                source = sourceMatch[1].trim();
                text = rest.replace(sourceMatch[0], '').trim();
            } else {
                text = rest.trim();
            }

            const isStarred = text.includes('[IMPORTANT]');
            if (isStarred) {
                text = text.replace('[IMPORTANT]', '').trim();
            }

            parsedNotes.push({
                id: i,
                timestamp,
                source,
                text,
                isStarred
            });
        }

        return parsedNotes.reverse();
    };

    const reconstructContent = (notes) => {
        // We need to reverse back to chronological order for saving
        const chronologicalNotes = [...notes].reverse();

        let content = '';

        chronologicalNotes.forEach((note, index) => {
            let noteText = note.text;
            if (note.isStarred) {
                noteText = `[IMPORTANT] ${noteText}`;
            }

            if (note.id === 'initial') {
                content += noteText + '\n\n';
            } else {
                content += `--- Added on ${note.timestamp} ---\n`;
                if (note.source) {
                    content += `Source: ${note.source}\n\n`;
                } else {
                    content += '\n';
                }
                content += `${noteText}\n\n`;
            }
        });

        return content.trim();
    };

    const saveNotebook = async (newContent) => {
        try {
            // Use overwrite-notebook endpoint to update existing notebook
            const response = await fetch('http://localhost:4000/overwrite-notebook', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    uid: userId,
                    notebookName: selectedNotebook,
                    content: newContent
                })
            });

            if (response.ok) {
                // Update local state immediately
                setNotebooks(prev => ({
                    ...prev,
                    [selectedNotebook]: newContent
                }));
                setEditingNoteId(null);
            } else {
                const data = await response.json();
                alert(`Failed to save changes: ${data.error || response.statusText}`);
            }
        } catch (err) {
            console.error('Error saving notebook:', err);
            alert('Error saving changes.');
        }
    };

    const handleEdit = (note) => {
        setEditingNoteId(note.id);
        setEditText(note.text);
    };

    const handleCancelEdit = () => {
        setEditingNoteId(null);
        setEditText('');
    };

    const handleSaveEdit = (noteId) => {
        const currentNotes = parseContent(notebooks[selectedNotebook]);
        const updatedNotes = currentNotes.map(note => {
            if (note.id === noteId) {
                return { ...note, text: editText };
            }
            return note;
        });

        const newContent = reconstructContent(updatedNotes);
        saveNotebook(newContent);
    };

    const handleToggleStar = (noteId) => {
        const currentNotes = parseContent(notebooks[selectedNotebook]);
        const updatedNotes = currentNotes.map(note => {
            if (note.id === noteId) {
                return { ...note, isStarred: !note.isStarred };
            }
            return note;
        });

        const newContent = reconstructContent(updatedNotes);
        saveNotebook(newContent);
    };

    // Drag and Drop Handlers
    const handleDragStart = (e, noteId) => {
        setDraggedNoteId(noteId);
        e.dataTransfer.effectAllowed = 'move';
        // Optional: Set drag image or data
    };

    const handleDragOver = (e, noteId) => {
        e.preventDefault(); // Necessary to allow dropping
        if (draggedNoteId !== noteId) {
            setDragOverNoteId(noteId);
        }
    };

    const handleDragLeave = (e) => {
        setDragOverNoteId(null);
    };

    const handleDrop = (e, targetNoteId) => {
        e.preventDefault();
        setDragOverNoteId(null);

        if (!draggedNoteId || draggedNoteId === targetNoteId) return;

        const currentNotes = parseContent(notebooks[selectedNotebook]);
        const draggedNote = currentNotes.find(n => n.id === draggedNoteId);
        const targetNote = currentNotes.find(n => n.id === targetNoteId);

        if (!draggedNote || !targetNote) return;

        if (window.confirm('Merge these two notes?')) {
            // Merge logic: Append dragged note text to target note text
            const mergedText = `${targetNote.text}\n\n---\n\n${draggedNote.text}`;

            // Create new list: Remove dragged note, update target note
            const updatedNotes = currentNotes
                .filter(n => n.id !== draggedNoteId)
                .map(n => {
                    if (n.id === targetNoteId) {
                        return { ...n, text: mergedText };
                    }
                    return n;
                });

            const newContent = reconstructContent(updatedNotes);
            saveNotebook(newContent);
        }

        setDraggedNoteId(null);
    };

    const parsedNotes = selectedNotebook ? parseContent(notebooks[selectedNotebook]) : [];

    const renderNoteContent = (text) => {
        if (!text) return null;

        // Split by markdown image syntax: ![alt](url)
        const parts = text.split(/(!\[.*?\]\(.*?\))/g);

        return parts.map((part, index) => {
            const imageMatch = part.match(/!\[(.*?)\]\((.*?)\)/);
            if (imageMatch) {
                return (
                    <div key={index} className="my-8 text-center bg-[#0a0a0a] p-4 rounded-xl border border-[#333]">
                        <img
                            src={imageMatch[2]}
                            alt={imageMatch[1] || 'Screenshot'}
                            className="max-w-full max-h-[500px] mx-auto rounded-lg shadow-lg cursor-pointer transition-transform hover:scale-[1.01]"
                            onClick={() => window.open(imageMatch[2], '_blank')}
                        />
                    </div>
                );
            }
            if (part.trim()) {
                return <div key={index} className="mb-4 text-gray-200 leading-relaxed font-sans">{part}</div>;
            }
            return null;
        });
    };

    if (!userId) {
        return (
            <div className="flex flex-col h-screen bg-[#050505] font-sans text-white">
                <NavbarWithSearch />
                <div className="flex flex-1 overflow-hidden">
                    <div className="flex-1 flex flex-col items-center justify-center text-[#a1a1aa]">
                        <h3 className="text-xl font-medium">Please log in to view your notebooks.</h3>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-screen bg-[#050505] font-sans text-white">
            <NavbarWithSearch />
            <div className="flex flex-1 overflow-hidden">
                <aside className="w-[300px] bg-[#0a0a0a] border-r border-[#1f1f1f] flex flex-col shrink-0 h-full">
                    <div className="p-6 flex justify-between items-center">
                        <h2 className="text-lg font-semibold text-[#4ade80]">My Library</h2>
                        <button onClick={viewMode === 'notebooks' ? fetchNotebooks : fetchBlueprintsList} className="p-2 rounded-md text-[#4ade80] opacity-70 hover:opacity-100 hover:bg-[#4ade80]/10 transition-all" title="Refresh List">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M23 4v6h-6M1 20v-6h6"></path>
                                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
                            </svg>
                        </button>
                    </div>

                    <div className="flex px-4 pb-4 gap-2 border-b border-[#1f1f1f] mb-2">
                        <button
                            className={`flex-1 p-2 rounded-md text-sm transition-all cursor-pointer border ${viewMode === 'notebooks' ? 'bg-[#4ade80] text-black border-[#4ade80] font-bold shadow-[0_0_10px_rgba(74,222,128,0.3)]' : 'bg-transparent border-[#333] text-[#a1a1aa] hover:text-white hover:border-[#4ade80]'}`}
                            onClick={() => { setViewMode('notebooks'); setSelectedNotebook(null); }}
                        >
                            Notebooks
                        </button>
                        <button
                            className={`flex-1 p-2 rounded-md text-sm transition-all cursor-pointer border ${viewMode === 'blueprints' ? 'bg-[#4ade80] text-black border-[#4ade80] font-bold shadow-[0_0_10px_rgba(74,222,128,0.3)]' : 'bg-transparent border-[#333] text-[#a1a1aa] hover:text-white hover:border-[#4ade80]'}`}
                            onClick={() => { setViewMode('blueprints'); setSelectedNotebook(null); }}
                        >
                            Blueprints
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-2 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none']">
                        {loading ? (
                            <div className="p-4 text-center text-[#a1a1aa] italic">Loading...</div>
                        ) : error ? (
                            <div className="p-4 text-center text-red-500 italic">{error}</div>
                        ) : viewMode === 'notebooks' ? (
                            Object.keys(notebooks).length === 0 ? (
                                <div className="p-4 text-center text-[#a1a1aa] italic">No notebooks yet. Create one from the extension!</div>
                            ) : (
                                Object.keys(notebooks).map((name) => (
                                    <div
                                        key={name}
                                        className={`p-3 mb-2 rounded-lg cursor-pointer transition-all flex items-center text-sm ${selectedNotebook === name ? 'bg-[#4ade80] text-black font-bold shadow-[0_0_15px_rgba(74,222,128,0.2)]' : 'text-[#a1a1aa] hover:bg-[#1f1f1f] hover:text-white'}`}
                                        onClick={() => setSelectedNotebook(name)}
                                    >
                                        <span className="mr-3 text-lg">📓</span>
                                        {name}
                                    </div>
                                ))
                            )
                        ) : (
                            blueprints.length === 0 ? (
                                <div className="p-4 text-center text-[#a1a1aa] italic">No blueprints saved yet.</div>
                            ) : (
                                blueprints.map((bp) => (
                                    <div
                                        key={bp.id}
                                        className={`p-3 mb-2 rounded-lg cursor-pointer transition-all flex items-center text-sm ${selectedNotebook === bp.blueprintName ? 'bg-[#4ade80] text-black font-bold shadow-[0_0_15px_rgba(74,222,128,0.2)]' : 'text-[#a1a1aa] hover:bg-[#1f1f1f] hover:text-white'}`}
                                        onClick={() => setSelectedNotebook(bp.blueprintName)}
                                    >
                                        <span className="mr-3 text-lg">🗺️</span>
                                        {bp.blueprintName}
                                    </div>
                                ))
                            )
                        )}
                    </div>
                </aside>

                <main className="flex-1 flex flex-col bg-[radial-gradient(circle_at_top_right,#0f1f15_0%,#050505_40%)] overflow-hidden">
                    {!selectedNotebook ? (
                        <div className="flex-1 flex flex-col items-center justify-center text-[#a1a1aa]">
                            <div className="text-6xl mb-4 opacity-50 text-[#4ade80]">{viewMode === 'notebooks' ? '📓' : '🗺️'}</div>
                            <h3 className="text-xl font-medium mb-2">Select a {viewMode === 'notebooks' ? 'notebook' : 'blueprint'} to view</h3>
                            <p>Choose from the sidebar to view content.</p>
                        </div>
                    ) : viewMode === 'blueprints' ? (
                        // Blueprint Viewer
                        (() => {
                            const bp = blueprints.find(b => b.blueprintName === selectedNotebook);
                            if (!bp) return <div className="flex-1 flex flex-col items-center justify-center text-[#a1a1aa]">Blueprint not found.</div>;

                            const sortedModules = Object.entries(bp.modules || {}).sort(([, a], [, b]) => a.order - b.order);
                            const currentModuleEntry = sortedModules[selectedModule] || sortedModules[0]; // fallback
                            const [moduleName, moduleData] = currentModuleEntry || [null, null];

                            return (
                                <div className="flex h-full overflow-hidden">
                                    {/* Blueprint Sidebar for Modules */}
                                    <div className="w-[250px] bg-[#0a0a0a] border-r border-[#1f1f1f] flex flex-col p-4 overflow-y-auto shrink-0 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none']">
                                        <div className="mb-4 text-lg font-semibold text-[#4ade80] pb-2 border-b border-[#1f1f1f]">
                                            Modules
                                        </div>
                                        {sortedModules.map(([name, _], idx) => (
                                            <button
                                                key={idx}
                                                onClick={() => setSelectedModule(idx)}
                                                className={`bg-transparent border border-transparent text-[#a1a1aa] p-3 text-left rounded-md cursor-pointer text-sm transition-all mb-2 whitespace-nowrap overflow-hidden text-ellipsis hover:bg-[#1f1f1f] hover:text-white ${selectedModule === idx ? 'bg-[#4ade80]/10 text-[#4ade80] border-[#4ade80]/30 font-medium' : ''}`}
                                                title={name}
                                            >
                                                {idx + 1}. {name.replace(/^#+\s*/, '')}
                                            </button>
                                        ))}
                                    </div>

                                    {/* Blueprint Content Area */}
                                    <div className="flex-1 overflow-y-auto p-8 bg-[#050505] [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none']">
                                        {moduleName ? (
                                            <>
                                                <div className="mb-8 pb-4 border-b border-[#1f1f1f] flex justify-between items-center">
                                                    <h2 className="text-3xl text-[#4ade80] m-0 font-bold">{moduleName.replace(/^#+\s*/, '')}</h2>
                                                    <span className="text-sm text-[#a1a1aa]">Created: {new Date(bp.createdAt).toLocaleDateString()}</span>
                                                </div>

                                                <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'flex-end' }}>
                                                    {shareUrl ? (
                                                        <div className="flex items-center gap-2 bg-gray-900 p-2 rounded border border-green-500 text-sm">
                                                            <span className="text-green-400">Public Link Ready!</span>
                                                            <button
                                                                onClick={() => { navigator.clipboard.writeText(shareUrl); alert('Copied!'); }}
                                                                className="text-white underline hover:text-green-300"
                                                            >
                                                                Copy Link
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <button
                                                            onClick={() => handleShare(bp.blueprintName)}
                                                            disabled={isSharing}
                                                            className="px-4 py-2 rounded-lg border-0 bg-[#3bf69f] text-black font-semibold cursor-pointer transition-all text-sm hover:bg-[#22c55e] disabled:opacity-50"
                                                        >
                                                            {isSharing ? 'Generating Link...' : 'Share Blueprint'}
                                                        </button>
                                                    )}
                                                </div>

                                                <div className="max-w-[900px] mx-auto flex flex-col gap-6">
                                                    <div className="bg-[#0a0a0a] rounded-2xl border border-[#4ade80] overflow-hidden">
                                                        <div className="p-6 text-base leading-relaxed text-white whitespace-pre-wrap font-sans">
                                                            {moduleData.content && moduleData.content.map((item, i) => (
                                                                <div key={i} className="mb-4">
                                                                    {item.type === 'text' && (
                                                                        <div className="mb-2">
                                                                            <SummaryFormatter content={item.data} />
                                                                        </div>
                                                                    )}
                                                                    {item.type === 'image' && (
                                                                        <div className="my-4 text-center">
                                                                            <img
                                                                                src={item.data.startsWith('pending:') ? '' : item.data}
                                                                                alt="Module content"
                                                                                className="max-w-full max-h-[400px] rounded-lg border border-[#333] cursor-pointer transition-transform hover:scale-[1.01]"
                                                                                style={{ display: item.data.startsWith('pending:') ? 'none' : 'block' }}
                                                                            />
                                                                            {item.data.startsWith('pending:') && (
                                                                                <div className="p-4 bg-gray-900 text-gray-400 rounded border border-gray-700 italic text-center">
                                                                                    Image generating: {item.data.replace('pending:', '')}
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    )}
                                                                    {item.type === 'video' && (
                                                                        <div className="my-6 mx-auto bg-[#0a0a0a]/90 border border-[#333] rounded-lg p-4 max-w-[600px] flex gap-4 items-center shadow-sm hover:border-[#4ade80]/50 transition-all">
                                                                            <div className="relative w-[180px] h-[101px] shrink-0 rounded-lg overflow-hidden bg-[#1a1a1a] flex items-center justify-center group">
                                                                                <img
                                                                                    src={`https://img.youtube.com/vi/${typeof item.data === 'object' ? item.data.videoId : item.data.replace('pending:', '')}/mqdefault.jpg`}
                                                                                    alt="Video Thumbnail"
                                                                                    className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity"
                                                                                />
                                                                                <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/0 transition-colors">
                                                                                    <div className="w-8 h-8 bg-black/60 rounded-full flex items-center justify-center backdrop-blur-sm text-white shadow-md">
                                                                                        <span className="text-xs">▶</span>
                                                                                    </div>
                                                                                </div>
                                                                            </div>
                                                                            <div className="flex-1 min-w-0 flex flex-col justify-between h-[100px] py-1">
                                                                                <div>
                                                                                    <div className="font-semibold text-white mb-1 text-base truncate">{typeof item.data === 'object' ? item.data.title : 'Recommended Video'}</div>
                                                                                    <div className="text-xs text-[#9ca3af]">{typeof item.data === 'object' ? item.data.channel : 'YouTube Resource'}</div>
                                                                                </div>
                                                                                <div className="flex gap-2 mt-auto">
                                                                                    <a
                                                                                        href={`/videoplayer/${typeof item.data === 'object' ? item.data.videoId : item.data.replace('pending:', '')}`}
                                                                                        className="flex-1 text-center py-2 px-4 bg-[#18cb96] text-black border-none rounded-lg cursor-pointer font-semibold text-xs no-underline hover:bg-[#15b789] transition-colors"
                                                                                    >
                                                                                        Watch
                                                                                    </a>
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </div>
                                            </>
                                        ) : (
                                            <div className="flex-1 flex flex-col items-center justify-center text-[#a1a1aa]">No modules in this blueprint.</div>
                                        )}
                                    </div>
                                </div>
                            );
                        })()
                    ) : (
                        <div className="flex flex-col h-full">
                            <header className="p-8 flex justify-between items-start bg-transparent">
                                <div className="flex flex-col">
                                    <h1 className="text-3xl font-bold mb-2 text-[#4ade80]">{selectedNotebook}</h1>
                                    <span className="text-sm text-[#a1a1aa]">{parsedNotes.length} notes</span>
                                </div>
                                <button onClick={handleDelete} className="px-6 py-3 rounded-lg border-0 bg-[#4ade80] text-black font-semibold cursor-pointer transition-all text-sm hover:bg-[#22c55e] hover:-translate-y-[1px]">
                                    Delete Notebook
                                </button>
                            </header>
                            <div className="flex-1 overflow-y-auto px-12 pb-12 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none']">
                                <div className="max-w-[900px] mx-auto flex flex-col gap-6">
                                    {parsedNotes.length === 0 ? (
                                        <div className="flex-1 flex flex-col items-center justify-center text-[#a1a1aa] italic py-12">No notes in this notebook.</div>
                                    ) : (
                                        parsedNotes.map((note) => (
                                            <div
                                                key={note.id}
                                                className={`
                                                    bg-[#0a0a0a] rounded-2xl border border-[#4ade80] overflow-hidden transition-all hover:-translate-y-0.5 hover:shadow-[0_4px_20px_rgba(74,222,128,0.1)] relative 
                                                    ${note.isStarred ? 'border-[#ffd700] shadow-[0_0_0_1px_#ffd700,0_4px_12px_rgba(255,215,0,0.1)]' : ''}
                                                    ${draggedNoteId === note.id ? 'opacity-50 scale-95 border-2 border-dashed border-[#4ade80]' : ''}
                                                    ${dragOverNoteId === note.id ? 'border-2 border-[#4ade80] scale-[1.02] shadow-[0_0_0_4px_rgba(74,222,128,0.2)] bg-[#4ade80]/5' : ''}
                                                `}
                                                draggable={editingNoteId === null} // Only draggable if not editing
                                                onDragStart={(e) => handleDragStart(e, note.id)}
                                                onDragOver={(e) => handleDragOver(e, note.id)}
                                                onDragLeave={handleDragLeave}
                                                onDrop={(e) => handleDrop(e, note.id)}
                                            >
                                                <div className="p-4 bg-[#4ade80]/5 border-b border-[#4ade80]/20 flex justify-between items-center text-sm text-[#4ade80]">
                                                    <div className="flex items-center gap-6">
                                                        <div className="font-medium flex items-center gap-2">
                                                            🕒 {note.timestamp}
                                                        </div>
                                                        {note.source && (
                                                            <div className="max-w-[300px] overflow-hidden text-ellipsis whitespace-nowrap">
                                                                <a href={note.source} target="_blank" rel="noopener noreferrer" className="text-[#a1a1aa] no-underline flex items-center gap-2 hover:text-[#4ade80] hover:underline transition-colors">
                                                                    🔗 {new URL(note.source).hostname}
                                                                </a>
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="flex gap-2">
                                                        <button
                                                            className={`bg-transparent border-none cursor-pointer p-1 rounded text-lg transition-all opacity-70 text-[#4ade80] hover:bg-[#4ade80]/10 hover:opacity-100 ${note.isStarred ? 'opacity-100 text-[#ffd700]' : ''}`}
                                                            onClick={(e) => { e.stopPropagation(); handleToggleStar(note.id); }}
                                                            title={note.isStarred ? "Unmark Important" : "Mark Important"}
                                                        >
                                                            {note.isStarred ? '⭐' : '☆'}
                                                        </button>
                                                        <button
                                                            className="bg-transparent border-none cursor-pointer p-1 rounded text-lg transition-all opacity-70 text-[#4ade80] hover:bg-[#4ade80]/10 hover:opacity-100"
                                                            onClick={(e) => { e.stopPropagation(); handleEdit(note); }}
                                                            title="Edit Note"
                                                        >
                                                            ✏️
                                                        </button>
                                                    </div>
                                                </div>

                                                {editingNoteId === note.id ? (
                                                    <div className="p-6 flex flex-col gap-4">
                                                        <textarea
                                                            className="w-full min-h-[150px] p-4 border border-[#333] rounded-lg bg-[#050505] text-white font-sans text-base leading-relaxed resize-y focus:outline-none focus:border-[#4ade80] focus:shadow-[0_0_0_2px_rgba(74,222,128,0.1)]"
                                                            value={editText}
                                                            onChange={(e) => setEditText(e.target.value)}
                                                        />
                                                        <div className="flex justify-end gap-3">
                                                            <button className="px-6 py-2 bg-transparent text-[#a1a1aa] border border-[#333] rounded-md font-medium cursor-pointer transition-all hover:border-[#a1a1aa] hover:text-white" onClick={handleCancelEdit}>Cancel</button>
                                                            <button className="px-6 py-2 bg-[#4ade80] text-black border-none rounded-md font-semibold cursor-pointer transition-colors hover:bg-[#22c55e]" onClick={() => handleSaveEdit(note.id)}>Save</button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="p-6 text-base leading-relaxed text-white whitespace-pre-wrap font-sans">
                                                        {renderNoteContent(note.text)}
                                                    </div>
                                                )}
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
};

export default NotebookViewer;
