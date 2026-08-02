import { useState } from 'react';
import { MessageCircle, ChevronDown, Loader2, Send, Trash2, ShieldCheck } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import type { AssetComment } from '../types';

interface Props {
  assetId: string;
}

export default function CommentsPanel({ assetId }: Props) {
  const { user, isAdmin } = useAuth();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [comments, setComments] = useState<AssetComment[] | null>(null);
  const [text, setText] = useState('');
  const [posting, setPosting] = useState(false);

  const loadComments = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('asset_comments')
      .select('id, asset_id, user_id, content, created_at, author:profiles(display_name, role)')
      .eq('asset_id', assetId)
      .order('created_at', { ascending: true });
    setComments((data as unknown as AssetComment[]) ?? []);
    setLoading(false);
  };

  const handleToggle = async () => {
    const next = !open;
    setOpen(next);
    if (next && comments === null) await loadComments();
  };

  const handlePost = async () => {
    if (!user || !text.trim()) return;
    setPosting(true);
    const { data, error } = await supabase
      .from('asset_comments')
      .insert({ asset_id: assetId, user_id: user.id, content: text.trim() })
      .select('id, asset_id, user_id, content, created_at, author:profiles(display_name, role)')
      .single();
    setPosting(false);
    if (error) {
      alert(`Odoslanie komentára zlyhalo: ${error.message}`);
      return;
    }
    if (data) {
      setComments((prev) => [...(prev ?? []), data as unknown as AssetComment]);
      setText('');
    }
  };

  const handleDelete = async (commentId: string) => {
    if (!confirm('Vymazať tento komentár?')) return;
    const { error } = await supabase.from('asset_comments').delete().eq('id', commentId);
    if (error) {
      alert(`Vymazanie zlyhalo: ${error.message}`);
      return;
    }
    setComments((prev) => (prev ? prev.filter((c) => c.id !== commentId) : prev));
  };

  return (
    <div className="mt-2 border-t border-slate-100 pt-2">
      <button
        onClick={handleToggle}
        className="flex w-full items-center justify-between text-xs font-medium text-slate-500 hover:text-slate-700"
      >
        <span className="flex items-center gap-1">
          <MessageCircle className="h-3 w-3" />
          Diskusia{comments && comments.length > 0 ? ` (${comments.length})` : ''}
        </span>
        <ChevronDown className={`h-3 w-3 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="mt-1.5 flex max-h-56 flex-col gap-2">
          <div className="flex flex-col gap-1.5 overflow-y-auto">
            {loading && <Loader2 className="h-3 w-3 animate-spin text-slate-400" />}
            {!loading && comments?.length === 0 && (
              <p className="text-[11px] text-slate-400">Zatiaľ žiadne komentáre.</p>
            )}
            {!loading &&
              comments?.map((c) => {
                const canDelete = !!user && (user.id === c.user_id || isAdmin);
                return (
                  <div key={c.id} className="rounded-md bg-slate-50 px-2 py-1.5 text-[11px]">
                    <div className="flex items-center justify-between gap-1">
                      <span className="flex items-center gap-1 font-medium text-slate-600">
                        {c.author?.display_name || 'Anonym'}
                        {c.author?.role === 'admin' && (
                          <ShieldCheck className="h-2.5 w-2.5 text-[rgb(var(--brand-600))]" />
                        )}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-slate-400">
                          {new Date(c.created_at).toLocaleDateString('sk-SK')}
                        </span>
                        {canDelete && (
                          <button
                            onClick={() => handleDelete(c.id)}
                            className="text-slate-400 hover:text-red-600"
                            aria-label="Vymazať komentár"
                          >
                            <Trash2 className="h-2.5 w-2.5" />
                          </button>
                        )}
                      </div>
                    </div>
                    <p className="mt-0.5 text-slate-600">{c.content}</p>
                  </div>
                );
              })}
          </div>

          {user ? (
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handlePost()}
                placeholder="Napíš komentár…"
                maxLength={500}
                className="flex-1 rounded-md border border-slate-200 px-2 py-1 text-xs focus:border-[rgb(var(--brand-500))] focus:outline-none"
              />
              <button
                onClick={handlePost}
                disabled={posting || !text.trim()}
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[rgb(var(--brand-600))] text-white disabled:opacity-40"
                aria-label="Odoslať"
              >
                {posting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
              </button>
            </div>
          ) : (
            <p className="text-[11px] text-slate-400">Pre pridanie komentára sa prihlás.</p>
          )}
        </div>
      )}
    </div>
  );
}
