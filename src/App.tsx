/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Upload, Download, Image as ImageIcon, FileType2, Settings2, Waves } from 'lucide-react';

function smoothArray(arr: number[], windowSize: number): number[] {
    if (windowSize === 0) return arr;
    const result = [];
    for (let i = 0; i < arr.length; i++) {
        let sum = 0;
        let count = 0;
        for (let j = Math.max(0, i - windowSize); j <= Math.min(arr.length - 1, i + windowSize); j++) {
            sum += arr[j];
            count++;
        }
        result.push(sum / count);
    }
    return result;
}

function SliderControl({ label, value, min, max, onChange }: any) {
    return (
        <div className="space-y-2">
            <div className="flex justify-between items-center">
                <label className="text-sm font-semibold text-neutral-700">{label}</label>
                <span className="text-xs font-mono font-medium text-neutral-500 bg-neutral-100 px-2 py-0.5 rounded-md">{value}</span>
            </div>
            <input 
                type="range" 
                min={min} 
                max={max} 
                value={value} 
                onChange={(e) => onChange(Number(e.target.value))}
                className="w-full h-1.5 bg-neutral-200 rounded-lg appearance-none cursor-pointer accent-neutral-900"
            />
        </div>
    );
}

function ColorControl({ label, value, onChange }: any) {
    return (
        <div className="flex justify-between items-center py-1">
            <label className="text-sm font-semibold text-neutral-700">{label}</label>
            <div className="flex items-center gap-3">
                <span className="text-xs font-mono font-medium text-neutral-500 uppercase">{value}</span>
                <div className="relative w-8 h-8 rounded-full overflow-hidden shadow-sm border border-neutral-200">
                    <input 
                        type="color" 
                        value={value} 
                        onChange={(e) => onChange(e.target.value)}
                        className="absolute inset-[-50%] w-[200%] h-[200%] cursor-pointer border-0 p-0"
                    />
                </div>
            </div>
        </div>
    );
}

