(() => {
  let rsvpOverlay = null;
  let isSelecting = false;
  let selectionOverlay = null;
  let startX, startY;

  // Calculate optimal recognition point (ORP) - the focal character
  function getORPIndex(word) {
    const len = word.length;
    if (len <= 1) return 0;
    if (len <= 5) return Math.floor(len / 2) - 1;
    if (len <= 9) return 2;
    if (len <= 13) return 3;
    return 4;
  }

  // Extract main content text from page
  function extractMainContent() {
    // Check for selected text first
    const selection = window.getSelection().toString().trim();
    if (selection) {
      return selection;
    }

    // Try to find main content using common selectors
    const contentSelectors = [
      'article',
      '[role="main"]',
      'main',
      '.post-content',
      '.article-content',
      '.entry-content',
      '.content',
      '#content',
      '.post',
      '.article'
    ];

    for (const selector of contentSelectors) {
      const element = document.querySelector(selector);
      if (element) {
        return extractTextFromElement(element);
      }
    }

    // Fallback: get body text, excluding scripts, styles, nav, etc.
    return extractTextFromElement(document.body);
  }

  function extractTextFromElement(element) {
    const clone = element.cloneNode(true);
    
    // Remove unwanted elements
    const removeSelectors = [
      'script', 'style', 'nav', 'header', 'footer', 'aside',
      '.nav', '.menu', '.sidebar', '.comments', '.advertisement',
      '[role="navigation"]', '[role="banner"]', '[role="contentinfo"]'
    ];
    
    removeSelectors.forEach(selector => {
      clone.querySelectorAll(selector).forEach(el => el.remove());
    });

    // Replace code blocks with marker (don't include their content)
    const codeElements = clone.querySelectorAll('pre, code, .highlight, .code-block, [class*="language-"]');
    codeElements.forEach(el => {
      // Only replace if it's a block-level code element (not inline code)
      if (el.tagName === 'PRE' || el.closest('pre') || el.classList.contains('code-block')) {
        const marker = document.createTextNode(`\n\n${CODE_BLOCK}\n\n`);
        el.replaceWith(marker);
      }
    });

    // Replace images with marker
    const imgElements = clone.querySelectorAll('img, figure, picture, svg, canvas, video');
    imgElements.forEach(el => {
      const marker = document.createTextNode(`\n\n${IMAGE_BLOCK}\n\n`);
      el.replaceWith(marker);
    });

    // Insert paragraph markers for block elements
    const blockElements = clone.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li, blockquote, div, section, article');
    blockElements.forEach(el => {
      el.insertAdjacentText('afterend', '\n\n');
    });

    return clone.textContent;
  }

  // Special marker for paragraph breaks
  const PARAGRAPH_BREAK = '\u2029';
  // Special marker for code blocks
  const CODE_BLOCK = '\u2028CODE\u2028';
  // Special marker for images
  const IMAGE_BLOCK = '\u2028IMG\u2028';

  // Tokenize text into words, preserving paragraph breaks
  function tokenize(text) {
    // Replace multiple newlines/breaks with paragraph marker
    text = text.replace(/(\r?\n\s*){2,}/g, ` ${PARAGRAPH_BREAK} `);
    
    // Normalize remaining whitespace
    text = text.replace(/\s+/g, ' ').trim();
    
    // Split on whitespace first
    const words = text.split(' ');
    const result = [];
    
    for (const word of words) {
      if (!word) continue;
      
      // Keep special markers
      if (word === PARAGRAPH_BREAK || word === CODE_BLOCK || word === IMAGE_BLOCK) {
        result.push(word);
        continue;
      }
      
      // Split after sentence-ending punctuation when followed by a capital letter
      // Uses lookbehind for word char + punctuation, lookahead for capital
      // This keeps ".NET" together but splits "word.New" into ["word.", "New"]
      const parts = word.split(/(?<=\w[.!?)\]])(?=[A-Z"'([{])/);
      result.push(...parts.filter(p => p.length > 0));
    }
    
    return result;
  }

  // Create RSVP display overlay
  function createRSVPOverlay(words, wpm, paragraphMode) {
    // Remove existing overlay
    if (rsvpOverlay) {
      rsvpOverlay.remove();
    }

    // Count actual words (not special markers) for display
    const isSpecialMarker = w => w === PARAGRAPH_BREAK || w === CODE_BLOCK || w === IMAGE_BLOCK;
    const wordCount = words.filter(w => !isSpecialMarker(w)).length;

    rsvpOverlay = document.createElement('div');
    rsvpOverlay.id = 'rsvp-overlay';
    rsvpOverlay.innerHTML = `
      <div class="rsvp-container">
        <div class="rsvp-header">
          <span class="rsvp-progress">0 / ${wordCount}</span>
          <span class="rsvp-wpm">${wpm} WPM</span>
          <button class="rsvp-close" title="Close">✕</button>
        </div>
        <div class="rsvp-display">
          <div class="rsvp-guides">
            <div class="rsvp-guide-left"></div>
            <div class="rsvp-guide-center"></div>
            <div class="rsvp-guide-right"></div>
          </div>
          <div class="rsvp-word-container">
            <span class="rsvp-word-before"></span>
            <span class="rsvp-word-focus"></span>
            <span class="rsvp-word-after"></span>
          </div>
          <div class="rsvp-paragraph-indicator">¶ New Section</div>
          <div class="rsvp-content-indicator rsvp-code-indicator">
            <span class="rsvp-content-icon">📝</span>
            <span class="rsvp-content-text">Code Block</span>
            <button class="rsvp-view-content" data-type="code">View on Page</button>
          </div>
          <div class="rsvp-content-indicator rsvp-image-indicator">
            <span class="rsvp-content-icon">🖼️</span>
            <span class="rsvp-content-text">Image</span>
            <button class="rsvp-view-content" data-type="image">View on Page</button>
          </div>
        </div>
        <div class="rsvp-controls">
          <button class="rsvp-btn rsvp-restart" title="Restart">⏮</button>
          <button class="rsvp-btn rsvp-back" title="Back 10 words">⏪</button>
          <button class="rsvp-btn rsvp-play-pause" title="Play/Pause">▶</button>
          <button class="rsvp-btn rsvp-forward" title="Forward 10 words">⏩</button>
          <div class="rsvp-speed-control">
            <button class="rsvp-btn rsvp-slower" title="Slower">−</button>
            <span class="rsvp-speed-display">${wpm}</span>
            <button class="rsvp-btn rsvp-faster" title="Faster">+</button>
          </div>
        </div>
        <div class="rsvp-paragraph-control">
          <label>On paragraph break:</label>
          <select class="rsvp-paragraph-mode">
            <option value="pause" ${paragraphMode === 'pause' ? 'selected' : ''}>Pause</option>
            <option value="delay" ${paragraphMode === 'delay' ? 'selected' : ''}>Delay (1s)</option>
            <option value="none" ${paragraphMode === 'none' ? 'selected' : ''}>Continue</option>
          </select>
        </div>
        <div class="rsvp-progress-bar">
          <div class="rsvp-progress-fill"></div>
        </div>
      </div>
    `;

    document.body.appendChild(rsvpOverlay);

    // Initialize RSVP player
    initRSVPPlayer(words, wpm, paragraphMode);
  }

  function initRSVPPlayer(words, initialWpm, initialParagraphMode) {
    let currentIndex = 0;
    let isPlaying = false;
    let wpm = initialWpm;
    let paragraphMode = initialParagraphMode;
    let intervalId = null;
    let savedPosition = null; // For returning after viewing content

    // Helper to check for special markers
    const isSpecialMarker = w => w === PARAGRAPH_BREAK || w === CODE_BLOCK || w === IMAGE_BLOCK;

    // Count actual words for progress
    const wordCount = words.filter(w => !isSpecialMarker(w)).length;
    let displayedWordCount = 0;

    const wordBefore = rsvpOverlay.querySelector('.rsvp-word-before');
    const wordFocus = rsvpOverlay.querySelector('.rsvp-word-focus');
    const wordAfter = rsvpOverlay.querySelector('.rsvp-word-after');
    const progress = rsvpOverlay.querySelector('.rsvp-progress');
    const progressFill = rsvpOverlay.querySelector('.rsvp-progress-fill');
    const playPauseBtn = rsvpOverlay.querySelector('.rsvp-play-pause');
    const speedDisplay = rsvpOverlay.querySelector('.rsvp-speed-display');
    const wpmDisplay = rsvpOverlay.querySelector('.rsvp-wpm');
    const paragraphIndicator = rsvpOverlay.querySelector('.rsvp-paragraph-indicator');
    const codeIndicator = rsvpOverlay.querySelector('.rsvp-code-indicator');
    const imageIndicator = rsvpOverlay.querySelector('.rsvp-image-indicator');
    const paragraphModeSelect = rsvpOverlay.querySelector('.rsvp-paragraph-mode');

    function countWordsUpTo(index) {
      let count = 0;
      for (let i = 0; i <= index && i < words.length; i++) {
        if (!isSpecialMarker(words[i])) count++;
      }
      return count;
    }

    function hideAllIndicators() {
      paragraphIndicator.classList.remove('visible');
      codeIndicator.classList.remove('visible');
      imageIndicator.classList.remove('visible');
    }

    function displayWord(index) {
      if (index >= words.length) {
        pause();
        currentIndex = words.length - 1;
        return;
      }
      if (index < 0) index = 0;

      currentIndex = index;
      const word = words[index];

      hideAllIndicators();

      // Handle paragraph break marker
      if (word === PARAGRAPH_BREAK) {
        wordBefore.textContent = '';
        wordFocus.textContent = '';
        wordAfter.textContent = '';
        paragraphIndicator.classList.add('visible');
        return;
      }

      // Handle code block marker
      if (word === CODE_BLOCK) {
        wordBefore.textContent = '';
        wordFocus.textContent = '';
        wordAfter.textContent = '';
        codeIndicator.classList.add('visible');
        return;
      }

      // Handle image marker
      if (word === IMAGE_BLOCK) {
        wordBefore.textContent = '';
        wordFocus.textContent = '';
        wordAfter.textContent = '';
        imageIndicator.classList.add('visible');
        return;
      }

      const orpIndex = getORPIndex(word);

      wordBefore.textContent = word.substring(0, orpIndex);
      wordFocus.textContent = word.charAt(orpIndex);
      wordAfter.textContent = word.substring(orpIndex + 1);

      displayedWordCount = countWordsUpTo(index);
      progress.textContent = `${displayedWordCount} / ${wordCount}`;
      progressFill.style.width = `${(displayedWordCount / wordCount) * 100}%`;
    }

    function getDelay(word) {
      const baseDelay = 60000 / wpm;
      
      // Paragraph break handling
      if (word === PARAGRAPH_BREAK) {
        if (paragraphMode === 'delay') return 1000;
        if (paragraphMode === 'none') return 0;
        return baseDelay; // Will be handled by pause logic
      }
      
      // Add extra time for punctuation
      if (/[.!?]$/.test(word)) return baseDelay * 2;
      if (/[,;:]$/.test(word)) return baseDelay * 1.5;
      // Add time for longer words
      if (word.length > 8) return baseDelay * 1.2;
      return baseDelay;
    }

    function play() {
      if (isPlaying) return;
      isPlaying = true;
      playPauseBtn.textContent = '⏸';
      
      function showNext() {
        if (!isPlaying) return;
        if (currentIndex >= words.length) {
          pause();
          return;
        }
        
        const word = words[currentIndex];
        
        // Handle code/image blocks - always pause
        if (word === CODE_BLOCK || word === IMAGE_BLOCK) {
          displayWord(currentIndex);
          currentIndex++;
          pause();
          return;
        }
        
        // Handle paragraph break with pause mode
        if (word === PARAGRAPH_BREAK && paragraphMode === 'pause') {
          displayWord(currentIndex);
          currentIndex++;
          pause();
          return;
        }
        
        // Skip paragraph markers in "none" mode
        if (word === PARAGRAPH_BREAK && paragraphMode === 'none') {
          currentIndex++;
          showNext();
          return;
        }
        
        displayWord(currentIndex);
        const delay = getDelay(word);
        currentIndex++;
        intervalId = setTimeout(showNext, delay);
      }
      
      showNext();
    }

    function pause() {
      isPlaying = false;
      playPauseBtn.textContent = '▶';
      if (intervalId) {
        clearTimeout(intervalId);
        intervalId = null;
      }
    }

    function updateSpeed(newWpm) {
      wpm = Math.min(1000, Math.max(100, newWpm));
      speedDisplay.textContent = wpm;
      wpmDisplay.textContent = `${wpm} WPM`;
      chrome.storage.sync.set({ wpm });
    }

    // Paragraph mode change handler
    paragraphModeSelect.addEventListener('change', (e) => {
      paragraphMode = e.target.value;
      chrome.storage.sync.set({ paragraphMode });
    });

    // Event listeners
    rsvpOverlay.querySelector('.rsvp-close').addEventListener('click', () => {
      pause();
      rsvpOverlay.remove();
      rsvpOverlay = null;
    });

    rsvpOverlay.querySelector('.rsvp-play-pause').addEventListener('click', () => {
      if (isPlaying) {
        pause();
      } else {
        if (currentIndex >= words.length) currentIndex = 0;
        play();
      }
    });

    rsvpOverlay.querySelector('.rsvp-restart').addEventListener('click', () => {
      pause();
      currentIndex = 0;
      displayWord(0);
    });

    rsvpOverlay.querySelector('.rsvp-back').addEventListener('click', () => {
      pause();
      displayWord(Math.max(0, currentIndex - 10));
    });

    rsvpOverlay.querySelector('.rsvp-forward').addEventListener('click', () => {
      pause();
      displayWord(Math.min(words.length - 1, currentIndex + 10));
    });

    rsvpOverlay.querySelector('.rsvp-slower').addEventListener('click', () => {
      updateSpeed(wpm - 25);
    });

    rsvpOverlay.querySelector('.rsvp-faster').addEventListener('click', () => {
      updateSpeed(wpm + 25);
    });

    // View content buttons - minimize overlay and scroll to content
    rsvpOverlay.querySelectorAll('.rsvp-view-content').forEach(btn => {
      btn.addEventListener('click', () => {
        savedPosition = currentIndex;
        rsvpOverlay.classList.add('rsvp-minimized');
      });
    });

    // Resume button when minimized
    rsvpOverlay.addEventListener('click', (e) => {
      if (rsvpOverlay.classList.contains('rsvp-minimized') && e.target === rsvpOverlay) {
        rsvpOverlay.classList.remove('rsvp-minimized');
        if (savedPosition !== null) {
          displayWord(savedPosition);
          savedPosition = null;
        }
      }
    });

    // Keyboard controls
    function handleKeydown(e) {
      if (!rsvpOverlay) return;
      
      switch (e.code) {
        case 'Space':
          e.preventDefault();
          if (isPlaying) pause();
          else {
            if (currentIndex >= words.length) currentIndex = 0;
            play();
          }
          break;
        case 'ArrowLeft':
          e.preventDefault();
          pause();
          displayWord(Math.max(0, currentIndex - 1));
          break;
        case 'ArrowRight':
          e.preventDefault();
          pause();
          displayWord(Math.min(words.length - 1, currentIndex + 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          updateSpeed(wpm + 25);
          break;
        case 'ArrowDown':
          e.preventDefault();
          updateSpeed(wpm - 25);
          break;
        case 'Escape':
          pause();
          rsvpOverlay.remove();
          rsvpOverlay = null;
          document.removeEventListener('keydown', handleKeydown);
          break;
      }
    }

    document.addEventListener('keydown', handleKeydown);

    // Show first word
    displayWord(0);
  }

  // Selection mode for choosing text area
  function enableSelectionMode(wpm, paragraphMode) {
    isSelecting = true;
    document.body.style.cursor = 'crosshair';

    selectionOverlay = document.createElement('div');
    selectionOverlay.id = 'rsvp-selection-overlay';
    selectionOverlay.innerHTML = `
      <div class="rsvp-selection-hint">Click and drag to select an area, or press Escape to cancel</div>
      <div class="rsvp-selection-box"></div>
    `;
    document.body.appendChild(selectionOverlay);

    const selectionBox = selectionOverlay.querySelector('.rsvp-selection-box');

    function onMouseDown(e) {
      startX = e.clientX;
      startY = e.clientY;
      selectionBox.style.display = 'block';
      selectionBox.style.left = startX + 'px';
      selectionBox.style.top = startY + 'px';
      selectionBox.style.width = '0';
      selectionBox.style.height = '0';
    }

    function onMouseMove(e) {
      if (startX === undefined) return;
      
      const currentX = e.clientX;
      const currentY = e.clientY;
      
      const left = Math.min(startX, currentX);
      const top = Math.min(startY, currentY);
      const width = Math.abs(currentX - startX);
      const height = Math.abs(currentY - startY);
      
      selectionBox.style.left = left + 'px';
      selectionBox.style.top = top + 'px';
      selectionBox.style.width = width + 'px';
      selectionBox.style.height = height + 'px';
    }

    function onMouseUp(e) {
      const left = parseInt(selectionBox.style.left);
      const top = parseInt(selectionBox.style.top);
      const width = parseInt(selectionBox.style.width);
      const height = parseInt(selectionBox.style.height);

      cleanup();

      if (width < 10 || height < 10) return;

      // Find elements within selection
      const elements = document.elementsFromPoint(left + width / 2, top + height / 2);
      let text = '';
      
      // Get all text nodes within the selection rectangle
      const rect = { left, top, right: left + width, bottom: top + height };
      text = getTextInRect(rect);

      if (text.trim()) {
        const words = tokenize(text);
        const isSpecialMarker = w => w === PARAGRAPH_BREAK || w === CODE_BLOCK || w === IMAGE_BLOCK;
        const filteredWords = words.filter(w => isSpecialMarker(w) || w.trim().length > 0);
        if (filteredWords.filter(w => !isSpecialMarker(w)).length > 0) {
          createRSVPOverlay(filteredWords, wpm, paragraphMode);
        }
      }
    }

    function getTextInRect(rect) {
      const walker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_TEXT,
        null,
        false
      );

      let text = '';
      let node;

      while (node = walker.nextNode()) {
        const range = document.createRange();
        range.selectNodeContents(node);
        const rects = range.getClientRects();
        
        for (const r of rects) {
          if (r.left < rect.right && r.right > rect.left &&
              r.top < rect.bottom && r.bottom > rect.top) {
            text += node.textContent + ' ';
            break;
          }
        }
      }

      return text;
    }

    function onKeyDown(e) {
      if (e.code === 'Escape') {
        cleanup();
      }
    }

    function cleanup() {
      isSelecting = false;
      document.body.style.cursor = '';
      startX = undefined;
      startY = undefined;
      
      if (selectionOverlay) {
        selectionOverlay.remove();
        selectionOverlay = null;
      }
      
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.removeEventListener('keydown', onKeyDown);
    }

    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    document.addEventListener('keydown', onKeyDown);
  }

  // Message listener
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // Helper to check for special markers
    const isSpecialMarker = w => w === PARAGRAPH_BREAK || w === CODE_BLOCK || w === IMAGE_BLOCK;

    if (message.action === 'readPage') {
      const text = extractMainContent();
      const words = tokenize(text);
      
      // Filter out empty results but keep special markers
      const filteredWords = words.filter(w => isSpecialMarker(w) || w.trim().length > 0);
      
      if (filteredWords.filter(w => !isSpecialMarker(w)).length === 0) {
        alert('No readable text found on this page.');
        return;
      }
      
      createRSVPOverlay(filteredWords, message.wpm, message.paragraphMode || 'pause');
    } else if (message.action === 'selectArea') {
      enableSelectionMode(message.wpm, message.paragraphMode || 'pause');
    }
  });
})();
