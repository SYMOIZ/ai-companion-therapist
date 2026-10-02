
import { GoogleGenAI, LiveServerMessage, Modality } from "@google/genai";

export class LiveSession {
    private ai: GoogleGenAI;
    private sessionPromise: Promise<any> | null = null;
    private inputAudioContext: AudioContext;
    private outputAudioContext: AudioContext;
    private inputNode: GainNode | null = null;
    private outputNode: GainNode;
    private sources = new Set<AudioBufferSourceNode>();
    private nextStartTime = 0;
    private stream: MediaStream | null = null;
    private scriptProcessor: ScriptProcessorNode | null = null;

    constructor(apiKey: string) {
        this.ai = new GoogleGenAI({ apiKey });
        this.inputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
        this.outputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
        this.outputNode = this.outputAudioContext.createGain();
        this.outputNode.connect(this.outputAudioContext.destination);
    }

    async connect(onMessage: (text: string) => void) {
        // 1. Resume AudioContexts (Browser requirement for audio playback/recording)
        await this.inputAudioContext.resume();
        await this.outputAudioContext.resume();

        // 2. Request Mic Permission
        try {
            this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        } catch (e) {
            console.error("Microphone access denied", e);
            throw new Error("Microphone permission denied. Please allow access in browser settings.");
        }
        
        // 3. Connect to Gemini Live
        try {
            this.sessionPromise = this.ai.live.connect({
                model: 'gemini-3.1-flash-live-preview',
                callbacks: {
                    onopen: () => {
                        console.log("Live session opened");
                        this.startAudioInput();
                    },
                    onmessage: async (message: LiveServerMessage) => {
                        // Audio Output
                        const parts = message.serverContent?.modelTurn?.parts;
                        const audioData = parts?.[0]?.inlineData?.data;
                        if (audioData) {
                            this.playAudioChunk(audioData);
                        }
                        
                        // Transcription (if available/configured)
                        const text = parts?.[0]?.text;
                        if (text) {
                            onMessage(text);
                        }
                    },
                    onerror: (e) => console.error("Live session error", e),
                    onclose: () => console.log("Live session closed"),
                },
                config: {
                    responseModalities: [Modality.AUDIO], // Live API returns audio primarily
                    speechConfig: {
                        voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } }
                    }
                }
            });
        } catch (e) {
            // Cleanup stream if connection fails
            this.stream.getTracks().forEach(t => t.stop());
            this.stream = null;
            throw e;
        }
    }

    private startAudioInput() {
        if (!this.stream) return;
        const source = this.inputAudioContext.createMediaStreamSource(this.stream);
        this.scriptProcessor = this.inputAudioContext.createScriptProcessor(4096, 1, 1);
        
        this.scriptProcessor.onaudioprocess = (event) => {
            const inputData = event.inputBuffer.getChannelData(0);
            const pcmData = this.floatTo16BitPCM(inputData);
            const base64 = this.arrayBufferToBase64(pcmData);
            
            this.sessionPromise?.then(session => {
                session.sendRealtimeInput({
                    audio: {
                        mimeType: 'audio/pcm;rate=16000',
                        data: base64
                    }
                });
            });
        };

        source.connect(this.scriptProcessor);
        this.scriptProcessor.connect(this.inputAudioContext.destination);
    }

    private async playAudioChunk(base64: string) {
        const binaryString = atob(base64);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        
        // Decode raw PCM
        const dataInt16 = new Int16Array(bytes.buffer);
        const float32 = new Float32Array(dataInt16.length);
        for (let i = 0; i < dataInt16.length; i++) {
            float32[i] = dataInt16[i] / 32768.0;
        }

        const buffer = this.outputAudioContext.createBuffer(1, float32.length, 24000);
        buffer.copyToChannel(float32, 0);

        const source = this.outputAudioContext.createBufferSource();
        source.buffer = buffer;
        source.connect(this.outputNode);
        
        const currentTime = this.outputAudioContext.currentTime;
        // Schedule to ensure smooth playback
        const start = Math.max(currentTime, this.nextStartTime);
        source.start(start);
        this.nextStartTime = start + buffer.duration;
        
        source.onended = () => {
            this.sources.delete(source);
        };
        this.sources.add(source);
    }

    disconnect() {
        this.stream?.getTracks().forEach(t => t.stop());
        this.stream = null;
        this.scriptProcessor?.disconnect();
        this.sources.forEach(s => s.stop());
        // No explicit session close method in current snippet, usually strictly tied to stream
    }

    // Utils
    private floatTo16BitPCM(input: Float32Array) {
        const output = new Int16Array(input.length);
        for (let i = 0; i < input.length; i++) {
            const s = Math.max(-1, Math.min(1, input[i]));
            output[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }
        return output.buffer;
    }

    private arrayBufferToBase64(buffer: ArrayBuffer) {
        let binary = '';
        const bytes = new Uint8Array(buffer);
        const len = bytes.byteLength;
        for (let i = 0; i < len; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
    }
}
