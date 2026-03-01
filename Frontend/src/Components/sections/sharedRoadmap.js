'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSelector } from 'react-redux';
// import { selectUserId } from '../../../../store/userSlice';
import { selectUserId } from '../../../store/userSlice';
// import { getSharedBlueprint, saveBlueprint } from '../../../services/blueprintsServices';
import { getSharedBlueprint, saveSharedBlueprint } from '@/services/blueprintsServices';
// import SummaryFormatter from '../../../Components/watch/SummaryContainer';
import SummaryFormatter from '../VideoPlayer/watch/SummaryContainer';
// import NavbarWithSearch from '../../../Components/common/NavbarWithSearch';
import NavbarWithSearch from '../common/NavbarWithSearch';
// import styles from '../../../Components/Notebooks/NotebookViewer.module.css'; 
import styles from '../Notebooks/NotebookViewer.module.css'

const SharedBlueprintViewer = () => {
    const params = useParams();
    const router = useRouter();
    const userId = useSelector(selectUserId);
    const shareId = params.shareId;

    const [blueprint, setBlueprint] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedModule, setSelectedModule] = useState(0);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    useEffect(() => {
        const fetchBlueprint = async () => {
            if (!shareId) return;
            try {
                setLoading(true);
                const response = await getSharedBlueprint(shareId);
                if (response.success) {
                    setBlueprint(response.data);
                } else {
                    setError('Failed to load blueprint');
                }
            } catch (err) {
                console.error('Error fetching shared blueprint:', err);
                setError('Failed to load blueprint. It may have been deleted or does not exist.');
            } finally {
                setLoading(false);
            }
        };

        fetchBlueprint();
    }, [shareId]);

    const handleSaveToLibrary = async () => {
        if (!userId) {
            alert('Please log in to save this blueprint to your library.');
            router.push('/login'); // Or wherever your login page is
            return;
        }

        if (!blueprint) return;

        try {
            setSaving(true);

            // Transform modules object back to array format expected by saveBlueprint if needed
            // The stored format in shared Blueprints matches what was in Firestore
            // saveBlueprint expects: blueprintName, userId, modules (array)

            // Check structure of blueprint.modules
            // In NotebookViewer/store logic: 
            // "modules" in Firestore is an object: { "Module 1": { content: [], order: 0 }, ... }
            // saveBlueprint API expects an array of { moduleName, content } objects.

            // We need to convert the fetched blueprint.modules object back to the array format
            const modulesArray = Object.entries(blueprint.modules || {})
                .sort(([, a], [, b]) => a.order - b.order)
                .map(([name, data]) => ({
                    moduleName: name,
                    content: data.content
                }));

                console.log(modulesArray)
            await saveSharedBlueprint(blueprint.blueprintName, userId, modulesArray);

            setSaved(true);
            alert('Blueprint saved to your library!');
            router.push('/library'); // Redirect to library after saving?
        } catch (err) {
            console.error('Error saving blueprint:', err);
            alert(`Failed to save blueprint: ${err.message}`);
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className={styles.root}>
                <NavbarWithSearch />
                <div className={styles.container} style={{ justifyContent: 'center', alignItems: 'center' }}>
                    <div className={styles.loadingItem}>Loading shared blueprint...</div>
                </div>
            </div>
        );
    }

    if (error || !blueprint) {
        return (
            <div className={styles.root}>
                <NavbarWithSearch />
                <div className={styles.container} style={{ justifyContent: 'center', alignItems: 'center' }}>
                    <div className={styles.emptyState}>
                        <h3>{error || 'Blueprint not found'}</h3>
                        <button onClick={() => router.push('/dashboard')} className={styles.moduleBtn} style={{ marginTop: '20px', textAlign: 'center' }}>
                            Go Home
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    const sortedModules = Object.entries(blueprint.modules || {}).sort(([, a], [, b]) => a.order - b.order);
    const currentModuleEntry = sortedModules[selectedModule] || sortedModules[0];
    const [moduleName, moduleData] = currentModuleEntry || [null, null];

    return (
        <div className={styles.root}>
            <NavbarWithSearch />
            <div className={styles.container}>
                {/* Sidebar */}
                <div className={styles.moduleSidebar}>
                    <div className={styles.moduleSidebarHeader}>
                        Modules
                    </div>
                    {sortedModules.map(([name, _], idx) => (
                        <button
                            key={idx}
                            onClick={() => setSelectedModule(idx)}
                            className={`${styles.moduleBtn} ${selectedModule === idx ? styles.activeModuleBtn : ''}`}
                            title={name}
                        >
                            {idx + 1}. {name.replace(/^#+\s*/, '')}
                        </button>
                    ))}

                    <div style={{ marginTop: 'auto', paddingTop: '20px', borderTop: '1px solid #1f1f1f' }}>
                        <button
                            onClick={handleSaveToLibrary}
                            disabled={saving || saved}
                            className={styles.deleteBtn}
                            style={{ backgroundColor: '#3bf69fff', color: 'black', marginRight: '10px' }}
                        >
                            {saving ? 'Saving...' : saved ? 'Saved to Library' : 'Save to My Library'}
                        </button>
                    </div>
                </div>

                {/* Content Area */}
                <div className={styles.moduleContent}>
                    {moduleName ? (
                        <>
                            <div className={styles.moduleTitleBlock}>
                                <div>
                                    <h2>{moduleName.replace(/^#+\s*/, '')}</h2>
                                    <span className={styles.timestamp}>
                                        Shared Blueprint: {blueprint.blueprintName} • Created: {new Date(blueprint.createdAt).toLocaleDateString()}
                                    </span>
                                </div>
                            </div>

                            <div className={styles.notesContainer}>
                                <div className={styles.noteCard} style={{ border: 'none', background: 'transparent', boxShadow: 'none' }}>
                                    <div className={styles.noteBody} style={{ padding: 0 }}>
                                        {moduleData.content && moduleData.content.map((item, i) => (
                                            <div key={i} className="mb-4">
                                                {item.type === 'text' && (
                                                    <div className={styles.noteText}>
                                                        <SummaryFormatter content={item.data} />
                                                    </div>
                                                )}
                                                {item.type === 'image' && (
                                                    <div className={styles.noteImageContainer}>
                                                        <img
                                                            src={item.data.startsWith('pending:') ? '' : item.data}
                                                            alt="Module content"
                                                            className={styles.noteImage}
                                                            style={{ display: item.data.startsWith('pending:') ? 'none' : 'block' }}
                                                        />
                                                    </div>
                                                )}
                                                {item.type === 'video' && (
                                                    <div className="mt-2 p-3 bg-gray-900 border border-gray-700 rounded-lg">
                                                        <p className="text-teal-400 text-sm font-semibold mb-1">Video Resource</p>
                                                        <p className="text-gray-300">{item.data.replace('pending:', '')}</p>
                                                        <a
                                                            href={`https://www.youtube.com/results?search_query=${encodeURIComponent(item.data.replace('pending:', ''))}`}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="inline-block mt-2 text-blue-400 hover:text-blue-300 text-sm underline"
                                                        >
                                                            Search on YouTube
                                                        </a>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className={styles.emptyState}>No modules in this blueprint.</div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SharedBlueprintViewer;
