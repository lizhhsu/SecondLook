import React, { useState, useRef, useEffect } from 'react';
import { OvershootScreenClient, MathTutorHelpers } from '../lib/overshoot';
import InterventionCard from './InterventionCard';
import SummaryView from './SummaryView';
import { Square, MonitorUp } from 'lucide-react';
import LandingPage from './LandingPage';
import Header from './Header';
import { requestScreenShare, screenShareError } from '../lib/screenShare';
import { checkBinomialSquare } from '../lib/binomialSquare';
import './Workspace.css';

function Workspace({ onExitToHome }) {
  const [sessionActive, setSessionActive] = useState(false);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState('');
  const [analysisReady, setAnalysisReady] = useState(false);
  const [analysisStatus, setAnalysisStatus] = useState('');
  const [stream, setStream] = useState(null);
  const [hasLiveVideo, setHasLiveVideo] = useState(false);
  const [interventions, setInterventions] = useState([]);
  const [currentIntervention, setCurrentIntervention] = useState(null);
  const [showSummary, setShowSummary] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [questionEnded, setQuestionEnded] = useState(false);
  const [equation, setEquation] = useState('');
  const [checkStatus, setCheckStatus] = useState('');

  const videoRef = useRef(null);
  const clientRef = useRef(null);
  const captureRef = useRef(null);
  const attemptRef = useRef(0);
  const [videoReady, setVideoReady] = useState(false);
  const manualCheckRequestedRef = useRef(false);
  const checkTimeoutRef = useRef(null);

  const stopScreenShare = async (showSummary) => {
    attemptRef.current += 1;
    clearTimeout(checkTimeoutRef.current);
    manualCheckRequestedRef.current = false;
    captureRef.current?.getTracks().forEach(track => track.stop());
    captureRef.current = null;
    if (clientRef.current) {
      await clientRef.current.stop();
      clientRef.current = null;
    }
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setStream(null);
    setHasLiveVideo(false);
    setSessionActive(false);
    setShowSummary(showSummary);
    setCurrentIntervention(null);
    setElapsedSeconds(0);
    setIsAnalyzing(false);
    setQuestionEnded(false);
    setStarting(false);
    setAnalysisReady(false);
    setAnalysisStatus('');
    manualCheckRequestedRef.current = false;
    setEquation('');
    setCheckStatus('');
  };

  const showFeedback = (result, endQuestion) => {
    const intervention = {
      ...result,
      id: crypto.randomUUID(),
      source: 'manual_check',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    };
    setInterventions(previous => [intervention, ...previous]);
    setCurrentIntervention(intervention);
    setQuestionEnded(endQuestion);
  };

  const parseOvershootResult = (text) => {
    const lines = String(text || '').split('\n');
    const data = {};
    let currentKey = null;

    for (const line of lines) {
      if (line.trim() === '<END>') break;
      if (line.includes(':') && /^[A-Z_]+:/.test(line)) {
        const [key, ...rest] = line.split(':');
        currentKey = key.trim();
        data[currentKey] = rest.join(':').trim();
      } else if (currentKey) {
        data[currentKey] += '\n' + line.trim();
      }
    }

    for (const key of Object.keys(data)) {
      data[key] = String(data[key]).replace(/\n?<END>\s*$/g, '').replace(/<END>/g, '').trim();
    }

    const lastLine = data.TRANSCRIPTION?.split('\n').filter(line => line.trim()).at(-1) || '';
    const knownResult = checkBinomialSquare(lastLine);
    if (knownResult) return knownResult;
    const verdict = data.ERROR_FOUND?.toLowerCase();
    if (verdict !== 'true' && verdict !== 'false') return null;
    const errorFound = verdict === 'true';

    let boundingBox = null;
    if (data.BBOX && data.BBOX !== 'none') {
      try {
        boundingBox = JSON.parse(data.BBOX);
      } catch {
      }
    }

    return {
      errorFound,
      issueTitle: data.ISSUE_TITLE || (errorFound ? 'Misconception detected' : 'No issues detected'),
      explanation: data.EXPLANATION || '',
      hint: data.HINT || '',
      category: errorFound ? data.CATEGORY || 'Uncategorized' : 'Correct',
      boundingBox,
      incorrectSnippet: data.TRANSCRIPTION || ''
    };
  };

  const startDetector = async (client) => {
    return await MathTutorHelpers.createErrorDetector(client, {
      onResultText: (text) => {
        const pending = manualCheckRequestedRef.current;
        if (client !== clientRef.current || !pending) return;
        const result = parseOvershootResult(text);
        if (!result) return;
        clearTimeout(checkTimeoutRef.current);
        manualCheckRequestedRef.current = false;
        showFeedback(result, pending.endQuestion);
        setIsAnalyzing(false);
      },
      onError: (err) => {
        if (client !== clientRef.current || !captureRef.current) return;
        console.error('Overshoot Error:', err);
        setAnalysisReady(false);
        setAnalysisStatus('Screen sharing is active, but AI feedback disconnected.');
        manualCheckRequestedRef.current = false;
        clearTimeout(checkTimeoutRef.current);
        setIsAnalyzing(false);
      }
    });
  };

  const handleStartSession = async () => {
    if (starting) return;
    setStarting(true);
    setStartError('');
    const attempt = ++attemptRef.current;
    try {
      const mediaStream = await requestScreenShare();
      if (attempt !== attemptRef.current) {
        mediaStream.getTracks().forEach(track => track.stop());
        return;
      }
      captureRef.current = mediaStream;
      const track = mediaStream.getVideoTracks()[0];
      if (!track || track.readyState !== 'live') throw new Error('The selected screen stopped sharing. Please try again.');
      track.addEventListener('ended', () => {
        if (captureRef.current === mediaStream) void stopScreenShare(false);
      }, { once: true });
      setQuestionEnded(false);
      setStream(mediaStream);
      setHasLiveVideo(false);
      setSessionActive(true);
      setShowSummary(false);
      setInterventions([]);
      setCurrentIntervention(null);
      setStarting(false);
      const apiKey = import.meta.env.VITE_OVERSHOOT_API_KEY;
      if (!apiKey) {
        setAnalysisStatus('Screen sharing is active. AI feedback is unavailable on this site.');
        return;
      }
      setAnalysisStatus('Screen sharing is active. Connecting AI feedback…');
      let client;
      try {
        client = new OvershootScreenClient({ apiKey, ocrFocusEnabled: true });
        client.mediaStream = mediaStream;
        clientRef.current = client;
        await startDetector(client);
        if (attempt !== attemptRef.current) {
          await client.stop();
          return;
        }
        setAnalysisReady(true);
        setAnalysisStatus('');
      } catch (error) {
        console.error('AI connection failed:', error);
        await client?.stop(true);
        if (attempt === attemptRef.current) {
          setAnalysisReady(false);
          setAnalysisStatus('Screen sharing is active, but AI feedback could not connect.');
        }
      }
    } catch (err) {
      console.error("Failed to start stream:", err);
      if (attempt === attemptRef.current) {
        captureRef.current?.getTracks().forEach(track => track.stop());
        captureRef.current = null;
        setStartError(screenShareError(err));
      }
    } finally {
      if (attempt === attemptRef.current) setStarting(false);
    }
  };

  const handleCheck = (endQuestion) => {
    if (questionEnded || manualCheckRequestedRef.current) return;
    setCheckStatus('');
    const result = checkBinomialSquare(equation);
    if (result) {
      showFeedback(result, endQuestion);
      return;
    }
    if (!analysisReady || !hasLiveVideo) {
      setCheckStatus(equation.trim()
        ? 'Typed checks support the demo equation and its corrected expansion.'
        : 'Type the demo equation to check it.');
      return;
    }
    manualCheckRequestedRef.current = { endQuestion };
    setCurrentIntervention(null);
    setIsAnalyzing(true);
    checkTimeoutRef.current = setTimeout(() => {
      manualCheckRequestedRef.current = false;
      setIsAnalyzing(false);
      setCheckStatus('No screen feedback came back. Try again or type the demo equation.');
    }, 15000);
  };

  const handleNextQuestion = () => {
    setQuestionEnded(false);
    setEquation('');
    setCheckStatus('');
    setCurrentIntervention(null);
  };

  const handleEndSession = () => {
    stopScreenShare(true);
  };

  const handleExitToHome = () => {
    stopScreenShare(false);
    if (onExitToHome) {
      onExitToHome();
    }
  };

  useEffect(() => {
    return () => {
      attemptRef.current += 1;
      clearTimeout(checkTimeoutRef.current);
      manualCheckRequestedRef.current = false;
      captureRef.current?.getTracks().forEach(track => track.stop());
      captureRef.current = null;
      void clientRef.current?.stop();
    };
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (!stream) {
      video.srcObject = null;
      setHasLiveVideo(false);
      setVideoReady(false);
      return;
    }

    video.srcObject = stream;

    const handleLoadedMetadata = () => {
      const track = stream.getVideoTracks()[0];
      const muted = track ? track.muted : false;
      const canPlay = video.readyState >= 2;
      const liveTrack = stream.getVideoTracks().some(t => t.readyState === 'live');
      setVideoReady(canPlay && !muted);
      setHasLiveVideo(canPlay && liveTrack && !muted);
    };

    video.addEventListener("loadedmetadata", handleLoadedMetadata);
    video.addEventListener('loadeddata', handleLoadedMetadata);
    video.addEventListener('playing', handleLoadedMetadata);
    const track = stream.getVideoTracks()[0];
    track?.addEventListener('mute', handleLoadedMetadata);
    track?.addEventListener('unmute', handleLoadedMetadata);
    video.play().catch(() => {});

    if (video.readyState >= 2) {
      handleLoadedMetadata();
    }

    return () => {
      video.removeEventListener("loadedmetadata", handleLoadedMetadata);
      video.removeEventListener('loadeddata', handleLoadedMetadata);
      video.removeEventListener('playing', handleLoadedMetadata);
      track?.removeEventListener('mute', handleLoadedMetadata);
      track?.removeEventListener('unmute', handleLoadedMetadata);
    };
  }, [stream]);

  useEffect(() => {
    let interval = null;
    if (sessionActive) {
      interval = setInterval(() => {
        setElapsedSeconds(s => s + 1);
      }, 1000);
    } else if (interval) {
      clearInterval(interval);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [sessionActive]);

  const formatTime = totalSeconds => {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  if (!sessionActive && !showSummary) {
    return <LandingPage onEnter={handleStartSession} onHome={handleExitToHome} starting={starting} error={startError} />;
  }

  return (
    <div className="workspace">
      <Header onHome={handleExitToHome} status={sessionActive && <span className="workspace-timer">{formatTime(elapsedSeconds)}</span>} />

      {sessionActive && analysisStatus && <div role="status" className="workspace-notice"><MonitorUp size={16} aria-hidden="true" /><p>{analysisStatus}</p></div>}

      {sessionActive && <div className="workspace-layout">
        <main className="workspace-main">
          <div className="workspace-section-heading"><span>YOUR WORKSPACE</span></div>
          <div className="workspace-preview">
            <div className="workspace-video-wrap">
              <video ref={videoRef} autoPlay playsInline muted className="workspace-video" />
              {(!videoReady || !hasLiveVideo) && <div className="workspace-waiting" role="status">Waiting for your screen…</div>}
            </div>

            <InterventionCard intervention={currentIntervention} onClose={() => setCurrentIntervention(null)} />
          </div>
          <div className="workspace-equation">
            <label htmlFor="workspace-equation">Type the demo equation (optional)</label>
            <input id="workspace-equation" value={equation} onChange={event => setEquation(event.target.value)} placeholder="(x+y)^2 = x^2+y^2" disabled={questionEnded || isAnalyzing} />
          </div>
          <div className="workspace-controls">
            <p role="status">{checkStatus || (isAnalyzing ? 'Checking your shared screen…' : 'Check each step as you go.')}</p>
            <div className="workspace-actions">
              {questionEnded ? (
                <button onClick={handleNextQuestion} className="workspace-button workspace-button-primary">Next Question</button>
              ) : (
                <>
                  <button onClick={() => handleCheck(false)} disabled={isAnalyzing} className="workspace-button workspace-button-primary">Check Step</button>
                  <button onClick={() => handleCheck(true)} disabled={isAnalyzing} className="workspace-button workspace-button-primary">End Question</button>
                </>
              )}
              <button onClick={handleEndSession} className="workspace-button workspace-button-end"><Square size={14} fill="currentColor" aria-hidden="true" />End Session</button>
            </div>
          </div>
        </main>

        <aside className="workspace-history" aria-labelledby="workspace-history-title">
          <div className="workspace-history-heading"><h2 id="workspace-history-title">Session history</h2><span>{interventions.length}</span></div>
          <div className="workspace-history-body">
            {interventions.length === 0 ? <div className="workspace-empty"><h3>No feedback yet</h3><p>{analysisReady ? 'Feedback on your reasoning will appear here as you review your work.' : 'AI feedback will appear here when it’s available.'}</p></div> : interventions.map(item => {
              const correct = item.errorFound === false || item.category === 'Correct';
              return <button type="button" key={item.id} className={`workspace-feedback ${currentIntervention?.id === item.id ? 'is-selected' : ''}`} aria-pressed={currentIntervention?.id === item.id} onClick={() => setCurrentIntervention(item)}>
                <span className="workspace-feedback-meta"><time>{item.timestamp}</time><span className={`workspace-category ${correct ? 'is-correct' : ''}`}>{item.category || 'Issue'}</span></span>
                <strong>{item.issueTitle}</strong><p>{item.explanation}</p>
              </button>;
            })}
          </div>
          <p className="workspace-history-note">A second look at your thinking.</p>
        </aside>
      </div>}

      {showSummary && <SummaryView interventions={interventions} onRestart={() => setShowSummary(false)} />}
    </div>
  );
}

export default Workspace;
