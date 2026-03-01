"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { setSession as setSessionAction, setHistory as setHistoryAction, appendMessage as appendMessageAction, updateLastAssistantMessage as updateLastAssistantMessageAction, clearVideo as clearVideoAction, selectMessagesByVideoId, selectSessionByVideoId } from '../../../../store/ChatBotSlice';
import { sendChatMessage } from '../../../pythonServices/VideoPlayerServices';
// Dynamic import to avoid circular dependency

function getQueryParams() {
  try {
    const params = new URLSearchParams(window.location.search);
    return {
      userId: params.get('user_id') || '',
      videoId: params.get('video_id') || ''
    };
  } catch {
    return { userId: '', videoId: '' };
  }
}

function classNames(...classes) {
  return classes.filter(Boolean).join(' ');
}

function cleanMarkdown(text) {
  try {
    return (text || '')
      .replace(/\*\*/g, '') // remove **
      .replace(/__+/g, '') // remove __
      .replace(/^#{1,6}\s*/gm, '') // remove ATX headers
      .replace(/^[=\-]{2,}\s*$/gm, '') // remove setext headers
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  } catch {
    return text;
  }
}

function renderMarkdown(text, isStreaming = false) {
  if (!text) return text;
  // Strip bold markers **...** and __...__ for display only
  if (typeof text === 'string') {
    text = text
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/__([^_]+)__/g, '$1');
  }
  // Heuristic: providers sometimes send list bullets inline without newlines.
  // If we detect bullets/timelines/numbered lists but no explicit newlines yet, insert virtual breaks for display.
  if (typeof text === 'string' && !/\n/.test(text)) {
    const hasAnyBullet = /\s[\*\-•]\s/.test(text);
    const hasTimeline = /(\*\*[0-5]\d:[0-5]\d\*\*\s*-\s*)|(\b[0-5]\d:[0-5]\d\b\s*-\s*)/.test(text);
    const hasInlineNumbers = /\s\d+\.\s/.test(text);
    if (hasAnyBullet || hasTimeline || hasInlineNumbers) {
      text = text
        // Bullets
        .replace(/\s\*\s/g, '\n* ')
        .replace(/\s-\s/g, '\n- ')
        .replace(/\s•\s/g, '\n• ')
        // Numbered list items (avoid start of string)
        .replace(/\s(\d+)\.\s/g, '\n$1. ')
        // Timestamps like **00:00** - or 00:00 -
        .replace(/(\*\*[0-5]\d:[0-5]\d\*\*\s*-\s*)/g, '\n$1')
        .replace(/(\b[0-5]\d:[0-5]\d\b\s*-\s*)/g, '\n$1');
    }
  }

  // For streaming, we need to handle incomplete lines at the end
  let processedText = text;
  let hasIncompleteLine = false;

  if (isStreaming && !text.endsWith('\n')) {
    // Add a temporary newline to process the last line, but mark it as incomplete
    processedText = text + '\n';
    hasIncompleteLine = true;
  }

  // Split by lines to handle headers and lists
  const lines = processedText.split('\n');
  const elements = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const isLastLine = i === lines.length - 1;
    const isIncomplete = hasIncompleteLine && isLastLine;

    // Handle headers
    if (line.match(/^#{1,6}\s/)) {
      const level = line.match(/^(#{1,6})/)[1].length;
      const content = line.replace(/^#{1,6}\s*/, '');
      elements.push({
        type: 'header',
        level,
        content: content.trim(),
        original: line,
        isIncomplete
      });
    }
    // Handle bullet points
    else if (line.match(/^\s*[\*\-\+]\s/)) {
      const content = line.replace(/^\s*[\*\-\+]\s*/, '');
      elements.push({
        type: 'bullet',
        content: content.trim(),
        original: line,
        isIncomplete
      });
    }
    // Handle numbered lists
    else if (line.match(/^\s*\d+\.\s/)) {
      const content = line.replace(/^\s*\d+\.\s*/, '');
      elements.push({
        type: 'numbered',
        content: content.trim(),
        original: line,
        isIncomplete
      });
    }
    // Handle regular text
    else if (line.trim()) {
      elements.push({
        type: 'text',
        content: line,
        original: line,
        isIncomplete
      });
    }
    // Handle empty lines
    else if (!isIncomplete) {
      elements.push({
        type: 'break',
        content: '',
        original: line
      });
    }
  }

  return elements;
}

// Helper function to render text with proper line breaks for streaming
function renderTextWithLineBreaks(text, isStreaming = false) {
  if (!text) return text;
  // Strip bold markers **...** and __...__ for display only
  if (typeof text === 'string') {
    text = text
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/__([^_]+)__/g, '$1');
  }
  // Same heuristic as above for inline bullets/timelines/numbered lists without newlines
  if (typeof text === 'string' && !/\n/.test(text)) {
    const hasAnyBullet = /\s[\*\-•]\s/.test(text);
    const hasTimeline = /(\*\*[0-5]\d:[0-5]\d\*\*\s*-\s*)|(\b[0-5]\d:[0-5]\d\b\s*-\s*)/.test(text);
    const hasInlineNumbers = /\s\d+\.\s/.test(text);
    if (hasAnyBullet || hasTimeline || hasInlineNumbers) {
      text = text
        .replace(/\s\*\s/g, '\n* ')
        .replace(/\s-\s/g, '\n- ')
        .replace(/\s•\s/g, '\n• ')
        .replace(/\s(\d+)\.\s/g, '\n$1. ')
        .replace(/(\*\*[0-5]\d:[0-5]\d\*\*\s*-\s*)/g, '\n$1')
        .replace(/(\b[0-5]\d:[0-5]\d\b\s*-\s*)/g, '\n$1');
    }
  }

  // Split by newlines and render each line
  const lines = text.split('\n');
  const elements = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const isLastLine = i === lines.length - 1;
    const isIncomplete = isStreaming && isLastLine && !text.endsWith('\n');

    if (line.trim()) {
      elements.push({
        type: 'text',
        content: line,
        isIncomplete
      });
    } else if (!isIncomplete) {
      elements.push({
        type: 'break',
        content: ''
      });
    }
  }

  return elements;
}

function parseTextWithCodeBlocks(raw, isStreaming = false) {
  // Splits text into segments: plain text and fenced code blocks
  // Supports ```lang\n...``` or ```lang ... ``` in one line
  const segments = [];
  if (!raw) return segments;

  // For streaming content, handle incomplete code blocks
  let content = raw;
  if (isStreaming) {
    // Check if we have an incomplete code block at the end
    const codeBlockMatch = content.match(/```([a-zA-Z0-9+_-]+)?\s*\n?([\s\S]*?)$/);
    if (codeBlockMatch && !content.includes('```', codeBlockMatch.index + 3)) {
      // We have an incomplete code block, treat the last part as text for now
      const beforeIncomplete = content.slice(0, codeBlockMatch.index);
      const incompletePart = content.slice(codeBlockMatch.index);
      content = beforeIncomplete + incompletePart.replace(/```([a-zA-Z0-9+_-]+)?\s*\n?/, '');
    }
  }

  const regex = /```([a-zA-Z0-9+_-]+)?\s*\n?([\s\S]*?)```/g;
  let lastIndex = 0;
  let match;
  while ((match = regex.exec(content)) !== null) {
    const start = match.index;
    const before = content.slice(lastIndex, start);
    if (before) segments.push({ type: 'text', content: before });
    const lang = (match[1] || '').trim();
    const code = (match[2] || '').trim();
    segments.push({ type: 'code', lang, content: code });
    lastIndex = regex.lastIndex;
  }
  const after = content.slice(lastIndex);
  if (after) segments.push({ type: 'text', content: after });
  return segments;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function formatCode(lang, code) {
  try {
    if (/\n/.test(code)) return code;
    let s = code
      .replace(/\s*;\s*/g, ';\n')
      .replace(/\s*\{\s*/g, ' {\n')
      .replace(/\s*\}\s*/g, '\n}\n')
      .replace(/\n{3,}/g, '\n\n');
    let indent = 0;
    const lines = s.split('\n').map((line) => {
      const t = line.trim();
      if (!t) return '';
      if (t.startsWith('}')) indent = Math.max(0, indent - 1);
      const out = '  '.repeat(indent) + t;
      if (t.endsWith('{')) indent += 1;
      return out;
    });
    return lines.join('\n').trim();
  } catch {
    return code;
  }
}

const Chatbot = ({ userId: propUserId = '', videoId: propVideoId = '' }) => {
  // Use actual user and video identifiers provided by parent
  const [userId, setUserId] = useState(propUserId || '');
  const [videoId, setVideoId] = useState(propVideoId || '');
  const [chatId, setChatId] = useState('');
  const [inputValue, setInputValue] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [statusText, setStatusText] = useState('Ready');
  const [loaderText, setLoaderText] = useState('');
  const [streamingMessageIndex, setStreamingMessageIndex] = useState(-1);
  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);

  const messagesEndRef = useRef(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const autoReinitRanRef = useRef(false);
  const lastVideoRef = useRef('');
  const initializingRef = useRef(false);
  const initializedKeyRef = useRef(null); // Track what we've already initialized
  const [isHistoryLoading, setIsHistoryLoading] = useState(true);
  const suggestionQuestions = useMemo(() => [
    'Give me a quick summary of this video',
    'List 5 key takeaways from this video'
  ], []);

  const dispatch = useDispatch();
  const storeMessages = useSelector((state) => selectMessagesByVideoId(state, videoId));
  const storeSession = useSelector((state) => selectSessionByVideoId(state, videoId));


  // Keep local state in sync with props
  useEffect(() => {
    setUserId(propUserId || '');
  }, [propUserId]);

  useEffect(() => {
    setVideoId(propVideoId || '');
  }, [propVideoId]);

  // Do not show chat id in UI; keep subtle status only for actions
  useEffect(() => {
    setStatusText('Ready');
  }, [userId, videoId]);

  // Streaming loader text that cycles every 2 seconds while streaming
  useEffect(() => {
    const phrases = [
      'Thinking…',
      'Searching…',
      'Analyzing…',
      'Reasoning…',
      'Gathering context…',
      'Composing answer…'
    ];
    let idx = 0;
    let timerId = null;
    if (isStreaming) {
      setLoaderText(phrases[idx]);
      timerId = setInterval(() => {
        idx = (idx + 1) % phrases.length;
        setLoaderText(phrases[idx]);
      }, 2000);
    } else {
      setLoaderText('');
    }
    return () => {
      if (timerId) clearInterval(timerId);
    };
  }, [isStreaming]);

  const canChat = useMemo(() => Boolean(userId && videoId && (chatId || storeSession.chatId)), [userId, videoId, chatId, storeSession.chatId]);

  // Scroll to bottom on messages update
  useEffect(() => {
    try {
      messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
    } catch { }
  }, [storeMessages]);


  // Message helpers must be defined before effects that reference them

  const updateLastAssistantMessage = useCallback((content) => {
    dispatch(updateLastAssistantMessageAction({ videoId, content }));
  }, [dispatch, videoId]);

  // History is initialized via Watch.js init; no explicit history fetch here

  // Remove internal init: Chat session is initialized in Watch.js and stored in Redux
  useEffect(() => {
    const sid = storeSession.chatId;
    if (sid && !chatId) {
      setChatId(sid);
      setIsInitialized(true);
      setIsHistoryLoading(false);
    }
  }, [storeSession.chatId, chatId]);

  // Reset state when video actually changes (not on first mount)
  useEffect(() => {
    // On first mount, just record current videoId and do not clear Redux
    if (!lastVideoRef.current) {
      lastVideoRef.current = videoId;
      return;
    }
    if (lastVideoRef.current !== videoId) {
      lastVideoRef.current = videoId;
      dispatch(clearVideoAction({ videoId }));
      setChatId('');
      setIsInitialized(false);
      setSelectedImage(null);
      setImagePreview(null);
      initializingRef.current = false; // Reset initialization flag
      initializedKeyRef.current = null; // Reset initialized key
    }
  }, [videoId, dispatch]);

  // If Redux already has messages for this video, ensure loading is off after remount/tab switch
  useEffect(() => {
    if (Array.isArray(storeMessages) && storeMessages.length > 0) {
      setIsHistoryLoading(false);
    }
  }, [storeMessages]);

  // Image handling functions
  const handleImageSelect = useCallback((event) => {
    const file = event.target.files?.[0];
    if (!file) {
      setSelectedImage(null);
      setImagePreview(null);
      return;
    }

    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    setSelectedImage(file);

    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setImagePreview(e.target.result);
    };
    reader.readAsDataURL(file);
  }, []);

  const clearImage = useCallback(() => {
    setSelectedImage(null);
    setImagePreview(null);
  }, []);

  // Convert image to base64 attachment payload (like test HTML)
  const getAttachmentPayload = useCallback(async () => {
    if (!selectedImage) return null;

    try {
      const arrayBuf = await selectedImage.arrayBuffer();
      const bytes = new Uint8Array(arrayBuf);
      let binary = '';
      for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const b64 = btoa(binary);

      return {
        data_base64: b64,
        filename: selectedImage.name,
        mime_type: selectedImage.type || 'application/octet-stream',
        size_bytes: selectedImage.size
      };
    } catch (error) {
      console.error('Error converting image to base64:', error);
      return null;
    }
  }, [selectedImage]);



  const processMessage = useCallback(async (message) => {
    if (!canChat || isHistoryLoading) return;
    if (isStreaming) return;
    const trimmed = (message || '').trim();
    if (!trimmed) return;

    setIsStreaming(true);

    try {
      let clearedInput = false;
      let responseBuffer = '';

      // Add optimistic user message to Redux for immediate UI feedback
      const optimisticUserMessage = {
        role: 'user',
        content: trimmed,
        attachments: selectedImage ? [{ url: imagePreview, type: 'preview' }] : [],
        timestamp: Date.now(),
        optimistic: true
      };
      dispatch(appendMessageAction({ videoId, message: optimisticUserMessage }));

      // Add empty assistant message for streaming in Redux
      const optimisticAssistantMessage = {
        role: 'assistant',
        content: '',
        attachments: [],
        timestamp: Date.now(),
        optimistic: true
      };
      dispatch(appendMessageAction({ videoId, message: optimisticAssistantMessage }));

      // Get attachment payload
      const attachment = await getAttachmentPayload();

      await sendChatMessage(
        chatId,
        trimmed,
        attachment,
        (chunk) => {
          if (!clearedInput) {
            setInputValue('');
            clearImage(); // Clear image after sending
            clearedInput = true;
          }
          responseBuffer += chunk;

          // Use flushSync to force immediate UI update for streaming effect
          updateLastAssistantMessage(responseBuffer);
        },
        (error) => {
          // Append error message; backend refresh will replace optimistic when possible
          dispatch(appendMessageAction({ videoId, message: { role: 'assistant', content: `Error: ${error}`, attachments: [], timestamp: Date.now() } }));
        }
      );
    } catch (err) {
      // Append error message to Redux
      dispatch(appendMessageAction({ videoId, message: { role: 'assistant', content: `Error: ${err?.message || String(err)}`, attachments: [], timestamp: Date.now() } }));
    } finally {
      setIsStreaming(false);
      setStreamingMessageIndex(-1);
    }
  }, [canChat, isHistoryLoading, isStreaming, updateLastAssistantMessage, chatId, selectedImage, imagePreview, getAttachmentPayload, clearImage, dispatch, videoId]);

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    const message = inputValue.trim();
    await processMessage(message);
  }, [inputValue, processMessage]);

  const handleSuggestionClick = useCallback(async (q) => {
    setInputValue(q);
    await processMessage(q);
  }, [processMessage]);

  // Remove reinitialize function as it's not needed with the new chat session approach

  return (
    <div className="w-full h-full md:h-[580px] bg-darkBlueGray rounded-md flex flex-col p-3 box-border text-white">

      <main id="chat-container" className="rounded-md p-3 bg-darkBlueGray flex-1 min-h-0 flex flex-col mt-0 mb-3">
        <div id="messages" className="chat-scroll flex flex-col gap-2 overflow-y-auto flex-1">
          {!isHistoryLoading && storeMessages.length === 0 && (
            <div className="mx-auto flex flex-col sm:flex-row gap-2 sm:gap-4">
              {suggestionQuestions.map((q) => (
                <button
                  key={q}
                  onClick={() => handleSuggestionClick(q)}
                  className="text-xs sm:text-sm"
                  style={{
                    height: 'auto',
                    minHeight: 60,
                    width: '100%',
                    maxWidth: 240,
                    padding: '8px 12px',
                    borderRadius: 14,
                    border: '1px solid rgba(255,255,255,0.9)',
                    background: 'linear-gradient(135deg, rgba(52,211,153,0.18), rgba(52,211,153,0.05))',
                    color: '#ffffff',
                    cursor: 'pointer',
                    boxShadow: '0 8px 18px rgba(52,211,153,0.12)',
                  }}
                >
                  {q}
                </button>
              ))}
            </div>
          )}
          {isHistoryLoading && (
            <div className="self-center text-gray-400 text-sm">Loading chats…</div>
          )}
          {storeMessages.map((m, idx) => {
            const isCurrentlyStreaming = isStreaming && streamingMessageIndex === idx;

            // Special handling: If a user message has an image and text, render as two separate bubbles
            if (m.role === 'user' && m.attachments && m.attachments.length > 0) {
              const hasText = Boolean((m.content || '').trim());
              const imageBubble = (
                <div
                  key={`${idx}-img`}
                  className={classNames('msg', m.role)}
                  style={{
                    alignSelf: 'flex-end',
                    background: '#34d399',
                    color: '#ffffff',
                    padding: '8px 10px',
                    borderRadius: 8,
                    maxWidth: '90%',
                    fontSize: '14px',
                    lineHeight: '1.4',
                    marginBottom: hasText ? 6 : 0
                  }}
                >
                  <div style={{ marginTop: 0 }}>
                    {m.attachments.map((attachment, attIdx) => {
                      if (attachment.url) {
                        return (
                          <img
                            key={attIdx}
                            src={attachment.url}
                            alt="Attachment"
                            style={{
                              maxWidth: '200px',
                              maxHeight: '150px',
                              border: '1px solid #ddd',
                              borderRadius: '6px',
                              display: 'block',
                              marginBottom: '4px'
                            }}
                          />
                        );
                      }
                      return null;
                    })}
                  </div>
                </div>
              );

              if (!hasText) {
                return imageBubble;
              }

              const textBubble = (
                <div
                  key={`${idx}-txt`}
                  className={classNames('msg', m.role)}
                  style={{
                    alignSelf: 'flex-end',
                    background: '#34d399',
                    color: '#ffffff',
                    padding: '8px 10px',
                    borderRadius: 8,
                    maxWidth: '90%',
                    fontSize: '14px',
                    lineHeight: '1.4'
                  }}
                >
                  <span style={{ whiteSpace: 'pre-wrap' }}>{m.content}</span>
                </div>
              );

              return (
                <React.Fragment key={idx}>
                  {imageBubble}
                  {textBubble}
                </React.Fragment>
              );
            }

            return (
              <div
                key={idx}
                className={classNames('msg', m.role)}
                style={{
                  alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                  background: m.role === 'user' ? '#34d399' : '#1f2937',
                  color: '#ffffff',
                  padding: '8px 10px',
                  borderRadius: 8,
                  maxWidth: '90%',
                  fontSize: '14px',
                  lineHeight: '1.4'
                }}
              >
                {/* Message content */}
                {m.role === 'assistant'
                  ? (
                    (() => {
                      const segments = parseTextWithCodeBlocks(m.content, isCurrentlyStreaming);
                      // If there are no segments yet (empty assistant message), still show loader immediately
                      if ((!segments || segments.length === 0) && isStreaming && idx === storeMessages.length - 1 && loaderText) {
                        return (
                          <div className="text-gray-300 text-xs mb-1" style={{ opacity: 0.9 }}>
                            {loaderText}
                          </div>
                        );
                      }
                      return segments.map((seg, i) => {
                        // Streaming status inline where the response appears (only for the last assistant message)
                        if (i === 0 && isStreaming && idx === storeMessages.length - 1 && loaderText) {
                          return (
                            <div key={`loader-${idx}`} className="text-gray-300 text-xs mb-1" style={{ opacity: 0.9 }}>
                              {loaderText}
                            </div>
                          );
                        }
                        if (seg.type === 'code') {
                          const pretty = formatCode(seg.lang, seg.content);
                          return (
                            <pre key={i} className="code-scroll" style={{ background: '#0b0b0b', border: '1px solid white', borderRadius: 6, padding: '10px', margin: '8px 0', overflow: 'auto', whiteSpace: 'pre', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, \'Liberation Mono\', \'Courier New\', monospace', fontSize: 13 }}>
                              <code>{escapeHtml(pretty)}</code>
                            </pre>
                          );
                        }
                        return (
                          <div key={i}>
                            {(() => {
                              const markdownElements = renderMarkdown(seg.content, isCurrentlyStreaming);
                              // If we have markdown elements, use them; otherwise fall back to simple line breaks
                              if (markdownElements.length > 0 && markdownElements.some(el => el.type !== 'text' || el.content.trim())) {
                                return markdownElements.map((element, elemIdx) => {
                                  if (element.type === 'header') {
                                    const headerLevel = Math.min(element.level + 1, 6);
                                    const headerStyle = {
                                      fontSize: `${Math.max(16 - element.level, 12)}px`,
                                      color: '#ffffff',
                                      fontWeight: 'bold',
                                      marginBottom: '8px',
                                      marginTop: '12px'
                                    };
                                    if (headerLevel === 1) {
                                      return <h1 key={elemIdx} style={headerStyle}>{element.content}</h1>;
                                    } else if (headerLevel === 2) {
                                      return <h2 key={elemIdx} style={headerStyle}>{element.content}</h2>;
                                    } else if (headerLevel === 3) {
                                      return <h3 key={elemIdx} style={headerStyle}>{element.content}</h3>;
                                    } else if (headerLevel === 4) {
                                      return <h4 key={elemIdx} style={headerStyle}>{element.content}</h4>;
                                    } else if (headerLevel === 5) {
                                      return <h5 key={elemIdx} style={headerStyle}>{element.content}</h5>;
                                    } else {
                                      return <h6 key={elemIdx} style={headerStyle}>{element.content}</h6>;
                                    }
                                  } else if (element.type === 'bullet') {
                                    return (
                                      <div key={elemIdx} className="flex items-start mb-1">
                                        <span className="text-white mr-2 mt-1">•</span>
                                        <span className="text-white flex-1">{element.content}</span>
                                        {!element.isIncomplete && <br />}
                                      </div>
                                    );
                                  } else if (element.type === 'numbered') {
                                    return (
                                      <div key={elemIdx} className="flex items-start mb-1">
                                        <span className="text-white mr-2 mt-1">{element.original.match(/^\s*(\d+)\./)?.[1] || '•'}.</span>
                                        <span className="text-white flex-1">{element.content}</span>
                                        {!element.isIncomplete && <br />}
                                      </div>
                                    );
                                  } else if (element.type === 'break') {
                                    return <br key={elemIdx} />;
                                  } else {
                                    return (
                                      <span key={elemIdx} style={{ whiteSpace: 'pre-wrap' }}>
                                        {element.content}
                                        {!element.isIncomplete && <br />}
                                      </span>
                                    );
                                  }
                                });
                              } else {
                                // Fallback to simple line break rendering
                                return renderTextWithLineBreaks(seg.content, isCurrentlyStreaming).map((element, elemIdx) => (
                                  <span key={elemIdx} style={{ whiteSpace: 'pre-wrap' }}>
                                    {element.content}
                                    {!element.isIncomplete && <br />}
                                  </span>
                                ));
                              }
                            })()}
                            {isCurrentlyStreaming && i === parseTextWithCodeBlocks(m.content, isCurrentlyStreaming).length - 1 && (
                              <span className="inline-block w-2 h-4 bg-white ml-1 animate-pulse" style={{ verticalAlign: 'text-bottom' }}></span>
                            )}
                          </div>
                        );
                      });
                    })()
                  )
                  : (
                    (() => {
                      const hasImage = m.attachments && m.attachments.length > 0;
                      if (m.role === 'user' && hasImage) {
                        return (
                          <>
                            <div style={{ marginBottom: '8px' }}>
                              {m.attachments.map((attachment, attIdx) => {
                                if (attachment.url) {
                                  return (
                                    <img
                                      key={attIdx}
                                      src={attachment.url}
                                      alt="Attachment"
                                      style={{
                                        maxWidth: '200px',
                                        maxHeight: '150px',
                                        border: '1px solid #ddd',
                                        borderRadius: '6px',
                                        display: 'block'
                                      }}
                                    />
                                  );
                                }
                                return null;
                              })}
                            </div>
                            <div>
                              <span style={{ whiteSpace: 'pre-wrap' }}>{m.content}</span>
                            </div>
                          </>
                        );
                      }
                      return <span style={{ whiteSpace: 'pre-wrap' }}>{m.content}</span>;
                    })()
                  )
                }

                {/* Image attachments (like test HTML) for non-user or messages without special handling */}
                {m.attachments && m.attachments.length > 0 && m.role !== 'user' && (
                  <div style={{ marginTop: '8px' }}>
                    {m.attachments.map((attachment, attIdx) => {
                      if (attachment.url) {
                        return (
                          <img
                            key={attIdx}
                            src={attachment.url}
                            alt="Attachment"
                            style={{
                              maxWidth: '200px',
                              maxHeight: '150px',
                              border: '1px solid #ddd',
                              borderRadius: '6px',
                              display: 'block',
                              marginBottom: '4px'
                            }}
                          />
                        );
                      }
                      return null;
                    })}
                  </div>
                )}
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>
      </main>

      <footer className="mt-0">
        {/* Image preview */}
        {imagePreview && (
          <div className="mb-2 p-2 border border-white/20 rounded-md bg-gray-800">
            <div className="flex items-start gap-2">
              <img
                src={imagePreview}
                alt="Preview"
                style={{
                  maxWidth: '100px',
                  maxHeight: '80px',
                  border: '1px solid #ddd',
                  borderRadius: '4px'
                }}
              />
              <button
                type="button"
                onClick={clearImage}
                className="px-2 py-1 bg-red-500 text-white text-xs rounded hover:bg-red-600"
              >
                Remove
              </button>
            </div>
          </div>
        )}

        <form id="chat-form" onSubmit={handleSubmit} className="flex flex-col gap-2">
          <div className="flex gap-2 items-center">
            <input
              id="chat-input"
              type="text"
              placeholder={canChat ? 'Type your message…' : 'Initializing chat...'}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              disabled={!canChat || isStreaming || isHistoryLoading}
              className="flex-1 px-2 sm:px-3 py-2 border border-white rounded-lg bg-gray-800 text-white text-sm sm:text-base"
            />

            {/* Image upload button (icon) placed to the left of Send */}
            <input
              id="chat-image-input"
              type="file"
              accept="image/*"
              onChange={handleImageSelect}
              disabled={!canChat || isStreaming || isHistoryLoading}
              className="hidden"
            />
            <label
              htmlFor="chat-image-input"
              title={(!canChat || isStreaming || isHistoryLoading) ? 'Disabled' : 'Attach image'}
              className={`flex items-center justify-center w-10 h-10 rounded-full border-0 ${(!canChat || isStreaming || isHistoryLoading) ? 'bg-gray-400 text-black cursor-not-allowed' : 'bg-green-400 text-black cursor-pointer hover:bg-green-500'}`}
            >
              {/* Camera/Image icon */}
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-black">
                <path d="M4 7a3 3 0 0 1 3-3h2.172a2 2 0 0 1 1.414.586l.828.828H17a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V7zm8 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z" />
              </svg>
            </label>

            <button
              id="send-btn"
              type="submit"
              disabled={!canChat || isStreaming || isHistoryLoading}
              className={`px-2 sm:px-3 py-2 border-0 rounded-full text-black text-sm sm:text-base ${(!canChat || isStreaming || isHistoryLoading) ? 'cursor-not-allowed bg-gray-400' : 'cursor-pointer bg-green-400 hover:bg-green-500'}`}
            >
              Send
            </button>
          </div>
        </form>
      </footer>
      <style jsx>{`
        /* Slim dark scrollbar for WebKit */
        .chat-scroll::-webkit-scrollbar { width: 6px; height: 6px; }
        .chat-scroll::-webkit-scrollbar-track { background: #0b0b0b; }
        .chat-scroll::-webkit-scrollbar-thumb { background: #111111; border-radius: 6px; }
        .chat-scroll::-webkit-scrollbar-thumb:hover { background: #1a1a1a; }
        #chat-container::-webkit-scrollbar { width: 6px; height: 6px; }
        #chat-container::-webkit-scrollbar-track { background: #0b0b0b; }
        #chat-container::-webkit-scrollbar-thumb { background: #111111; border-radius: 6px; }
        #chat-container::-webkit-scrollbar-thumb:hover { background: #1a1a1a; }

        /* Firefox */
        .chat-scroll { scrollbar-width: thin; scrollbar-color: #111111 #0b0b0b; }
        #chat-container { scrollbar-width: thin; scrollbar-color: #111111 #0b0b0b; }

        /* Code block scrollbars */
        .code-scroll::-webkit-scrollbar { height: 6px; width: 6px; }
        .code-scroll::-webkit-scrollbar-track { background: #0b0b0b; }
        .code-scroll::-webkit-scrollbar-thumb { background: #111111; border-radius: 6px; }
        .code-scroll { scrollbar-width: thin; scrollbar-color: #111111 #0b0b0b; }
      `}</style>
    </div>
  );
};

export default Chatbot;