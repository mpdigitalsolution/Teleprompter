/**
 * GhostPrompter Speech-Sync Engine
 * Uses the Web Speech API (SpeechRecognition) with sliding-window transcript matching
 * to align speech cadence with the teleprompter script.
 */

(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
  } else {
    root.SpeechTracker = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {

  let recognition = null;
  let isListening = false;
  let scriptTokens = [];
  let currentTokenIndex = 0;
  let onSpeechCallback = null;

  /**
   * Normalize and tokenize text into word array
   */
  function tokenize(text) {
    if (!text || typeof text !== 'string') return [];
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 0);
  }

  /**
   * Set active script text to track against
   */
  function setScript(text) {
    scriptTokens = tokenize(text);
    currentTokenIndex = 0;
  }

  /**
   * Sliding window matcher to find where the spoken words fit in the script
   */
  function matchTranscript(spokenText) {
    const spokenTokens = tokenize(spokenText);
    if (spokenTokens.length === 0 || scriptTokens.length === 0) {
      return { matched: false, index: currentTokenIndex, advancePixels: 0 };
    }

    const windowLookahead = 20;
    const windowStart = Math.max(0, currentTokenIndex - 4);
    const windowEnd = Math.min(scriptTokens.length, currentTokenIndex + windowLookahead);

    let bestMatchIdx = -1;
    let bestScore = 0;

    // Check last 3 spoken tokens
    const keySpoken = spokenTokens.slice(-3);

    for (let i = windowStart; i < windowEnd; i++) {
      let score = 0;
      for (let k = 0; k < keySpoken.length; k++) {
        if (i + k < scriptTokens.length && scriptTokens[i + k] === keySpoken[k]) {
          score++;
        }
      }
      if (score > bestScore) {
        bestScore = score;
        bestMatchIdx = i + keySpoken.length;
      }
    }

    if (bestMatchIdx > currentTokenIndex) {
      const advancedTokens = bestMatchIdx - currentTokenIndex;
      currentTokenIndex = bestMatchIdx;

      // Estimate pixel advance: approx 35px per line, ~8-10 tokens per line
      const advancePixels = Math.round((advancedTokens / 8) * 35);
      const progressRatio = scriptTokens.length > 0 ? currentTokenIndex / scriptTokens.length : 0;

      return {
        matched: true,
        wordIndex: currentTokenIndex,
        totalTokens: scriptTokens.length,
        progressRatio,
        advancePixels
      };
    }

    return {
      matched: false,
      wordIndex: currentTokenIndex,
      totalTokens: scriptTokens.length,
      progressRatio: scriptTokens.length > 0 ? currentTokenIndex / scriptTokens.length : 0,
      advancePixels: 0
    };
  }

  /**
   * Initialize and start Speech Recognition
   */
  function start(callback) {
    onSpeechCallback = callback;
    isListening = true;

    const SpeechRec = typeof window !== 'undefined' ? (window.SpeechRecognition || window.webkitSpeechRecognition) : null;
    if (!SpeechRec) {
      console.warn('Web Speech API not supported in this browser environment.');
      return;
    }

    if (!recognition) {
      recognition = new SpeechRec();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onresult = (event) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }

        const matchResult = matchTranscript(transcript);

        if (onSpeechCallback) {
          onSpeechCallback({
            transcript,
            ...matchResult
          });
        }
      };

      recognition.onerror = (event) => {
        console.warn('SpeechRecognition error:', event.error);
      };

      recognition.onend = () => {
        // Auto-restart if user has not explicitly stopped
        if (isListening) {
          try {
            recognition.start();
          } catch (e) {}
        }
      };
    }

    try {
      recognition.start();
    } catch (e) {
      // Already running
    }
  }

  /**
   * Stop Speech Recognition
   */
  function stop() {
    isListening = false;
    if (recognition) {
      try {
        recognition.stop();
      } catch (e) {}
    }
  }

  function reset() {
    currentTokenIndex = 0;
  }

  return {
    tokenize,
    setScript,
    matchTranscript,
    start,
    stop,
    reset,
    getCurrentIndex: () => currentTokenIndex,
    isListening: () => isListening
  };
});
