'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Building2, Loader2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { createVendor, updateVendor } from '@/lib/vendor-actions';
import type { VendorInput, VendorOption } from '@/lib/vendor-data';
import { cn } from '@/lib/utils';

interface Props {
    /** Vendor being edited; omit to register a new one. */
    vendor?: (VendorOption & { description?: string | null }) | null;
    /** Pre-fills the name when registering from a search box. */
    initialName?: string;
    /** Finance can record bank details; other staff only enter contact details. */
    showBankFields: boolean;
    onClose: () => void;
    onSaved: (vendor: VendorOption) => void;
    /** Called when the vendor already exists, so the caller can select it instead. */
    onExisting?: (vendor: VendorOption) => void;
}

const inputClass = 'w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm font-medium text-slate-800 outline-none transition-all placeholder:text-slate-300 focus:border-[#1a5aa6] focus:bg-white focus:ring-4 focus:ring-[#1a5aa6]/10';
const labelClass = 'mb-1.5 block text-[9px] font-black uppercase tracking-widest text-slate-400';

export default function VendorFormModal({ vendor, initialName, showBankFields, onClose, onSaved, onExisting }: Props) {
    const editing = Boolean(vendor);
    const [form, setForm] = useState<VendorInput>({
        name: vendor?.name ?? initialName ?? '',
        email: vendor?.email ?? '',
        phone: vendor?.phone ?? '',
        address: vendor?.address ?? '',
        description: vendor?.description ?? '',
        bankName: vendor?.bankName ?? '',
        accountName: vendor?.accountName ?? '',
        accountNumber: vendor?.accountNumber ?? '',
    });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !saving) onClose(); };
        document.addEventListener('keydown', onKey);
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
    }, [onClose, saving]);

    const set = (key: keyof VendorInput) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
        setForm(f => ({ ...f, [key]: e.target.value }));

    const submit = async (e: React.FormEvent) => {
        // The memo form wraps this modal's trigger; keep the submit from reaching it.
        e.preventDefault();
        e.stopPropagation();
        setSaving(true);
        setError(null);
        const res = editing ? await updateVendor(vendor!.id, form) : await createVendor(form);
        setSaving(false);
        if (res.success) {
            toast.success(editing ? 'Vendor updated' : `${res.vendor.name} registered`);
            onSaved(res.vendor);
            return;
        }
        if (res.existing && onExisting) {
            toast(res.error, { icon: 'ℹ️' });
            onExisting(res.existing);
            return;
        }
        setError(res.error);
    };

    // Rendered into <body>: the memo form is itself a <form>, and forms cannot be nested.
    return createPortal(
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-slate-900/60 p-0 backdrop-blur-sm sm:items-center sm:p-4" onClick={() => !saving && onClose()}>
            <form
                onSubmit={submit}
                onClick={e => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-labelledby="vendor-form-title"
                className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-slate-200 bg-white shadow-2xl sm:rounded-2xl"
            >
                <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
                    <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#0b2a5b] text-white"><Building2 size={16} /></div>
                        <div>
                            <h3 id="vendor-form-title" className="font-display text-lg font-medium tracking-tight text-[#0b2a5b]">
                                {editing ? 'Edit vendor' : 'Register a new vendor'}
                            </h3>
                            <p className="text-[11px] font-medium text-slate-400">
                                {editing ? 'Changes also appear in the Staff Portal vendor list.' : 'Shared with the Staff Portal vendor list.'}
                            </p>
                        </div>
                    </div>
                    <button type="button" aria-label="Close" disabled={saving} onClick={onClose} className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700">
                        <X size={18} />
                    </button>
                </div>

                <div className="space-y-4 overflow-y-auto px-5 py-5">
                    <div>
                        <label htmlFor="vendor-name" className={labelClass}>Vendor name *</label>
                        <input id="vendor-name" autoFocus required maxLength={145} value={form.name} onChange={set('name')} className={inputClass} placeholder="e.g. TD Africa Ltd" />
                    </div>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div>
                            <label htmlFor="vendor-email" className={labelClass}>Email address</label>
                            <input id="vendor-email" type="email" maxLength={45} value={form.email} onChange={set('email')} className={inputClass} placeholder="accounts@vendor.com" />
                        </div>
                        <div>
                            <label htmlFor="vendor-phone" className={labelClass}>Phone number</label>
                            <input id="vendor-phone" type="tel" maxLength={45} value={form.phone} onChange={set('phone')} className={inputClass} placeholder="0803 000 0000" />
                        </div>
                    </div>
                    <div>
                        <label htmlFor="vendor-address" className={labelClass}>Address</label>
                        <input id="vendor-address" maxLength={500} value={form.address} onChange={set('address')} className={inputClass} placeholder="Office address" />
                    </div>
                    <div>
                        <label htmlFor="vendor-description" className={labelClass}>What they supply</label>
                        <textarea id="vendor-description" rows={2} maxLength={2000} value={form.description} onChange={set('description')} className={cn(inputClass, 'resize-none')} placeholder="e.g. IT equipment and accessories" />
                    </div>

                    {showBankFields ? (
                        <fieldset className="space-y-4 rounded-xl border border-slate-100 bg-slate-50/60 p-4">
                            <legend className="px-1 text-[9px] font-black uppercase tracking-widest text-[#1a5aa6]">Payment details</legend>
                            <div>
                                <label htmlFor="vendor-bank" className={labelClass}>Bank name</label>
                                <input id="vendor-bank" maxLength={120} value={form.bankName} onChange={set('bankName')} className={inputClass} />
                            </div>
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <div>
                                    <label htmlFor="vendor-acct-name" className={labelClass}>Account name</label>
                                    <input id="vendor-acct-name" maxLength={150} value={form.accountName} onChange={set('accountName')} className={inputClass} />
                                </div>
                                <div>
                                    <label htmlFor="vendor-acct-no" className={labelClass}>Account number</label>
                                    <input id="vendor-acct-no" inputMode="numeric" maxLength={10} value={form.accountNumber}
                                        onChange={e => setForm(f => ({ ...f, accountNumber: e.target.value.replace(/\D/g, '') }))}
                                        className={inputClass} placeholder="10 digits" />
                                </div>
                            </div>
                        </fieldset>
                    ) : (
                        <p className="rounded-xl bg-slate-50 px-3.5 py-2.5 text-[11px] font-medium text-slate-500">
                            Finance adds the vendor&apos;s bank details when processing payment.
                        </p>
                    )}

                    {error && <p role="alert" className="rounded-xl border border-red-100 bg-red-50 px-3.5 py-2.5 text-xs font-semibold text-red-600">{error}</p>}
                </div>

                <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-3.5">
                    <button type="button" onClick={onClose} disabled={saving} className="rounded-xl px-4 py-2 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:bg-slate-100">
                        Cancel
                    </button>
                    <button type="submit" disabled={saving} className="flex items-center gap-2 rounded-xl bg-[#0b2a5b] px-5 py-2 text-[10px] font-black uppercase tracking-widest text-white shadow-md shadow-blue-900/20 hover:bg-[#1a5aa6] disabled:opacity-60">
                        {saving && <Loader2 size={12} className="animate-spin" />}
                        {editing ? 'Save changes' : 'Register vendor'}
                    </button>
                </div>
            </form>
        </div>,
        document.body
    );
}
