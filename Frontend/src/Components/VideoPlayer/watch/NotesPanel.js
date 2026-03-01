"use client";
import React, { useEffect, useRef, useState, useCallback } from 'react';
import debounce from 'lodash.debounce';
import PropTypes from 'prop-types';
import { getUserNote, saveUserNote } from '@/services/videoPlayerServices';

// Module-level guard to prevent multiple initial-save requests for the same userId:videoId
const initialSavedSet = new Set();

/**
 * NotesPanel
 * Props:
 * - userId
 * - videoId
 * - className (optional) - applied to container
 * - textareaClassName (optional) - applied to textarea
 * - placeholder (optional)
 */
const NotesPanel = ({ userId, videoId, className = '', textareaClassName = '', placeholder = 'Add your notes here...' }) => {
	const [notes, setNotes] = useState('');
	// Indicates whether the initial fetch for this note has completed (even if empty)
	const [noteLoaded, setNoteLoaded] = useState(false);

	useEffect(() => {
		let mounted = true;
		const fetchExistingNote = async () => {
			if (userId && videoId) {
				try {
					const result = await getUserNote(userId, videoId);
					if (mounted) setNotes(result.note?.content || '');
					if (mounted) setNoteLoaded(true);
				} catch (_) {
					if (mounted) setNotes('');
					if (mounted) setNoteLoaded(true);
				}
			} else {
				if (mounted) setNotes('');
				if (mounted) setNoteLoaded(true);
			}
		};
		fetchExistingNote();
		return () => { mounted = false; };
	}, [userId, videoId]);

	// Ensure a save-note call happens once per video regardless of content (store "" if empty).
	// Use the module-level Set to prevent duplicate saves across multiple mounted instances.
	useEffect(() => {
		if (!userId || !videoId || !noteLoaded) return;
		const key = `${userId}:${videoId}`;
		if (initialSavedSet.has(key)) return;
		initialSavedSet.add(key);
		// Fire and forget; backend handles empty content as valid note
		(async () => {
			try { await saveUserNote(userId, videoId, notes || ''); } catch (_) {}
		})();
	}, [userId, videoId, noteLoaded]);

	const saveNote = useCallback(async (text) => {
		if (userId && videoId) {
			try {
				await saveUserNote(userId, videoId, text);
			} catch (_) { /* ignore */ }
		}
	}, [userId, videoId]);

	const debouncedSaveNote = useCallback(
		debounce((text) => saveNote(text), 1000),
		[saveNote]
	);

	useEffect(() => {
		return () => {
			debouncedSaveNote.flush && debouncedSaveNote.flush();
		};
	}, [debouncedSaveNote]);

	const handleNotesChange = (e) => {
		const newContent = e.target.value;
		setNotes(newContent);
		debouncedSaveNote(newContent);
	};

	return (
		<div className={className}>
			<div className="flex justify-between align-center mb-[15px]">
				<h2 className='m-0 border-none text-white'>Notes</h2>
				<button className="mt-0 w-[150px] p-[8px] bg-green-400 text-black border-none rounded-[25px] hover:bg-green-500 text-sm">
					<i className="mr-[8px] fas fa-save"></i>
					Auto Save On!
				</button>
			</div>
			<textarea
				placeholder={placeholder}
				className={textareaClassName || "w-full bg-[#0b0b0b] text-[#e5e7eb] border border-white/20 rounded-md p-2 h-[440px] resize-none"}
				value={notes}
				onChange={handleNotesChange}
			/>
		</div>
	);
};

NotesPanel.propTypes = {
	userId: PropTypes.string,
	videoId: PropTypes.string,
	className: PropTypes.string,
	textareaClassName: PropTypes.string,
	placeholder: PropTypes.string
};

export default NotesPanel;

