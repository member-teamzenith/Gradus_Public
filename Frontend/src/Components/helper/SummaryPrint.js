"use client"

// Exported utility to generate and download the summary PDF
export async function printSummaryToPDF(summaryText, videoTitle = 'Summary') {
    try {
        // Check if text contains non-Latin characters
        function hasUnicodeText(text) {
            // Check for common Unicode ranges: Devanagari, Arabic, CJK, etc.
            return /[\u0900-\u097F\u0600-\u06FF\u4E00-\u9FFF\u3040-\u30FF\uAC00-\uD7AF]/.test(text);
        }

        const needsUnicode = hasUnicodeText(summaryText || '');

        async function ensureJsPDF() {
            if (typeof window === 'undefined') throw new Error('Not in browser');
            if (window.jspdf && window.jspdf.jsPDF) return window.jspdf.jsPDF;
            await new Promise((resolve, reject) => {
                const script = document.createElement('script');
                script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
                script.async = true;
                script.onload = resolve;
                script.onerror = () => reject(new Error('Failed to load jsPDF'));
                document.body.appendChild(script);
            });
            if (!(window.jspdf && window.jspdf.jsPDF)) throw new Error('jsPDF not available');
            return window.jspdf.jsPDF;
        }

        const JS = await ensureJsPDF();
        
        // For Unicode text, use html2canvas approach instead of direct text rendering
        if (needsUnicode) {
            return await generateUnicodePDF(summaryText, videoTitle);
        }

        const doc = new JS({ 
            unit: 'mm', 
            format: 'a4', 
            orientation: 'portrait', 
            compress: true,
            putOnlyUsedFonts: true,
            floatPrecision: 16
        });

        const margin = 12;
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const usableWidth = pageWidth - margin * 2;
        const lineHeight = 6;

        // Load top-right logo
        async function loadLogo(url) {
            return await new Promise((resolve) => {
                const img = new Image();
                img.crossOrigin = 'anonymous';
                img.onload = () => resolve(img);
                img.onerror = () => resolve(null);
                img.src = url;
            });
        }

        const logoUrl = 'https://res.cloudinary.com/dlsgdlo8u/image/upload/v1742127578/gradus_logo-rbg_wuzawn.png';
        const logoImg = await loadLogo(logoUrl);

        function drawLogo(docInstance) {
            if (!logoImg) return;
            const imgWidth = 30; // adjust size
            const aspect = logoImg.naturalHeight / logoImg.naturalWidth;
            const imgHeight = imgWidth * aspect;
            const x = pageWidth - imgWidth - margin;
            const y = margin / 2;
            try {
                docInstance.addImage(logoImg, 'PNG', x, y, imgWidth, imgHeight);
            } catch (_) {}
        }

        function drawPageBorder(docInstance) {
            // Draw border around the page
            docInstance.setDrawColor(0, 0, 0); // Black border
            docInstance.setLineWidth(0.5);
            docInstance.rect(margin / 2, margin / 2, pageWidth - margin, pageHeight - margin);
        }

        // Title - use video title instead of "Summary"
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(14);
        const titleText = videoTitle || 'Summary';
        // Truncate title if too long - leave space for logo and borders
        const maxTitleWidth = pageWidth - (margin * 3) - 35; // Extra margin for logo
        let displayTitle = titleText;
        
        // Check if title fits, if not truncate with ellipsis
        if (doc.getTextWidth(displayTitle) > maxTitleWidth) {
            while (doc.getTextWidth(displayTitle + '...') > maxTitleWidth && displayTitle.length > 0) {
                displayTitle = displayTitle.slice(0, -1);
            }
            displayTitle = displayTitle.trim() + '...';
        }
        
        const titleWidth = doc.getTextWidth(displayTitle);
        doc.text(displayTitle, margin, margin);

        // Add logo and border on first page
        drawLogo(doc);
        drawPageBorder(doc);

        // Decode HTML entities helper function
        function decodeHTMLEntities(text) {
            if (typeof document === 'undefined') return text;
            const textarea = document.createElement('textarea');
            textarea.innerHTML = text;
            return textarea.value;
        }

        // Strip HTML tags and decode entities while preserving line breaks
        function stripHTMLAndDecode(html) {
            if (!html) return '';
            // First decode HTML entities
            let text = decodeHTMLEntities(html);
            // Remove HTML tags but preserve structure
            text = text.replace(/<br\s*\/?>/gi, '\n'); // Convert <br> to newlines
            text = text.replace(/<\/p>/gi, '\n\n'); // Convert </p> to double newlines
            text = text.replace(/<p[^>]*>/gi, ''); // Remove opening <p> tags
            text = text.replace(/<\/h[1-6]>/gi, '\n'); // Convert closing header tags to newlines
            text = text.replace(/<h[1-6][^>]*>/gi, ''); // Remove opening header tags
            text = text.replace(/<li[^>]*>/gi, '\n• '); // Convert <li> to bullet points
            text = text.replace(/<\/li>/gi, ''); // Remove </li>
            text = text.replace(/<[^>]*>/g, ''); // Remove all remaining HTML tags
            // Decode entities again in case they were inside tags
            text = decodeHTMLEntities(text);
            // Clean up excessive whitespace but preserve line breaks
            text = text.replace(/[ \t]+/g, ' '); // Multiple spaces/tabs to single space
            text = text.replace(/\n\s+\n/g, '\n\n'); // Clean up whitespace between paragraphs
            text = text.replace(/\n{3,}/g, '\n\n'); // Max 2 consecutive newlines
            return text.trim();
        }

        // Prepare content
        let raw = String(summaryText || 'No summary available.');
        // Strip HTML tags and decode entities for proper rendering
        raw = stripHTMLAndDecode(raw);
        const lines = raw.split('\n');

        let cursorY = margin + 10;

        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) {
                cursorY += 2; // Reduced empty line spacing
                continue;
            }

            // Headings (Markdown style ### or ** wrapped)
            const headingMatch = trimmed.match(/^(#{1,6})\s+(.*)$/);
            const isBoldLine = /^\*\*(.+)\*\*$/.test(trimmed);
            if (headingMatch || isBoldLine) {
                // Add spacing before heading (except for first heading)
                if (cursorY > margin + 15) {
                    cursorY += 4;
                }
                
                const level = headingMatch ? headingMatch[1].length : 2;
                let content = headingMatch ? headingMatch[2] : trimmed.replace(/^\*\*(.+?)\*\*$/, '$1');
                // Remove any remaining markdown or HTML artifacts
                content = content.replace(/[`*_~]/g, '').trim();
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(level === 1 ? 14 : level === 2 ? 13 : 12);
                const headerLines = doc.splitTextToSize(content, usableWidth);
                for (const hl of headerLines) {
                    if (cursorY > pageHeight - margin) {
                        doc.addPage();
                        drawLogo(doc);
                        drawPageBorder(doc);
                        cursorY = margin;
                    }
                    doc.text(hl, margin, cursorY);
                    cursorY += lineHeight;
                }
                // No extra gap after header - content starts immediately
                continue;
            }

            // Regular text with inline **bold** and bullet points
            let actualText = trimmed;
            let indent = margin;
            
            // Check if this is a bullet point
            const bulletMatch = actualText.match(/^[•\-\*]\s+(.+)$/);
            if (bulletMatch) {
                actualText = bulletMatch[1];
                indent = margin + 5; // Indent bullet content
                // Draw bullet point
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(12);
                doc.text('•', margin, cursorY);
            }

            const segments = [];
            let rest = actualText;
            // Remove inline code markers and other markdown artifacts first
            rest = rest.replace(/`([^`]+)`/g, '$1'); // Remove backticks
            rest = rest.replace(/\[KEY\](.*?)\[\/KEY\]/g, '$1'); // Remove KEY markers
            rest = rest.replace(/\[DEF\](.*?)\[\/DEF\]/g, '$1'); // Remove DEF markers
            
            while (rest.length > 0) {
                const start = rest.indexOf('**');
                if (start === -1) {
                    segments.push({ text: rest, bold: false });
                    break;
                }
                if (start > 0) segments.push({ text: rest.slice(0, start), bold: false });
                const afterStart = rest.slice(start + 2);
                const end = afterStart.indexOf('**');
                if (end === -1) {
                    segments.push({ text: rest, bold: false });
                    break;
                }
                const boldText = afterStart.slice(0, end);
                segments.push({ text: boldText, bold: true });
                rest = afterStart.slice(end + 2);
            }

            const plain = segments.map(s => s.text).join('');
            const wrapped = doc.splitTextToSize(plain, usableWidth - (indent - margin));

            for (let i = 0; i < wrapped.length; i++) {
                if (cursorY > pageHeight - margin) {
                    doc.addPage();
                    drawLogo(doc);
                    drawPageBorder(doc);
                    cursorY = margin;
                }
                
                const wrappedLine = wrapped[i];
                let charIndex = 0;
                let x = indent;
                
                // Find and render each segment within this wrapped line
                for (const seg of segments) {
                    if (charIndex >= plain.length) break;
                    
                    // Find where this segment starts in the plain text
                    const segStartInPlain = plain.indexOf(seg.text, charIndex);
                    if (segStartInPlain === -1 || segStartInPlain >= charIndex + wrappedLine.length) {
                        // This segment is not in the current wrapped line
                        continue;
                    }
                    
                    // Calculate the portion of this segment that appears in this wrapped line
                    const startInLine = Math.max(0, segStartInPlain - charIndex);
                    const endInLine = Math.min(wrappedLine.length, segStartInPlain + seg.text.length - charIndex);
                    
                    if (startInLine < endInLine) {
                        const chunk = wrappedLine.substring(startInLine, endInLine);
                        if (chunk) {
                            doc.setFont('helvetica', seg.bold ? 'bold' : 'normal');
                            doc.setFontSize(12);
                            doc.text(chunk, x, cursorY, { baseline: 'top' });
                            x += doc.getTextWidth(chunk);
                        }
                    }
                }
                
                cursorY += lineHeight;
                
                // Move character index forward by the length of this wrapped line
                charIndex += wrappedLine.length;
            }
            cursorY += 1;
        }

        doc.save('summary.pdf');
        return true;
    } catch (err) {
        console.error(err);
        return false;
    }
}
// Generate PDF for Unicode/non-Latin text using html2canvas
async function generateUnicodePDF(summaryText, videoTitle = 'Summary') {
    try {
        // Load dependencies
        async function loadLibrary(url, globalCheck) {
            if (globalCheck()) return globalCheck();
            await new Promise((resolve, reject) => {
                const script = document.createElement('script');
                script.src = url;
                script.async = true;
                script.onload = resolve;
                script.onerror = () => reject(new Error(`Failed to load ${url}`));
                document.body.appendChild(script);
            });
            return globalCheck();
        }

        const [jsPDF, html2canvas] = await Promise.all([
            loadLibrary(
                'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
                () => window.jspdf?.jsPDF
            ),
            loadLibrary(
                'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js',
                () => window.html2canvas
            )
        ]);

        if (!jsPDF || !html2canvas) {
            throw new Error('Failed to load required libraries');
        }

        // Create a temporary container with proper styling
        const container = document.createElement('div');
        container.style.cssText = `
            position: fixed;
            left: -9999px;
            top: 0;
            width: 210mm;
            padding: 20mm;
            background: white;
            font-family: 'Segoe UI', Arial, sans-serif;
            font-size: 12pt;
            line-height: 1.6;
            color: black;
        `;

        // Process the summary text
        function stripHTMLAndDecode(html) {
            if (!html) return '';
            const textarea = document.createElement('textarea');
            textarea.innerHTML = html;
            let text = textarea.value;
            text = text.replace(/<[^>]*>/g, '');
            textarea.innerHTML = text;
            return textarea.value;
        }

        let processedText = stripHTMLAndDecode(summaryText);
        
        // Convert markdown to HTML with proper formatting
        processedText = processedText
            // Headers
            .replace(/^### (.*?)$/gm, '<h3 style="font-size: 14pt; font-weight: bold; margin-top: 10px; margin-bottom: 5px;">$1</h3>')
            .replace(/^## (.*?)$/gm, '<h2 style="font-size: 16pt; font-weight: bold; margin-top: 12px; margin-bottom: 6px;">$1</h2>')
            .replace(/^# (.*?)$/gm, '<h1 style="font-size: 18pt; font-weight: bold; margin-top: 15px; margin-bottom: 8px;">$1</h1>')
            // Bold text
            .replace(/\*\*(.*?)\*\*/g, '<strong style="font-weight: bold;">$1</strong>')
            // Bullet points
            .replace(/^[•\-\*]\s+(.*?)$/gm, '<li style="margin-left: 15px; margin-bottom: 3px;">$1</li>')
            // Paragraphs
            .replace(/\n\n/g, '</p><p style="margin-bottom: 8px;">')
            // Remove remaining markdown artifacts
            .replace(/[`~]/g, '')
            .replace(/\[KEY\](.*?)\[\/KEY\]/g, '<strong>$1</strong>')
            .replace(/\[DEF\](.*?)\[\/DEF\]/g, '$1');

        // Wrap in paragraph tags
        if (!processedText.startsWith('<h') && !processedText.startsWith('<p')) {
            processedText = '<p style="margin-bottom: 8px;">' + processedText + '</p>';
        }

        // Add title and logo
        const displayTitle = videoTitle || 'Summary';
        container.innerHTML = `
            <div style="text-align: center; margin-bottom: 20px; border-bottom: 2px solid #333; padding-bottom: 10px;">
                <h1 style="font-size: 18pt; font-weight: bold; color: #333; margin: 0;">${displayTitle}</h1>
            </div>
            <div style="font-size: 12pt; line-height: 1.6; border: 1px solid #ccc; padding: 15px; border-radius: 5px;">
                ${processedText}
            </div>
        `;

        document.body.appendChild(container);

        // Wait for fonts to load
        await document.fonts.ready;

        // Capture the content as canvas
        const canvas = await html2canvas(container, {
            scale: 2, // Higher quality
            useCORS: true,
            logging: false,
            backgroundColor: '#ffffff'
        });

        // Remove temporary container
        document.body.removeChild(container);

        // Create PDF
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: 'a4'
        });

        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        const imgWidth = pageWidth;
        const imgHeight = (canvas.height * pageWidth) / canvas.width;

        let heightLeft = imgHeight;
        let position = 0;

        // Add first page
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;

        // Add additional pages if needed
        while (heightLeft > 0) {
            position = heightLeft - imgHeight;
            pdf.addPage();
            pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
            heightLeft -= pageHeight;
        }

        pdf.save('summary.pdf');
        return true;
    } catch (err) {
        console.error('Unicode PDF generation error:', err);
        return false;
    }
}