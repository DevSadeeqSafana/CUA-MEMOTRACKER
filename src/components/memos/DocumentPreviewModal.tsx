'use client';

import { useState } from 'react';
import { X, FileText, Download, Maximize2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DocumentProps {
    fileUrl: string;
    fileName: string;
    fileType: string;
    fileSize: number;
}

export default function DocumentPreviewModal({ fileUrl, fileName, fileType, fileSize }: DocumentProps) {
    const [isOpen, setIsOpen] = useState(false);

    // Determine how to preview the file based on its type
    const isImage = fileType?.startsWith('image/');
    const isPdf = fileType === 'application/pdf';
    // Office types
    const isWord = fileType?.includes('wordprocessingml') || fileType?.includes('msword');
    const isExcel = fileType?.includes('spreadsheetml') || fileType?.includes('excel');
    const isPowerPoint = fileType?.includes('presentationml') || fileType?.includes('powerpoint');
    const isOfficeDoc = isWord || isExcel || isPowerPoint;

    // Use Google Docs viewer as fallback for office documents
    // Note: The URL must be publicly accessible for Google Docs viewer to work
    const getPreviewUrl = () => {
        if (isImage || isPdf) return fileUrl;
        if (isOfficeDoc) return `https://docs.google.com/viewer?url=${encodeURIComponent(fileUrl)}&embedded=true`;
        return '';
    };

    const previewUrl = getPreviewUrl();
    const canPreview = isImage || isPdf || isOfficeDoc;

    return (
        <>
            {/* The Document Card */}
            <div 
                onClick={() => canPreview ? setIsOpen(true) : window.open(fileUrl, '_blank')}
                className="flex items-center gap-4 p-4 rounded-2xl border border-slate-200 bg-slate-50 hover:bg-blue-50 hover:border-blue-200 transition-colors group cursor-pointer relative"
            >
                <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-400 group-hover:text-blue-500 transition-colors shadow-sm shrink-0">
                    <FileText size={18} />
                </div>
                <div className="overflow-hidden flex-1">
                    <p className="text-sm font-bold text-slate-700 truncate group-hover:text-blue-700 transition-colors" title={fileName}>
                        {fileName}
                    </p>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">
                        {(fileSize / 1024).toFixed(1)} KB • {fileType?.split('/').pop()?.toUpperCase() || 'FILE'}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    {canPreview && (
                        <button 
                            onClick={(e) => { e.stopPropagation(); setIsOpen(true); }}
                            className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-blue-200"
                            title="Preview Document"
                        >
                            <Maximize2 size={14} />
                        </button>
                    )}
                    <a 
                        href={fileUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="w-8 h-8 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center hover:bg-slate-300 transition-colors"
                        title="Download Document"
                    >
                        <Download size={14} />
                    </a>
                </div>
            </div>

            {/* The Modal */}
            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 md:p-12 animate-in fade-in duration-200">
                    {/* Backdrop */}
                    <div 
                        className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm" 
                        onClick={() => setIsOpen(false)}
                    />
                    
                    {/* Modal Content */}
                    <div className="relative w-full max-w-6xl h-full bg-white rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
                        {/* Header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-white z-10">
                            <div className="flex items-center gap-3 overflow-hidden">
                                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                                    <FileText size={20} />
                                </div>
                                <div className="truncate">
                                    <h3 className="text-lg font-black text-slate-800 truncate" title={fileName}>{fileName}</h3>
                                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                                        Document Preview
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <a 
                                    href={fileUrl} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs transition-colors"
                                >
                                    <Download size={14} />
                                    Download
                                </a>
                                <button 
                                    onClick={() => setIsOpen(false)}
                                    className="w-10 h-10 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 flex items-center justify-center transition-colors shrink-0"
                                >
                                    <X size={20} />
                                </button>
                            </div>
                        </div>

                        {/* Viewer Body */}
                        <div className="flex-1 bg-slate-100 relative overflow-hidden flex items-center justify-center p-2 sm:p-4">
                            {isImage ? (
                                <img 
                                    src={fileUrl} 
                                    alt={fileName} 
                                    className="max-w-full max-h-full object-contain rounded-lg shadow-sm"
                                />
                            ) : previewUrl ? (
                                <iframe 
                                    src={previewUrl} 
                                    className="w-full h-full rounded-xl shadow-sm bg-white"
                                    title={fileName}
                                    allowFullScreen
                                />
                            ) : (
                                <div className="text-center p-8 bg-white rounded-2xl shadow-sm max-w-md">
                                    <FileText size={48} className="mx-auto text-slate-300 mb-4" />
                                    <h3 className="text-lg font-black text-slate-700 mb-2">Preview Not Available</h3>
                                    <p className="text-sm text-slate-500 mb-6 font-medium">
                                        This file type cannot be previewed in the browser. Please download the file to view its contents.
                                    </p>
                                    <a 
                                        href={fileUrl} 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-sm transition-colors shadow-lg shadow-blue-600/20"
                                    >
                                        <Download size={16} />
                                        Download File
                                    </a>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