export default function App() {
    // State
    const [numLobes, setNumLobes] = useState(60);
    const [lobeWidth, setLobeWidth] = useState(24);
    const [topWidth, setTopWidth] = useState(4);
    const [lobeSpacing, setLobeSpacing] = useState(30);
    const [filletRadius, setFilletRadius] = useState(8);
    const [curveThickness, setCurveThickness] = useState(12);
    const [centerThickness, setCenterThickness] = useState(2);
    const [maxHeight, setMaxHeight] = useState(150);
    const [smoothing, setSmoothing] = useState(2);
    const [color, setColor] = useState('#141414');
    const [backgroundColor, setBackgroundColor] = useState('#F5F5F5');
    
    const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);
    const [amplitudes, setAmplitudes] = useState<number[]>([]);
    
    const svgRef = useRef<SVGSVGElement>(null);

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            const arrayBuffer = await file.arrayBuffer();
            const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
            const buffer = await new Promise<AudioBuffer>((resolve, reject) => {
                audioContext.decodeAudioData(
                    arrayBuffer,
                    (decodedData) => resolve(decodedData),
                    (error) => reject(error || new Error('Unable to decode audio data'))
                );
            });
            setAudioBuffer(buffer);
        } catch (error) {
            console.error("Error decoding audio data:", error);
            alert("Unable to decode audio data. Please ensure the file is a valid audio file (e.g., MP3, WAV).");
        }
    };

    useEffect(() => {
        let amps: number[] = [];
        if (audioBuffer) {
            const channelData = audioBuffer.getChannelData(0);
            const blockSize = Math.floor(channelData.length / numLobes);
            for (let i = 0; i < numLobes; i++) {
                const start = i * blockSize;
                let sumSquares = 0;
                for (let j = 0; j < blockSize; j++) {
                    sumSquares += channelData[start + j] ** 2;
                }
                amps.push(Math.sqrt(sumSquares / blockSize));
            }
        } else {
            // Procedural generation
            for (let i = 0; i < numLobes; i++) {
                const x = (i / numLobes) * Math.PI * 15;
                let val = Math.abs(Math.sin(x) * Math.cos(x * 0.6) * Math.sin(x * 0.3));
                const envelope = Math.sin((i / numLobes) * Math.PI);
                amps.push(val * envelope + 0.05);
            }
        }

        let finalAmps = smoothArray(amps, smoothing);
        const maxAmp = Math.max(...finalAmps);
        setAmplitudes(finalAmps.map(a => maxAmp > 0 ? a / maxAmp : 0));
    }, [audioBuffer, numLobes, smoothing]);

    const safeWidth = Math.min(lobeWidth, lobeSpacing - 0.1);
    const safeTopWidth = Math.min(topWidth, safeWidth);
    const maxFillet = Math.max(0, (lobeSpacing - safeWidth) / 2);
    const safeFillet = Math.min(filletRadius, maxFillet);

    const startX = 50;
    const endX = startX + (numLobes - 1) * lobeSpacing;
    const totalWidth = endX + safeWidth / 2 + safeFillet + 50;
    const totalHeight = (maxHeight + 50) * 2;

    const pathData = useMemo(() => {
        const n = amplitudes.length;
        if (n === 0) return '';

        const cyTop = -centerThickness / 2;
        const cyBot = centerThickness / 2;

        let path = `M ${startX - safeWidth/2 - safeFillet - 50} ${cyTop} L ${startX - safeWidth/2 - safeFillet} ${cyTop} `;

        // Top half
        for (let i = 0; i < n; i++) {
            const cx = startX + i * lobeSpacing;
            let h = amplitudes[i] * maxHeight;
            
            if (h <= 0.1) continue;
            h = Math.max(h, centerThickness / 2 + 0.1);

            let bw2 = safeWidth / 2;
            let tw2 = safeTopWidth / 2;
            let cf = safeFillet;
            let ct = curveThickness;

            path += `
                L ${cx - bw2 - cf} ${cyTop}
                C ${cx - bw2 - cf + ct} ${cyTop}, ${cx - tw2 - ct} ${-h}, ${cx - tw2} ${-h}
                L ${cx + tw2} ${-h}
                C ${cx + tw2 + ct} ${-h}, ${cx + bw2 + cf - ct} ${cyTop}, ${cx + bw2 + cf} ${cyTop}
            `;
        }

        path += `L ${endX + safeWidth/2 + safeFillet + 50} ${cyTop} `;
        path += `L ${endX + safeWidth/2 + safeFillet + 50} ${cyBot} `;

        // Bottom half (reverse)
        for (let i = n - 1; i >= 0; i--) {
            const cx = startX + i * lobeSpacing;
            let h = amplitudes[i] * maxHeight;
            
            if (h <= 0.1) continue;
            h = Math.max(h, centerThickness / 2 + 0.1);

            let bw2 = safeWidth / 2;
            let tw2 = safeTopWidth / 2;
            let cf = safeFillet;
            let ct = curveThickness;

            path += `
                L ${cx + bw2 + cf} ${cyBot}
                C ${cx + bw2 + cf - ct} ${cyBot}, ${cx + tw2 + ct} ${h}, ${cx + tw2} ${h}
                L ${cx - tw2} ${h}
                C ${cx - tw2 - ct} ${h}, ${cx - bw2 - cf + ct} ${cyBot}, ${cx - bw2 - cf} ${cyBot}
            `;
        }

        path += `L ${startX - safeWidth/2 - safeFillet - 50} ${cyBot} Z`;
        return path;
    }, [amplitudes, lobeSpacing, safeWidth, safeTopWidth, safeFillet, curveThickness, maxHeight, centerThickness, startX, endX]);

    const exportSVG = () => {
        const svg = svgRef.current;
        if (!svg) return;
        
        const serializer = new XMLSerializer();
        const source = serializer.serializeToString(svg);
        const blob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'waveform.svg';
        a.click();
        URL.revokeObjectURL(url);
    };

    const exportImage = (type: 'png' | 'jpeg') => {
        const svg = svgRef.current;
        if (!svg) return;
        const serializer = new XMLSerializer();
        const source = serializer.serializeToString(svg);
        const img = new Image();
        const svgBlob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(svgBlob);

        img.onload = () => {
            const canvas = document.createElement('canvas');
            const scale = 2;
            canvas.width = totalWidth * scale;
            canvas.height = totalHeight * scale;
            const ctx = canvas.getContext('2d');
            if (!ctx) return;
            
            ctx.scale(scale, scale);

            ctx.fillStyle = backgroundColor;
            ctx.fillRect(0, 0, totalWidth, totalHeight);

            ctx.drawImage(img, 0, 0, totalWidth, totalHeight);
            
            URL.revokeObjectURL(url);

            const imgUrl = canvas.toDataURL(`image/${type}`, 1.0);
            const a = document.createElement('a');
            a.href = imgUrl;
            a.download = `waveform.${type === 'jpeg' ? 'jpg' : 'png'}`;
            a.click();
        };
        img.src = url;
    };

    return (
        <div className="flex h-screen w-full bg-neutral-100 text-neutral-900 font-sans overflow-hidden">
            {/* Sidebar */}
            <div className="w-80 bg-white border-r border-neutral-200 flex flex-col shadow-sm z-10 shrink-0">
                <div className="p-6 border-b border-neutral-200 flex items-center gap-3">
                    <div className="w-10 h-10 bg-neutral-900 rounded-xl flex items-center justify-center shadow-inner">
                        <Waves className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h1 className="text-lg font-semibold tracking-tight leading-tight">Waveform</h1>
                        <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest mt-0.5">Generator</p>
                    </div>
                </div>
                
                <div className="flex-1 overflow-y-auto p-6 space-y-8">
                    {/* Audio Upload */}
                    <div className="space-y-3">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">Audio Source</label>
                        <label className="flex items-center justify-center w-full h-28 px-4 transition bg-neutral-50 border-2 border-neutral-200 border-dashed rounded-xl hover:border-neutral-400 hover:bg-neutral-100 cursor-pointer group">
                            <div className="flex flex-col items-center space-y-2 text-center">
                                <div className="p-2 bg-white rounded-full shadow-sm group-hover:scale-110 transition-transform">
                                    <Upload className="w-5 h-5 text-neutral-600" />
                                </div>
                                <div>
                                    <span className="block text-sm font-semibold text-neutral-700">Upload Audio</span>
                                    <span className="block text-xs text-neutral-400 mt-0.5">MP3, WAV, OGG</span>
                                </div>
                            </div>
                            <input type="file" className="hidden" accept="audio/*" onChange={handleFileUpload} />
                        </label>
                    </div>

                    {/* Sliders */}
                    <div className="space-y-5">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">Geometry</label>
                        <SliderControl label="Number of Lobes" value={numLobes} min={10} max={200} onChange={setNumLobes} />
                        <SliderControl label="Base Width" value={lobeWidth} min={2} max={100} onChange={setLobeWidth} />
                        <SliderControl label="Top Width" value={topWidth} min={0} max={100} onChange={setTopWidth} />
                        <SliderControl label="Lobe Spacing" value={lobeSpacing} min={lobeWidth + 2} max={150} onChange={setLobeSpacing} />
                        <SliderControl label="Base Spread" value={filletRadius} min={0} max={50} onChange={setFilletRadius} />
                        <SliderControl label="Curve Thickness" value={curveThickness} min={0} max={100} onChange={setCurveThickness} />
                        <SliderControl label="Center Thickness" value={centerThickness} min={0} max={50} onChange={setCenterThickness} />
                        <SliderControl label="Max Height" value={maxHeight} min={10} max={500} onChange={setMaxHeight} />
                        <SliderControl label="Smoothing" value={smoothing} min={0} max={10} onChange={setSmoothing} />
                    </div>

                    {/* Colors */}
                    <div className="space-y-3">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">Appearance</label>
                        <ColorControl label="Waveform Color" value={color} onChange={setColor} />
                        <ColorControl label="Background Color" value={backgroundColor} onChange={setBackgroundColor} />
                    </div>
                </div>

                {/* Export Buttons */}
                <div className="p-6 border-t border-neutral-200 bg-neutral-50 space-y-3">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">Export</label>
                    <div className="grid grid-cols-3 gap-2">
                        <button onClick={() => exportImage('png')} className="flex flex-col items-center justify-center p-2.5 bg-white border border-neutral-200 rounded-lg hover:bg-neutral-50 hover:border-neutral-300 transition-colors shadow-sm">
                            <ImageIcon className="w-5 h-5 mb-1.5 text-neutral-600" />
                            <span className="text-[11px] font-bold tracking-wide">PNG</span>
                        </button>
                        <button onClick={() => exportImage('jpeg')} className="flex flex-col items-center justify-center p-2.5 bg-white border border-neutral-200 rounded-lg hover:bg-neutral-50 hover:border-neutral-300 transition-colors shadow-sm">
                            <ImageIcon className="w-5 h-5 mb-1.5 text-neutral-600" />
                            <span className="text-[11px] font-bold tracking-wide">JPG</span>
                        </button>
                        <button onClick={exportSVG} className="flex flex-col items-center justify-center p-2.5 bg-white border border-neutral-200 rounded-lg hover:bg-neutral-50 hover:border-neutral-300 transition-colors shadow-sm">
                            <FileType2 className="w-5 h-5 mb-1.5 text-neutral-600" />
                            <span className="text-[11px] font-bold tracking-wide">SVG</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Canvas Area */}
            <div className="flex-1 relative flex items-center justify-center p-8 overflow-auto" style={{ backgroundColor }}>
                <div className="shadow-2xl rounded-2xl overflow-hidden transition-colors duration-300 ring-1 ring-black/5" style={{ backgroundColor }}>
                    <svg 
                        ref={svgRef}
                        width={totalWidth} 
                        height={totalHeight} 
                        viewBox={`0 ${-totalHeight/2} ${totalWidth} ${totalHeight}`}
                        xmlns="http://www.w3.org/2000/svg"
                        className="block"
                    >
                        <path d={pathData} fill={color} />
                    </svg>
                </div>
            </div>
        </div>
    );
}

