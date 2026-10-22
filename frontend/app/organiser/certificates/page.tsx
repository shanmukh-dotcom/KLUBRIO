'use client';

import React, { useState } from 'react';
import { Search, Download, Award, Palette, Type, FileText, MoreHorizontal } from 'lucide-react';
import { MOCK_CERTIFICATES, MOCK_PARTICIPANTS } from '@/mocks/data';
import { Button } from '@/components/ui/button';
import { Badge, Avatar, Toggle, Card } from '@/components/ui/index';
import { Input } from '@/components/ui/input';
import { useToast } from '@/lib/toast-context';
import { cn } from '@/lib/utils';

const FONTS = ['Times New Roman', 'Georgia', 'Garamond', 'Playfair Display', 'Poppins', 'Inter'];

export default function CertificatesPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'generate' | 'issued'>('generate');
  const [certTitle, setCertTitle] = useState('CERTIFICATE OF PARTICIPATION');
  const [certSubtitle, setCertSubtitle] = useState('This is to certify that');
  const [selectedFont, setSelectedFont] = useState('Times New Roman');
  const [primaryColor, setPrimaryColor] = useState('#0F172A');
  const [accentColor, setAccentColor] = useState('#6366F1');
  const [borderColor, setBorderColor] = useState('#D4AF37');
  const [showQR, setShowQR] = useState(true);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black text-[#0F172A] mb-1" style={{ fontFamily: 'Poppins, sans-serif' }}>Certificates</h1>
          <p className="text-sm text-gray-500">Generate, customize and manage event certificates.</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" icon={<Download className="w-4 h-4" />}>Export All</Button>
          <Button size="sm" onClick={() => toast('Generating certificates for all checked-in participants…', 'info')}>Generate Certificates</Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 bg-slate-100 p-1.5 rounded-2xl mb-6 w-fit border border-slate-200/80">
        {[
          { id: 'generate' as const, label: 'Certificate Designer' },
          { id: 'issued' as const, label: 'Issued Certificates' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'px-5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer',
              activeTab === tab.id
                ? 'bg-gradient-to-r from-[#6366F1] to-[#8B5CF6] text-white shadow-md shadow-indigo-500/25 font-black'
                : 'text-slate-600 hover:text-indigo-600 hover:bg-white/60'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'generate' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Settings panel */}
          <div className="space-y-4">
            <Card>
              <h3 className="text-sm font-bold text-[#0F172A] mb-4" style={{ fontFamily: 'Poppins, sans-serif' }}>Certificate Text</h3>
              <div className="space-y-3">
                <Input label="Title" value={certTitle} onChange={e => setCertTitle(e.target.value)} />
                <Input label="Subtitle" value={certSubtitle} onChange={e => setCertSubtitle(e.target.value)} />
              </div>
            </Card>

            <Card>
              <h3 className="text-sm font-bold text-[#0F172A] mb-4" style={{ fontFamily: 'Poppins, sans-serif' }}>
                <Type className="inline w-4 h-4 mr-1.5 text-[#6366F1]" />
                Font & Typography
              </h3>
              <div className="space-y-2">
                {FONTS.map(f => (
                  <button key={f} onClick={() => setSelectedFont(f)} className={cn('w-full text-left px-3 py-2 rounded-lg text-sm transition-all', selectedFont === f ? 'bg-[#6366F1]/10 text-[#6366F1] font-medium' : 'text-gray-600 hover:bg-gray-50')} style={{ fontFamily: f }}>
                    {f}
                  </button>
                ))}
              </div>
            </Card>

            <Card>
              <h3 className="text-sm font-bold text-[#0F172A] mb-4" style={{ fontFamily: 'Poppins, sans-serif' }}>
                <Palette className="inline w-4 h-4 mr-1.5 text-[#6366F1]" />
                Colors
              </h3>
              <div className="space-y-3">
                {[
                  { label: 'Primary Text', value: primaryColor, onChange: setPrimaryColor },
                  { label: 'Accent', value: accentColor, onChange: setAccentColor },
                  { label: 'Border', value: borderColor, onChange: setBorderColor },
                ].map(c => (
                  <div key={c.label} className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">{c.label}</span>
                    <div className="flex items-center gap-2">
                      <input type="color" value={c.value} onChange={e => c.onChange(e.target.value)} className="w-8 h-8 rounded cursor-pointer border-0" />
                      <span className="text-xs font-mono text-gray-400">{c.value}</span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <Card>
              <Toggle checked={showQR} onChange={setShowQR} label="Add QR Code" description="Include verification QR code on the certificate" />
            </Card>
          </div>

          {/* Preview */}
          <div className="lg:col-span-2">
            <Card padding="lg">
              <h3 className="text-sm font-bold text-[#0F172A] mb-4" style={{ fontFamily: 'Poppins, sans-serif' }}>Certificate Preview</h3>
              <div
                className="aspect-[1.414] bg-white rounded-lg relative overflow-hidden"
                style={{
                  border: `4px solid ${borderColor}`,
                  fontFamily: selectedFont,
                }}
              >
                {/* Inner border */}
                <div className="absolute inset-2 border" style={{ borderColor: borderColor + '60' }} />

                <div className="flex flex-col items-center justify-center h-full text-center p-8 gap-3">
                  {/* Logos placeholder */}
                  <div className="flex items-center gap-4 mb-2">
                    <div className="w-12 h-12 bg-gray-100 rounded flex items-center justify-center text-lg">🏫</div>
                    <div className="w-12 h-12 bg-gray-100 rounded flex items-center justify-center text-lg">🌱</div>
                  </div>

                  <p className="text-xs tracking-[0.3em] uppercase" style={{ color: primaryColor + '80' }}>
                    {certTitle}
                  </p>
                  <div className="w-16 h-0.5 my-1" style={{ backgroundColor: accentColor }} />
                  <p className="text-xs" style={{ color: primaryColor + '80' }}>{certSubtitle}</p>
                  <p className="text-2xl font-bold italic" style={{ color: accentColor, fontFamily: selectedFont }}>
                    [Participant Name]
                  </p>
                  <p className="text-xs max-w-xs" style={{ color: primaryColor + '80' }}>
                    has actively participated in<br />
                    <strong>Nexovate 2.0: The Engineer&apos;s Pitch</strong><br />
                    organized by HARVEST AgriTech Innovation Club<br />
                    on 11th September 2026
                  </p>

                  {/* Signatures */}
                  <div className="flex justify-between w-full mt-6 px-8">
                    <div className="text-center">
                      <div className="w-24 h-8 border-b border-gray-300 mb-1" />
                      <p className="text-[10px]" style={{ color: primaryColor + '80' }}>Chief Convenor</p>
                    </div>
                    <div className="text-center">
                      <div className="w-24 h-8 border-b border-gray-300 mb-1" />
                      <p className="text-[10px]" style={{ color: primaryColor + '80' }}>Faculty Advisor</p>
                    </div>
                  </div>

                  {/* QR */}
                  {showQR && (
                    <div className="absolute bottom-4 right-4 w-12 h-12 bg-gray-100 rounded flex items-center justify-center">
                      <svg viewBox="0 0 24 24" className="w-8 h-8 text-gray-300" fill="currentColor">
                        <path d="M3 3h8v8H3V3zm2 2v4h4V5H5zm8-2h8v8h-8V3zm2 2v4h4V5h-4zM3 13h8v8H3v-8zm2 2v4h4v-4H5zm10-2h2v2h-2v-2zm4 0h2v2h-2v-2zm-4 4h2v2h-2v-2zm2-2h2v2h-2v-2zm2 2h2v2h-2v-2zm0 2h-2v2h2v-2zm-4 0h2v2h-2v-2z" />
                      </svg>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-2 mt-4 justify-end">
                <Button size="sm" variant="outline" onClick={() => toast('Certificate template saved!', 'success')}>Save Template</Button>
                <Button size="sm" onClick={() => toast('Generating certificates for 112 participants…', 'info')}>Generate for All (112)</Button>
              </div>
            </Card>
          </div>
        </div>
      )}

      {activeTab === 'issued' && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                <th className="text-left px-4 py-3 text-xs font-bold text-gray-400 uppercase">Participant</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-gray-400 uppercase">Certificate ID</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-gray-400 uppercase">Event</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-gray-400 uppercase">Type</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-gray-400 uppercase">Status</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-gray-400 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody>
              {MOCK_CERTIFICATES.map(c => (
                <tr key={c.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3"><div className="flex items-center gap-3"><Avatar name={c.participantName} size="sm" /><span className="text-sm font-medium">{c.participantName}</span></div></td>
                  <td className="px-4 py-3 text-sm text-gray-500 font-mono">{c.certificateId}</td>
                  <td className="px-4 py-3 text-sm text-gray-500 max-w-[200px] truncate">{c.eventName}</td>
                  <td className="px-4 py-3"><Badge variant="violet">{c.type}</Badge></td>
                  <td className="px-4 py-3"><Badge variant={c.status === 'valid' ? 'teal' : 'red'}>{c.status === 'valid' ? 'Valid' : 'Revoked'}</Badge></td>
                  <td className="px-4 py-3"><div className="flex gap-2"><Button size="sm" variant="ghost">View</Button><button className="p-1 text-gray-400 hover:text-gray-600"><MoreHorizontal className="w-4 h-4" /></button></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
