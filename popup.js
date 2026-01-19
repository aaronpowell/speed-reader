document.addEventListener('DOMContentLoaded', async () => {
  const wpmInput = document.getElementById('wpm');
  const decreaseBtn = document.getElementById('decrease-speed');
  const increaseBtn = document.getElementById('increase-speed');
  const readPageBtn = document.getElementById('read-page');
  const selectTextBtn = document.getElementById('select-text');
  const paragraphModeSelect = document.getElementById('paragraph-mode');

  // Load saved settings
  const stored = await chrome.storage.sync.get(['wpm', 'paragraphMode']);
  if (stored.wpm) {
    wpmInput.value = stored.wpm;
  }
  if (stored.paragraphMode) {
    paragraphModeSelect.value = stored.paragraphMode;
  }

  // Save WPM on change
  const saveWpm = () => {
    const wpm = Math.min(1000, Math.max(100, parseInt(wpmInput.value) || 300));
    wpmInput.value = wpm;
    chrome.storage.sync.set({ wpm });
  };

  wpmInput.addEventListener('change', saveWpm);

  decreaseBtn.addEventListener('click', () => {
    wpmInput.value = Math.max(100, parseInt(wpmInput.value) - 25);
    saveWpm();
  });

  increaseBtn.addEventListener('click', () => {
    wpmInput.value = Math.min(1000, parseInt(wpmInput.value) + 25);
    saveWpm();
  });

  // Save paragraph mode on change
  paragraphModeSelect.addEventListener('change', () => {
    chrome.storage.sync.set({ paragraphMode: paragraphModeSelect.value });
  });

  // Send message to content script
  const sendMessage = async (action) => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const wpm = parseInt(wpmInput.value) || 300;
    const paragraphMode = paragraphModeSelect.value;
    
    chrome.tabs.sendMessage(tab.id, { action, wpm, paragraphMode });
    window.close();
  };

  readPageBtn.addEventListener('click', () => sendMessage('readPage'));
  selectTextBtn.addEventListener('click', () => sendMessage('selectArea'));
});
