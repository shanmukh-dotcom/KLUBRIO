'use client';

import React, { useState, useRef } from 'react';
import { Upload, Download, Move, ImagePlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/index';
import { useToast } from '@/lib/toast-context';

export default function PosterQRPage() {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [posterUploaded, setPosterUploaded] = useState(false);
  const [qrPosition, setQrPosition] = useState({ x: 80, y: 80 });
  const [qrSize, setQrSize] = useState(15);

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast('File must be under 10 MB.', 'error');
      return;
    }
    setPosterUploaded(true);
    toast('Poster uploaded! Position the QR code.', 'success');
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-black text-[#0F172A] mb-1" style={{ fontFamily: 'Poppins, sans-serif' }}>Poster QR Code</h1>
        <p className="text-sm text-gray-500">Upload your existing event poster and add a registration QR code to it.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upload + settings */}
        <div className="space-y-4">
          <Card padding="lg">
            <h3 className="text-sm font-bold text-[#0F172A] mb-4" style={{ fontFamily: 'Poppins, sans-serif' }}>1. Upload Your Poster</h3>
            <div
              onClick={() => fileRef.current?.click()}
              className="border-2 border-dashed border-gray-200 rounded-xl p-10 text-center hover:border-[#6366F1] transition-colors cursor-pointer"
            >
              <ImagePlus className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-sm font-medium text-gray-600 mb-1">Upload Poster</p>
              <p className="text-xs text-gray-400">PNG, JPG or PDF (max 10 MB)</p>
            </div>
            <input ref={fileRef} type="file" accept="image/*,.pdf" className="hidden" onChange={handleUpload} />
          </Card>

          {posterUploaded && (
            <Card padding="lg">
              <h3 className="text-sm font-bold text-[#0F172A] mb-4" style={{ fontFamily: 'Poppins, sans-serif' }}>2. Position QR Code</h3>
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">Horizontal Position: {qrPosition.x}%</label>
                  <input type="range" min={0} max={100} value={qrPosition.x} onChange={e => setQrPosition(p => ({ ...p, x: +e.target.value }))} className="w-full accent-[#6366F1]" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">Vertical Position: {qrPosition.y}%</label>
                  <input type="range" min={0} max={100} value={qrPosition.y} onChange={e => setQrPosition(p => ({ ...p, y: +e.target.value }))} className="w-full accent-[#6366F1]" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">QR Size: {qrSize}%</label>
                  <input type="range" min={5} max={30} value={qrSize} onChange={e => setQrSize(+e.target.value)} className="w-full accent-[#6366F1]" />
                </div>
              </div>
              <div className="flex gap-2 mt-4">
                <Button fullWidth icon={<Download className="w-4 h-4" />} onClick={() => toast('Downloading poster with QR code…', 'info')}>Download Updated Poster</Button>
              </div>
            </Card>
          )}
        </div>

        {/* Preview */}
        <Card padding="lg">
          <h3 className="text-sm font-bold text-[#0F172A] mb-4" style={{ fontFamily: 'Poppins, sans-serif' }}>Preview</h3>
          <div className="relative aspect-[3/4] bg-gradient-to-br from-[#6366F1] to-[#0F172A] rounded-xl overflow-hidden flex items-center justify-center">
            {posterUploaded ? (
              <>
                {/* Mock poster content */}
                <div className="text-center text-white space-y-2 p-6">
                  <p className="text-xs tracking-widest uppercase text-white/50">HARVEST Presents</p>
                  <h2 className="text-xl font-black" style={{ fontFamily: 'Poppins, sans-serif' }}>NEXOVATE 2.0</h2>
                  <p className="text-sm font-medium">THE ENGINEER&apos;S PITCH</p>
                  <div className="text-xs text-white/60 space-y-0.5 mt-4">
                    <p>11 September 2026 | 4:00 PM</p>
                    <p>E Block, Seminar Hall 3</p>
                  </div>
                </div>
                {/* QR overlay */}
                <div
                  className="absolute bg-white rounded-lg p-1.5 shadow-lg"
                  style={{
                    left: `${qrPosition.x}%`,
                    top: `${qrPosition.y}%`,
                    transform: 'translate(-50%, -50%)',
                    width: `${qrSize}%`,
                    aspectRatio: '1',
                  }}
                >
                  <div className="w-full h-full bg-gray-100 rounded flex items-center justify-center">
                    <svg viewBox="0 0 24 24" className="w-full h-full p-1 text-gray-400" fill="currentColor">
                      <path d="M3 3h8v8H3V3zm2 2v4h4V5H5zm8-2h8v8h-8V3zm2 2v4h4V5h-4zM3 13h8v8H3v-8zm2 2v4h4v-4H5z" />
                    </svg>
                  </div>
                  <p className="text-center text-[6px] text-gray-400 mt-0.5 uppercase tracking-wider">SCAN TO REGISTER</p>
                </div>
              </>
            ) : (
              <div className="text-center">
                <Upload className="w-10 h-10 text-white/30 mx-auto mb-2" />
                <p className="text-white/40 text-sm">Upload a poster to see preview</p>
              </div>
            )}
          </div>
          {posterUploaded && (
            <div className="flex items-center gap-2 mt-3 text-xs text-gray-400">
              <Move className="w-3.5 h-3.5" />
              Use the sliders to position the QR code on your poster.
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
